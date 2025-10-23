import { db, requestAuditLog, resources } from "@server/db";
import { registry } from "@server/openApi";
import { NextFunction } from "express";
import { Request, Response } from "express";
import { eq, gt, lt, and, count } from "drizzle-orm";
import { OpenAPITags } from "@server/openApi";
import { z } from "zod";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import { fromError } from "zod-validation-error";
import { QueryRequestAuditLogResponse } from "@server/routers/auditLogs/types";
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

export const queryRequestAuditLogsParams = z.object({
    orgId: z.string()
});

export function queryRequest(timeStart: number, timeEnd: number, orgId: string) {
    return db
        .select({
            timestamp: requestAuditLog.timestamp, 
            orgId: requestAuditLog.orgId, 
            action: requestAuditLog.action, 
            reason: requestAuditLog.reason, 
            actorType: requestAuditLog.actorType, 
            actor: requestAuditLog.actor, 
            actorId: requestAuditLog.actorId, 
            resourceId: requestAuditLog.resourceId, 
            ip: requestAuditLog.ip, 
            location: requestAuditLog.location, 
            userAgent: requestAuditLog.userAgent, 
            metadata: requestAuditLog.metadata, 
            headers: requestAuditLog.headers, 
            query: requestAuditLog.query, 
            originalRequestURL: requestAuditLog.originalRequestURL, 
            scheme: requestAuditLog.scheme, 
            host: requestAuditLog.host, 
            path: requestAuditLog.path, 
            method: requestAuditLog.method, 
            tls: requestAuditLog.tls,
            resourceName: resources.name,
            resourceNiceId: resources.niceId
        })
        .from(requestAuditLog)
        .leftJoin(resources, eq(requestAuditLog.resourceId, resources.resourceId)) // TODO: Is this efficient?
        .where(
            and(
                gt(requestAuditLog.timestamp, timeStart),
                lt(requestAuditLog.timestamp, timeEnd),
                eq(requestAuditLog.orgId, orgId)
            )
        )
        .orderBy(requestAuditLog.timestamp);
}

export function countRequestQuery(timeStart: number, timeEnd: number, orgId: string) {
            const countQuery = db
            .select({ count: count() })
            .from(requestAuditLog)
            .where(
                and(
                    gt(requestAuditLog.timestamp, timeStart),
                    lt(requestAuditLog.timestamp, timeEnd),
                    eq(requestAuditLog.orgId, orgId)
                )
            );
    return countQuery;
}

registry.registerPath({
    method: "get",
    path: "/org/{orgId}/logs/request",
    description: "Query the request audit log for an organization",
    tags: [OpenAPITags.Org],
    request: {
        query: queryAccessAuditLogsQuery,
        params: queryRequestAuditLogsParams
    },
    responses: {}
});

export async function queryRequestAuditLogs(
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

        const parsedParams = queryRequestAuditLogsParams.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error)
                )
            );
        }
        const { orgId } = parsedParams.data;

        const baseQuery = queryRequest(timeStart, timeEnd, orgId);

        const log = await baseQuery.limit(limit).offset(offset);

        const totalCountResult = await countRequestQuery(timeStart, timeEnd, orgId);
        const totalCount = totalCountResult[0].count;

        return response<QueryRequestAuditLogResponse>(res, {
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
            message: "Action audit logs retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
