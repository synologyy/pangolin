import { NextFunction, Response } from "express";
import ErrorResponse from "@server/types/ErrorResponse";
import { db } from "@server/db";
import { users } from "@server/db";
import { eq } from "drizzle-orm";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import config from "@server/lib/config";
import { verifySession } from "@server/auth/sessions/verifySession";
import { unauthorized } from "@server/auth/unauthorizedResponse";
import logger from "@server/logger";

export const verifySessionUserMiddleware = async (
    req: any,
    res: Response<ErrorResponse>,
    next: NextFunction
) => {
    const { forceLogin } = req.query;

    const { session, user } = await verifySession(req, forceLogin === "true");
    if (!session || !user) {
        if (config.getRawConfig().app.log_failed_attempts) {
            logger.info(`User session not found. IP: ${req.ip}.`);
        }
        return next(unauthorized());
    }

    const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.userId, user.userId));

    if (!existingUser || !existingUser[0]) {
        if (config.getRawConfig().app.log_failed_attempts) {
            logger.info(`User session not found. IP: ${req.ip}.`);
        }
        return next(
            createHttpError(HttpCode.BAD_REQUEST, "User does not exist")
        );
    }

    req.user = existingUser[0];
    req.session = session;

    if (
        !existingUser[0].emailVerified &&
        config.getRawConfig().flags?.require_email_verification
    ) {
        return next(
            createHttpError(HttpCode.BAD_REQUEST, "Email is not verified") // Might need to change the response type?
        );
    }

    next();
};
