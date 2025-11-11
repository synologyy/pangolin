/*
 * This file is part of a proprietary work.
 *
 * Copyright (c) 2025 Fossorial, Inc.
 * All rights reserved.
 *
 * This file is licensed under the Fossorial Commercial License.
 * You may not use this file except in compliance with the License.
 * Unauthorized use, copying, modification, or distribution is strictly prohibited.
 *
 * This file is not licensed under the AGPLv3.
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db, orgAuthPages } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";
import createResponseBodySchema from "@server/lib/createResponseBodySchema";

const updateOrgAuthPageParamsSchema = z
    .object({
        orgId: z.string()
    })
    .strict();

const updateOrgAuthPageBodySchema = z
    .object({
        logoUrl: z.string().url(),
        logoWidth: z.number().min(1),
        logoHeight: z.number().min(1),
        title: z.string(),
        subtitle: z.string().optional(),
        resourceTitle: z.string(),
        resourceSubtitle: z.string().optional()
    })
    .strict();

const reponseSchema = createResponseBodySchema(updateOrgAuthPageBodySchema);

export type UpdateOrgAuthPageResponse = z.infer<typeof reponseSchema>;

registry.registerPath({
    method: "put",
    path: "/org/{orgId}/auth-page",
    description: "Update an organization auth page",
    tags: [OpenAPITags.Org],
    request: {
        params: updateOrgAuthPageParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: updateOrgAuthPageBodySchema
                }
            }
        }
    },
    responses: {
        200: {
            description: "",
            content: {
                "application/json": {
                    schema: reponseSchema
                }
            }
        }
    }
});

export async function updateOrgAuthPage(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = updateOrgAuthPageParamsSchema.safeParse(
            req.params
        );
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const parsedBody = updateOrgAuthPageBodySchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { orgId } = parsedParams.data;
        const body = parsedBody.data;

        const updatedOrgAuthPages = await db
            .insert(orgAuthPages)
            .values({
                ...body,
                orgId
            })
            .onConflictDoUpdate({
                target: orgAuthPages.orgId,
                set: {
                    ...body
                }
            })
            .returning();

        if (updatedOrgAuthPages.length === 0) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Organization with ID ${orgId} not found`
                )
            );
        }

        return response(res, {
            data: updatedOrgAuthPages[0],
            success: true,
            error: false,
            message: "Organization auth page updated successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
