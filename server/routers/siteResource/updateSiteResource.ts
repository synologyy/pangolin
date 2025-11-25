import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
    clientSiteResources,
    db,
    newts,
    roles,
    roleSiteResources,
    sites,
    userSiteResources
} from "@server/db";
import { siteResources, SiteResource } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import { eq, and, ne } from "drizzle-orm";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";
import { OpenAPITags, registry } from "@server/openApi";
import { updatePeerData, updateTargets } from "@server/routers/client/targets";
import {
    generateAliasConfig,
    generateRemoteSubnets,
    generateSubnetProxyTargets
} from "@server/lib/ip";
import {
    getClientSiteResourceAccess,
    rebuildClientAssociations
} from "@server/lib/rebuildClientAssociations";

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
        // protocol: z.enum(["tcp", "udp"]).nullish(),
        // proxyPort: z.int().positive().nullish(),
        // destinationPort: z.int().positive().nullish(),
        destination: z.string().min(1).optional(),
        enabled: z.boolean().optional(),
        alias: z.string().nullish(),
        userIds: z.array(z.string()),
        roleIds: z.array(z.int()),
        clientIds: z.array(z.int())
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
        const {
            name,
            mode,
            destination,
            alias,
            enabled,
            userIds,
            roleIds,
            clientIds
        } = parsedBody.data;

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

        let updatedSiteResource: SiteResource | undefined;
        await db.transaction(async (trx) => {
            // Update the site resource
            [updatedSiteResource] = await trx
                .update(siteResources)
                .set({
                    name: name,
                    mode: mode,
                    destination: destination,
                    enabled: enabled,
                    alias: alias && alias.trim() ? alias : null
                })
                .where(
                    and(
                        eq(siteResources.siteResourceId, siteResourceId),
                        eq(siteResources.siteId, siteId),
                        eq(siteResources.orgId, orgId)
                    )
                )
                .returning();

            //////////////////// update the associations ////////////////////

            await trx
                .delete(clientSiteResources)
                .where(eq(clientSiteResources.siteResourceId, siteResourceId));

            if (clientIds.length > 0) {
                await trx.insert(clientSiteResources).values(
                    clientIds.map((clientId) => ({
                        clientId,
                        siteResourceId
                    }))
                );
            }

            await trx
                .delete(userSiteResources)
                .where(eq(userSiteResources.siteResourceId, siteResourceId));

            if (userIds.length > 0) {
                await trx
                    .insert(userSiteResources)
                    .values(
                        userIds.map((userId) => ({ userId, siteResourceId }))
                    );
            }

            // Get all admin role IDs for this org to exclude from deletion
            const adminRoles = await trx
                .select()
                .from(roles)
                .where(
                    and(
                        eq(roles.isAdmin, true),
                        eq(roles.orgId, updatedSiteResource.orgId)
                    )
                );
            const adminRoleIds = adminRoles.map((role) => role.roleId);

            if (adminRoleIds.length > 0) {
                await trx.delete(roleSiteResources).where(
                    and(
                        eq(roleSiteResources.siteResourceId, siteResourceId),
                        ne(roleSiteResources.roleId, adminRoleIds[0]) // delete all but the admin role
                    )
                );
            } else {
                await trx
                    .delete(roleSiteResources)
                    .where(
                        eq(roleSiteResources.siteResourceId, siteResourceId)
                    );
            }

            if (roleIds.length > 0) {
                await trx
                    .insert(roleSiteResources)
                    .values(
                        roleIds.map((roleId) => ({ roleId, siteResourceId }))
                    );
            }

            const { mergedAllClients } = await rebuildClientAssociations(
                existingSiteResource, // we want to rebuild based on the existing resource then we will apply the change to the destination below
                trx
            );

            // after everything is rebuilt above we still need to update the targets and remote subnets if the destination changed
            if (
                existingSiteResource.destination !==
                updatedSiteResource.destination
            ) {
                const [newt] = await trx
                    .select()
                    .from(newts)
                    .where(eq(newts.siteId, site.siteId))
                    .limit(1);

                if (!newt) {
                    return next(
                        createHttpError(HttpCode.NOT_FOUND, "Newt not found")
                    );
                }

                const oldTargets = generateSubnetProxyTargets(
                    existingSiteResource,
                    mergedAllClients
                );
                const newTargets = generateSubnetProxyTargets(
                    updatedSiteResource,
                    mergedAllClients
                );

                await updateTargets(newt.newtId, {
                    oldTargets: oldTargets,
                    newTargets: newTargets
                });

                let olmJobs: Promise<void>[] = [];
                for (const client of mergedAllClients) {
                    // we also need to update the remote subnets on the olms for each client that has access to this site
                    olmJobs.push(
                        updatePeerData(
                            client.clientId,
                            updatedSiteResource.siteId,
                            {
                                oldRemoteSubnets: generateRemoteSubnets([
                                    existingSiteResource
                                ]),
                                newRemoteSubnets: generateRemoteSubnets([
                                    updatedSiteResource
                                ])
                            },
                            {
                                oldAliases: generateAliasConfig([
                                    existingSiteResource
                                ]),
                                newAliases: generateAliasConfig([
                                    updatedSiteResource
                                ])
                            }
                        )
                    );
                }

                await Promise.all(olmJobs);
            }

            logger.info(
                `Updated site resource ${siteResourceId} for site ${siteId}`
            );
        });

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
