import { NextFunction, Response } from "express";
import ErrorResponse from "@server/types/ErrorResponse";
import { verifySession } from "@server/auth/sessions/verifySession";
import { unauthorized } from "@server/auth/unauthorizedResponse";

export const verifySessionMiddleware = async (
    req: any,
    res: Response<ErrorResponse>,
    next: NextFunction
) => {
    const { session, user } = await verifySession(req);
    if (!session || !user) {
        return next(unauthorized());
    }

    req.user = user;
    req.session = session;

    return next();
};
