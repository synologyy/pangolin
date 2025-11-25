import { NextFunction, Request, Response } from "express";
import { db } from "@server/db";
import { olms, clients, clientSites } from "@server/db";
import { eq, and } from "drizzle-orm";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import response from "@server/lib/response";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";
import { OpenAPITags, registry } from "@server/openApi";

const paramsSchema = z
    .object({
        userId: z.string(),
        olmId: z.string()
    })
    .strict();

// registry.registerPath({
//     method: "get",
//     path: "/user/{userId}/olm/{olmId}",
//     description: "Get an olm for a user.",
//     tags: [OpenAPITags.User, OpenAPITags.Client],
//     request: {
//         params: paramsSchema
//     },
//     responses: {}
// });

export async function getUserOlm(
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

        const { olmId, userId } = parsedParams.data;

        const [olm] = await db
            .select()
            .from(olms)
            .where(and(eq(olms.userId, userId), eq(olms.olmId, olmId)));

        return response(res, {
            data: olm,
            success: true,
            error: false,
            message: "Successfully retrieved olm",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to retrieve olm"
            )
        );
    }
}
