import { generateSessionToken } from "@server/auth/sessions/app";
import { db } from "@server/db";
import { olms } from "@server/db";
import HttpCode from "@server/types/HttpCode";
import response from "@server/lib/response";
import { eq } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import {
    createOlmSession,
    validateOlmSessionToken
} from "@server/auth/sessions/olm";
import { verifyPassword } from "@server/auth/password";
import logger from "@server/logger";
import config from "@server/lib/config";

export const olmGetTokenBodySchema = z.object({
    olmId: z.string(),
    secret: z.string(),
    token: z.string().optional()
});

export type OlmGetTokenBody = z.infer<typeof olmGetTokenBodySchema>;

export async function getOlmToken(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedBody = olmGetTokenBodySchema.safeParse(req.body);

    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    const { olmId, secret, token } = parsedBody.data;

    try {
        if (token) {
            const { session, olm } = await validateOlmSessionToken(token);
            if (session) {
                if (config.getRawConfig().app.log_failed_attempts) {
                    logger.info(
                        `Olm session already valid. Olm ID: ${olmId}. IP: ${req.ip}.`
                    );
                }
                return response<null>(res, {
                    data: null,
                    success: true,
                    error: false,
                    message: "Token session already valid",
                    status: HttpCode.OK
                });
            }
        }

        const existingOlmRes = await db
            .select()
            .from(olms)
            .where(eq(olms.olmId, olmId));
        if (!existingOlmRes || !existingOlmRes.length) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    "No olm found with that olmId"
                )
            );
        }

        const existingOlm = existingOlmRes[0];

        const validSecret = await verifyPassword(
            secret,
            existingOlm.secretHash
        );
        if (!validSecret) {
            if (config.getRawConfig().app.log_failed_attempts) {
                logger.info(
                    `Olm id or secret is incorrect. Olm: ID ${olmId}. IP: ${req.ip}.`
                );
            }
            return next(
                createHttpError(HttpCode.BAD_REQUEST, "Secret is incorrect")
            );
        }

        logger.debug("Creating new olm session token");

        const resToken = generateSessionToken();
        await createOlmSession(resToken, existingOlm.olmId);

        logger.debug("Token created successfully");

        return response<{ token: string }>(res, {
            data: {
                token: resToken
            },
            success: true,
            error: false,
            message: "Token created successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to authenticate olm"
            )
        );
    }
}
