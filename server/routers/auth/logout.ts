import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import response from "@server/lib/response";
import logger from "@server/logger";
import {
    createBlankSessionTokenCookie,
    invalidateSession,
    createBlankCsrfCookie
} from "@server/auth/sessions/app";
import { verifySession } from "@server/auth/sessions/verifySession";
import config from "@server/lib/config";

export async function logout(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const { user, session } = await verifySession(req);
    if (!user || !session) {
        if (config.getRawConfig().app.log_failed_attempts) {
            logger.info(
                `Log out failed because missing or invalid session. IP: ${req.ip}.`
            );
        }
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                "You must be logged in to sign out"
            )
        );
    }

    try {
        try {
            await invalidateSession(session.sessionId);
        } catch (error) {
            logger.error("Failed to invalidate session", error)
        }

        const isSecure = req.protocol === "https";
        res.setHeader("Set-Cookie", createBlankSessionTokenCookie(isSecure));
        res.appendHeader("Set-Cookie", createBlankCsrfCookie(isSecure));

        return response<null>(res, {
            data: null,
            success: true,
            error: false,
            message: "Logged out successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "Failed to log out")
        );
    }
}
