import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";

// Define Zod schema for request validation
const getResolvedHostnameSchema = z.object({
    hostname: z.string(),
    publicKey: z.string()
});

export async function getResolvedHostname(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        // Validate request parameters
        const parsedParams = getResolvedHostnameSchema.safeParse(
            req.body
        );
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        // return the endpoints
        return res.status(HttpCode.OK).send({
            endpoints: [] // ALWAYS ROUTE LOCALLY
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "An error occurred..."
            )
        );
    }
}
