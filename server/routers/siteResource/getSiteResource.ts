import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { siteResources, SiteResource } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import { eq, and } from "drizzle-orm";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";
import { OpenAPITags, registry } from "@server/openApi";

const getSiteResourceParamsSchema = z
    .object({
        siteResourceId: z.string().transform(Number).pipe(z.number().int().positive()),
        siteId: z.string().transform(Number).pipe(z.number().int().positive()),
        orgId: z.string()
    })
    .strict();

export type GetSiteResourceResponse = SiteResource;

registry.registerPath({
    method: "get",
    path: "/org/{orgId}/site/{siteId}/resource/{siteResourceId}",
    description: "Get a specific site resource.",
    tags: [OpenAPITags.Client, OpenAPITags.Org],
    request: {
        params: getSiteResourceParamsSchema
    },
    responses: {}
});

export async function getSiteResource(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = getSiteResourceParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { siteResourceId, siteId, orgId } = parsedParams.data;

        // Get the site resource
        const [siteResource] = await db
            .select()
            .from(siteResources)
            .where(and(
                eq(siteResources.siteResourceId, siteResourceId),
                eq(siteResources.siteId, siteId),
                eq(siteResources.orgId, orgId)
            ))
            .limit(1);

        if (!siteResource) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    "Site resource not found"
                )
            );
        }

        return response(res, {
            data: siteResource,
            success: true,
            error: false,
            message: "Site resource retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error("Error getting site resource:", error);
        return next(createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "Failed to get site resource"));
    }
}
