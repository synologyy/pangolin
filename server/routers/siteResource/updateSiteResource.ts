import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db, newts, sites } from "@server/db";
import { siteResources, SiteResource } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import { eq, and } from "drizzle-orm";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";
import { OpenAPITags, registry } from "@server/openApi";
import { addTargets } from "../client/targets";

const updateSiteResourceParamsSchema = z
    .object({
        siteResourceId: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive()),
        siteId: z.string().transform(Number).pipe(z.number().int().positive()),
        orgId: z.string()
    })
    .strict();

const updateSiteResourceSchema = z
    .object({
        name: z.string().min(1).max(255).optional(),
        protocol: z.enum(["tcp", "udp"]).optional(),
        proxyPort: z.number().int().positive().optional(),
        destinationPort: z.number().int().positive().optional(),
        destinationIp: z.string().ip().optional(),
        enabled: z.boolean().optional()
    })
    .strict();

export type UpdateSiteResourceBody = z.infer<typeof updateSiteResourceSchema>;
export type UpdateSiteResourceResponse = SiteResource;

registry.registerPath({
    method: "post",
    path: "/org/{orgId}/site/{siteId}/resource/{siteResourceId}",
    description: "Update a site resource.",
    tags: [OpenAPITags.Client, OpenAPITags.Org],
    request: {
        params: updateSiteResourceParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: updateSiteResourceSchema
                }
            }
        }
    },
    responses: {}
});

export async function updateSiteResource(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = updateSiteResourceParamsSchema.safeParse(
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

        const parsedBody = updateSiteResourceSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { siteResourceId, siteId, orgId } = parsedParams.data;
        const updateData = parsedBody.data;

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
            .where(
                and(
                    eq(siteResources.siteResourceId, siteResourceId),
                    eq(siteResources.siteId, siteId),
                    eq(siteResources.orgId, orgId)
                )
            )
            .limit(1);

        if (!existingSiteResource) {
            return next(
                createHttpError(HttpCode.NOT_FOUND, "Site resource not found")
            );
        }

        const protocol = updateData.protocol || existingSiteResource.protocol;
        const proxyPort =
            updateData.proxyPort || existingSiteResource.proxyPort;

        // check if resource with same protocol and proxy port already exists
        const [existingResource] = await db
            .select()
            .from(siteResources)
            .where(
                and(
                    eq(siteResources.siteId, siteId),
                    eq(siteResources.orgId, orgId),
                    eq(siteResources.protocol, protocol),
                    eq(siteResources.proxyPort, proxyPort)
                )
            )
            .limit(1);
        if (
            existingResource &&
            existingResource.siteResourceId !== siteResourceId
        ) {
            return next(
                createHttpError(
                    HttpCode.CONFLICT,
                    "A resource with the same protocol and proxy port already exists"
                )
            );
        }

        // Update the site resource
        const [updatedSiteResource] = await db
            .update(siteResources)
            .set(updateData)
            .where(
                and(
                    eq(siteResources.siteResourceId, siteResourceId),
                    eq(siteResources.siteId, siteId),
                    eq(siteResources.orgId, orgId)
                )
            )
            .returning();

        const [newt] = await db
            .select()
            .from(newts)
            .where(eq(newts.siteId, site.siteId))
            .limit(1);

        if (!newt) {
            return next(createHttpError(HttpCode.NOT_FOUND, "Newt not found"));
        }

        await addTargets(
            newt.newtId,
            updatedSiteResource.destinationIp,
            updatedSiteResource.destinationPort,
            updatedSiteResource.protocol
        );

        logger.info(
            `Updated site resource ${siteResourceId} for site ${siteId}`
        );

        return response(res, {
            data: updatedSiteResource,
            success: true,
            error: false,
            message: "Site resource updated successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error("Error updating site resource:", error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to update site resource"
            )
        );
    }
}
