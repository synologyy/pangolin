import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import { response } from "@server/lib";
import { finishLogin } from "@server/auth/passkey";
import { generateCsrfToken, generateSessionToken, createSession, serializeSessionCookie, serializeCsrfCookie } from "@server/auth/sessions/app";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";

const bodySchema = z.object({ credential: z.any() });

export async function passkeyLoginVerify(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
        return next(
            createHttpError(HttpCode.BAD_REQUEST, fromError(parsed.error).toString())
        );
    }
    try {
        const result = await finishLogin(parsed.data.credential);
        if (!result.verified || !result.userId) {
            return next(createHttpError(HttpCode.UNAUTHORIZED, "Invalid passkey"));
        }

        const token = generateSessionToken();
        const csrf = generateCsrfToken();
        const sess = await createSession(token, result.userId);
        const isSecure = req.protocol === "https";
        const cookie = serializeSessionCookie(token, isSecure, new Date(sess.expiresAt));
        const csrfCookie = serializeCsrfCookie(csrf, isSecure, new Date(sess.expiresAt));
        res.appendHeader("Set-Cookie", cookie);
        res.appendHeader("Set-Cookie", csrfCookie);

        return response<null>(res, {
            data: null,
            success: true,
            error: false,
            message: "Logged in",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error(e);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "Failed to verify passkey")
        );
    }
}
