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

import { accessAuditLog, db, resources } from "@server/db";
import { registry } from "@server/openApi";
import { NextFunction } from "express";
import { Request, Response } from "express";
import { eq, gt, lt, and, count } from "drizzle-orm";
import { OpenAPITags } from "@server/openApi";
import { z } from "zod";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import { fromError } from "zod-validation-error";
import { QueryAccessAuditLogResponse } from "@server/routers/auditLogs/types";
import response from "@server/lib/response";
import logger from "@server/logger";

export const queryAccessAuditLogsQuery = z.object({
    // iso string just validate its a parseable date
    timeStart: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), {
            message: "timeStart must be a valid ISO date string"
        })
        .transform((val) => Math.floor(new Date(val).getTime() / 1000)),
    timeEnd: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), {
            message: "timeEnd must be a valid ISO date string"
        })
        .transform((val) => Math.floor(new Date(val).getTime() / 1000))
        .optional()
        .default(new Date().toISOString()),
    limit: z
        .string()
        .optional()
        .default("1000")
        .transform(Number)
        .pipe(z.number().int().positive()),
    offset: z
        .string()
        .optional()
        .default("0")
        .transform(Number)
        .pipe(z.number().int().nonnegative())
});

export const queryAccessAuditLogsParams = z.object({
    orgId: z.string()
});

export function queryAccess(timeStart: number, timeEnd: number, orgId: string) {
    return db
        .select({
            orgId: accessAuditLog.orgId,
            action: accessAuditLog.action,
            actorType: accessAuditLog.actorType,
            actorId: accessAuditLog.actorId,
            resourceId: accessAuditLog.resourceId,
            resourceName: resources.name,
            resourceNiceId: resources.niceId,
            ip: accessAuditLog.ip,
            location: accessAuditLog.location,
            userAgent: accessAuditLog.userAgent,
            metadata: accessAuditLog.metadata,
            type: accessAuditLog.type,
            timestamp: accessAuditLog.timestamp,
            actor: accessAuditLog.actor
        })
        .from(accessAuditLog)
        .leftJoin(resources, eq(accessAuditLog.resourceId, resources.resourceId))
        .where(
            and(
                gt(accessAuditLog.timestamp, timeStart),
                lt(accessAuditLog.timestamp, timeEnd),
                eq(accessAuditLog.orgId, orgId)
            )
        )
        .orderBy(accessAuditLog.timestamp);
}

export function countAccessQuery(timeStart: number, timeEnd: number, orgId: string) {
            const countQuery = db
            .select({ count: count() })
            .from(accessAuditLog)
            .where(
                and(
                    gt(accessAuditLog.timestamp, timeStart),
                    lt(accessAuditLog.timestamp, timeEnd),
                    eq(accessAuditLog.orgId, orgId)
                )
            );
    return countQuery;
}

registry.registerPath({
    method: "get",
    path: "/org/{orgId}/logs/access",
    description: "Query the access audit log for an organization",
    tags: [OpenAPITags.Org],
    request: {
        query: queryAccessAuditLogsQuery,
        params: queryAccessAuditLogsParams
    },
    responses: {}
});

export async function queryAccessAuditLogs(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedQuery = queryAccessAuditLogsQuery.safeParse(req.query);
        if (!parsedQuery.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedQuery.error)
                )
            );
        }
        const { timeStart, timeEnd, limit, offset } = parsedQuery.data;

        const parsedParams = queryAccessAuditLogsParams.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error)
                )
            );
        }
        const { orgId } = parsedParams.data;

        const baseQuery = queryAccess(timeStart, timeEnd, orgId);

        const log = await baseQuery.limit(limit).offset(offset);

        const totalCountResult = await countAccessQuery(timeStart, timeEnd, orgId);
        const totalCount = totalCountResult[0].count;

        return response<QueryAccessAuditLogResponse>(res, {
            data: {
                log: log,
                pagination: {
                    total: totalCount,
                    limit,
                    offset
                }
            },
            success: true,
            error: false,
            message: "Access audit logs retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
