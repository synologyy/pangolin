import { db, requestAuditLog } from "@server/db";
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
import { queryAccessAuditLogsQuery, queryRequestAuditLogsParams, querySites } from "./queryRequstAuditLog";
import { generateCSV } from "./generateCSV";

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

export async function exportRequestAuditLogs(
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

        const baseQuery = querySites(timeStart, timeEnd, orgId);

        const log = await baseQuery.limit(limit).offset(offset);

        const csvData = generateCSV(log);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="request-audit-logs-${orgId}-${Date.now()}.csv"`);
        
        return res.send(csvData);
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
