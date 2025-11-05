import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { userSiteResources } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { eq } from "drizzle-orm";
import { OpenAPITags, registry } from "@server/openApi";

const setSiteResourceUsersBodySchema = z
    .object({
        userIds: z.array(z.string())
    })
    .strict();

const setSiteResourceUsersParamsSchema = z
    .object({
        siteResourceId: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive())
    })
    .strict();

registry.registerPath({
    method: "post",
    path: "/site-resource/{siteResourceId}/users",
    description:
        "Set users for a site resource. This will replace all existing users.",
    tags: [OpenAPITags.Resource, OpenAPITags.User],
    request: {
        params: setSiteResourceUsersParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: setSiteResourceUsersBodySchema
                }
            }
        }
    },
    responses: {}
});

export async function setSiteResourceUsers(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedBody = setSiteResourceUsersBodySchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { userIds } = parsedBody.data;

        const parsedParams = setSiteResourceUsersParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { siteResourceId } = parsedParams.data;

        await db.transaction(async (trx) => {
            await trx
                .delete(userSiteResources)
                .where(eq(userSiteResources.siteResourceId, siteResourceId));

            await Promise.all(
                userIds.map((userId) =>
                    trx
                        .insert(userSiteResources)
                        .values({ userId, siteResourceId })
                        .returning()
                )
            );
        });

        return response(res, {
            data: {},
            success: true,
            error: false,
            message: "Users set for site resource successfully",
            status: HttpCode.CREATED
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}

