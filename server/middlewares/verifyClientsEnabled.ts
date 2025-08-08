import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import config from "@server/lib/config";

export async function verifyClientsEnabled(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!config.getRawConfig().flags?.enable_clients) {
            return next(
                createHttpError(
                    HttpCode.NOT_IMPLEMENTED,
                    "Clients are not enabled on this server."
                )
            );
        }
        return next();
    } catch (error) {
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to check if clients are enabled"
            )
        );
    }
}
