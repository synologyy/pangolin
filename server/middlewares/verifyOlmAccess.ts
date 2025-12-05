import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import { db, olms } from "@server/db";
import { and, eq } from "drizzle-orm";

export async function verifyOlmAccess(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user!.userId;
        const olmId = req.params.olmId || req.body.olmId || req.query.olmId;

        if (!userId) {
            return next(
                createHttpError(HttpCode.UNAUTHORIZED, "User not authenticated")
            );
        }

        const [existingOlm] = await db
            .select()
            .from(olms)
            .where(and(eq(olms.olmId, olmId), eq(olms.userId, userId)));

        if (!existingOlm) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    "User does not have access to this olm"
                )
            );
        }

        return next();
    } catch (error) {
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Error checking if user has access to this user"
            )
        );
    }
}
