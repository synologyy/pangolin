import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { idp, idpOidcConfig, idpOrg } from "@server/db";
import { and, eq } from "drizzle-orm";
import * as arctic from "arctic";
import { generateOidcRedirectUrl } from "@server/lib/idp/generateRedirectUrl";
import cookie from "cookie";
import jsonwebtoken from "jsonwebtoken";
import config from "@server/lib/config";
import { decrypt } from "@server/lib/crypto";

const paramsSchema = z
    .object({
        idpId: z.coerce.number()
    })
    .strict();

const bodySchema = z
    .object({
        redirectUrl: z.string()
    })
    .strict();

const ensureTrailingSlash = (url: string): string => {
    return url;
};

export type GenerateOidcUrlResponse = {
    redirectUrl: string;
};

export async function generateOidcUrl(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = paramsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { idpId } = parsedParams.data;

        const parsedBody = bodySchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { redirectUrl: postAuthRedirectUrl } = parsedBody.data;

        const [existingIdp] = await db
            .select()
            .from(idp)
            .innerJoin(idpOidcConfig, eq(idpOidcConfig.idpId, idp.idpId))
            .where(and(eq(idp.type, "oidc"), eq(idp.idpId, idpId)));

        if (!existingIdp) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    "IdP not found for the organization"
                )
            );
        }

        const parsedScopes = existingIdp.idpOidcConfig.scopes
            .split(" ")
            .map((scope) => {
                return scope.trim();
            })
            .filter((scope) => {
                return scope.length > 0;
            });

        const key = config.getRawConfig().server.secret!;

        const decryptedClientId = decrypt(
            existingIdp.idpOidcConfig.clientId,
            key
        );
        const decryptedClientSecret = decrypt(
            existingIdp.idpOidcConfig.clientSecret,
            key
        );

        const redirectUrl = generateOidcRedirectUrl(idpId);
        const client = new arctic.OAuth2Client(
            decryptedClientId,
            decryptedClientSecret,
            redirectUrl
        );

        const codeVerifier = arctic.generateCodeVerifier();
        const state = arctic.generateState();
        const url = client.createAuthorizationURLWithPKCE(
            ensureTrailingSlash(existingIdp.idpOidcConfig.authUrl),
            state,
            arctic.CodeChallengeMethod.S256,
            codeVerifier,
            parsedScopes
        );
        logger.debug("Generated OIDC URL", { url });

        const stateJwt = jsonwebtoken.sign(
            {
                redirectUrl: postAuthRedirectUrl, // TODO: validate that this is safe
                state,
                codeVerifier
            },
            config.getRawConfig().server.secret!
        );

        res.cookie("p_oidc_state", stateJwt, {
            path: "/",
            httpOnly: true,
            secure: req.protocol === "https",
            expires: new Date(Date.now() + 60 * 10 * 1000),
            sameSite: "lax"
        });

        return response<GenerateOidcUrlResponse>(res, {
            data: {
                redirectUrl: url.toString()
            },
            success: true,
            error: false,
            message: "Idp auth url generated",
            status: HttpCode.CREATED
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
