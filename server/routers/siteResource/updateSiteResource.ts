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
import { updateTargets } from "@server/routers/client/targets";
import { generateSubnetProxyTargets } from "@server/lib/ip";

const updateSiteResourceParamsSchema = z.strictObject({
    siteResourceId: z.string().transform(Number).pipe(z.int().positive()),
    siteId: z.string().transform(Number).pipe(z.int().positive()),
    orgId: z.string()
});

const updateSiteResourceSchema = z
    .strictObject({
        name: z.string().min(1).max(255).optional(),
        // mode: z.enum(["host", "cidr", "port"]).optional(),
        mode: z.enum(["host", "cidr"]).optional(),
        protocol: z.enum(["tcp", "udp"]).nullish(),
        // proxyPort: z.int().positive().nullish(),
        // destinationPort: z.int().positive().nullish(),
        destination: z.string().min(1).optional(),
        enabled: z.boolean().optional(),
        alias: z.string().nullish()
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

        // Determine the final mode and validate port mode requirements
        const finalMode = updateData.mode || existingSiteResource.mode;
        const finalProtocol = updateData.protocol !== undefined ? updateData.protocol : existingSiteResource.protocol;
        // const finalProxyPort = updateData.proxyPort !== undefined ? updateData.proxyPort : existingSiteResource.proxyPort;
        // const finalDestinationPort = updateData.destinationPort !== undefined ? updateData.destinationPort : existingSiteResource.destinationPort;

        // Prepare update data
        const updateValues: any = {};
        if (updateData.name !== undefined) updateValues.name = updateData.name;
        if (updateData.mode !== undefined) updateValues.mode = updateData.mode;
        if (updateData.destination !== undefined)
            updateValues.destination = updateData.destination;
        if (updateData.enabled !== undefined)
            updateValues.enabled = updateData.enabled;

        // Handle nullish fields (can be undefined, null, or a value)
        if (updateData.alias !== undefined) {
            updateValues.alias =
                updateData.alias && updateData.alias.trim()
                    ? updateData.alias
                    : null;
        }

        // Handle port mode fields - include in update if explicitly provided (null or value) or if mode changed
        // const isModeChangingFromPort =
        //     existingSiteResource.mode === "port" &&
        //     updateData.mode &&
        //     updateData.mode !== "port";

        // if (updateData.protocol !== undefined || isModeChangingFromPort) {
        //     updateValues.protocol = finalMode === "port" ? finalProtocol : null;
        // }
        // if (updateData.proxyPort !== undefined || isModeChangingFromPort) {
        //     updateValues.proxyPort =
        //         finalMode === "port" ? finalProxyPort : null;
        // }
        // if (
        //     updateData.destinationPort !== undefined ||
        //     isModeChangingFromPort
        // ) {
        //     updateValues.destinationPort =
        //         finalMode === "port" ? finalDestinationPort : null;
        // }

        // Update the site resource
        const [updatedSiteResource] = await db
            .update(siteResources)
            .set(updateValues)
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

        const oldTargets = await generateSubnetProxyTargets([existingSiteResource]);
        const newTargets = await generateSubnetProxyTargets([updatedSiteResource]);

        await updateTargets(newt.newtId, {
            oldTargets: oldTargets,
            newTargets: newTargets
        });

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
