import { eq } from "drizzle-orm";
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
import { orgs } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";
import createResponseBodySchema from "@server/lib/createResponseBodySchema";

const getOrgAuthPageParamsSchema = z
    .object({
        orgId: z.string()
    })
    .strict();

const reponseSchema = createResponseBodySchema(
    z
        .object({
            logoUrl: z.string().url(),
            logoWidth: z.number().min(1),
            logoHeight: z.number().min(1),
            title: z.string(),
            subtitle: z.string().optional(),
            resourceTitle: z.string(),
            resourceSubtitle: z.string().optional()
        })
        .strict()
);

export type GetOrgAuthPageResponse = z.infer<typeof reponseSchema>;

registry.registerPath({
    method: "get",
    path: "/org/{orgId}/auth-page",
    description: "Get an organization auth page",
    tags: [OpenAPITags.Org],
    request: {
        params: getOrgAuthPageParamsSchema
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

export async function getOrgAuthPage(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = getOrgAuthPageParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { orgId } = parsedParams.data;

        const [orgAuthPage] = await db
            .select()
            .from(orgAuthPages)
            .leftJoin(orgs, eq(orgs.orgId, orgAuthPages.orgId))
            .where(eq(orgs.orgId, orgId))
            .limit(1);

        return response(res, {
            data: orgAuthPage?.orgAuthPages ?? null,
            success: true,
            error: false,
            message: "Organization auth page retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
