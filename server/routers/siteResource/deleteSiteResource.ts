import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db, newts, sites } from "@server/db";
import { siteResources } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import { eq, and } from "drizzle-orm";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";
import { OpenAPITags, registry } from "@server/openApi";
import { removeTargets } from "../client/targets";

const deleteSiteResourceParamsSchema = z
    .object({
        siteResourceId: z.string().transform(Number).pipe(z.number().int().positive()),
        siteId: z.string().transform(Number).pipe(z.number().int().positive()),
        orgId: z.string()
    })
    .strict();

export type DeleteSiteResourceResponse = {
    message: string;
};

registry.registerPath({
    method: "delete",
    path: "/org/{orgId}/site/{siteId}/resource/{siteResourceId}",
    description: "Delete a site resource.",
    tags: [OpenAPITags.Client, OpenAPITags.Org],
    request: {
        params: deleteSiteResourceParamsSchema
    },
    responses: {}
});

export async function deleteSiteResource(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = deleteSiteResourceParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { siteResourceId, siteId, orgId } = parsedParams.data;

        const [site] = await db
            .select()
            .from(sites)
            .where(and(eq(sites.siteId, siteId), eq(sites.orgId, orgId)))
            .limit(1);

        if (!site) {
            return next(createHttpError(HttpCode.NOT_FOUND, "Site not found"));
        }

        // Check if site resource exists
        const [existingSiteResource] = await db
            .select()
            .from(siteResources)
            .where(and(
                eq(siteResources.siteResourceId, siteResourceId),
                eq(siteResources.siteId, siteId),
                eq(siteResources.orgId, orgId)
            ))
            .limit(1);

        if (!existingSiteResource) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    "Site resource not found"
                )
            );
        }

        // Delete the site resource
        await db
            .delete(siteResources)
            .where(and(
                eq(siteResources.siteResourceId, siteResourceId),
                eq(siteResources.siteId, siteId),
                eq(siteResources.orgId, orgId)
            ));

        // Only remove targets for port mode
        if (existingSiteResource.mode === "port" && existingSiteResource.protocol && existingSiteResource.proxyPort && existingSiteResource.destinationPort) {
            const [newt] = await db
                .select()
                .from(newts)
                .where(eq(newts.siteId, site.siteId))
                .limit(1);

            if (!newt) {
                return next(createHttpError(HttpCode.NOT_FOUND, "Newt not found"));
            }

            await removeTargets(
                newt.newtId,
                existingSiteResource.destination,
                existingSiteResource.destinationPort,
                existingSiteResource.protocol,
                existingSiteResource.proxyPort
            );
        }

        logger.info(`Deleted site resource ${siteResourceId} for site ${siteId}`);

        return response(res, {
            data: { message: "Site resource deleted successfully" },
            success: true,
            error: false,
            message: "Site resource deleted successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error("Error deleting site resource:", error);
        return next(createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "Failed to delete site resource"));
    }
}
