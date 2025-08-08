import { db, newts } from "@server/db";
import { orgs, roleSites, sites, userSites } from "@server/db";
import logger from "@server/logger";
import HttpCode from "@server/types/HttpCode";
import response from "@server/lib/response";
import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";
import NodeCache from "node-cache";
import semver from "semver";

const newtVersionCache = new NodeCache({ stdTTL: 3600 }); // 1 hours in seconds

async function getLatestNewtVersion(): Promise<string | null> {
    try {
        const cachedVersion = newtVersionCache.get<string>("latestNewtVersion");
        if (cachedVersion) {
            return cachedVersion;
        }

        const response = await fetch(
            "https://api.github.com/repos/fosrl/newt/tags"
        );
        if (!response.ok) {
            logger.warn("Failed to fetch latest Newt version from GitHub");
            return null;
        }

        const tags = await response.json();
        if (!Array.isArray(tags) || tags.length === 0) {
            logger.warn("No tags found for Newt repository");
            return null;
        }

        const latestVersion = tags[0].name;

        newtVersionCache.set("latestNewtVersion", latestVersion);

        return latestVersion;
    } catch (error) {
        logger.error("Error fetching latest Newt version:", error);
        return null;
    }
}

const listSitesParamsSchema = z
    .object({
        orgId: z.string()
    })
    .strict();

const listSitesSchema = z.object({
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

function querySites(orgId: string, accessibleSiteIds: number[]) {
    return db
        .select({
            siteId: sites.siteId,
            niceId: sites.niceId,
            name: sites.name,
            pubKey: sites.pubKey,
            subnet: sites.subnet,
            megabytesIn: sites.megabytesIn,
            megabytesOut: sites.megabytesOut,
            orgName: orgs.name,
            type: sites.type,
            online: sites.online,
            address: sites.address,
            newtVersion: newts.version
        })
        .from(sites)
        .leftJoin(orgs, eq(sites.orgId, orgs.orgId))
        .leftJoin(newts, eq(newts.siteId, sites.siteId))
        .where(
            and(
                inArray(sites.siteId, accessibleSiteIds),
                eq(sites.orgId, orgId)
            )
        );
}

type SiteWithUpdateAvailable = Awaited<ReturnType<typeof querySites>>[0] & {
    newtUpdateAvailable?: boolean;
};

export type ListSitesResponse = {
    sites: SiteWithUpdateAvailable[];
    pagination: { total: number; limit: number; offset: number };
};

registry.registerPath({
    method: "get",
    path: "/org/{orgId}/sites",
    description: "List all sites in an organization",
    tags: [OpenAPITags.Org, OpenAPITags.Site],
    request: {
        params: listSitesParamsSchema,
        query: listSitesSchema
    },
    responses: {}
});

export async function listSites(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedQuery = listSitesSchema.safeParse(req.query);
        if (!parsedQuery.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedQuery.error)
                )
            );
        }
        const { limit, offset } = parsedQuery.data;

        const parsedParams = listSitesParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error)
                )
            );
        }
        const { orgId } = parsedParams.data;

        if (req.user && orgId && orgId !== req.userOrgId) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    "User does not have access to this organization"
                )
            );
        }

        let accessibleSites;
        if (req.user) {
            accessibleSites = await db
                .select({
                    siteId: sql<number>`COALESCE(${userSites.siteId}, ${roleSites.siteId})`
                })
                .from(userSites)
                .fullJoin(roleSites, eq(userSites.siteId, roleSites.siteId))
                .where(
                    or(
                        eq(userSites.userId, req.user!.userId),
                        eq(roleSites.roleId, req.userOrgRoleId!)
                    )
                );
        } else {
            accessibleSites = await db
                .select({ siteId: sites.siteId })
                .from(sites)
                .where(eq(sites.orgId, orgId));
        }

        const accessibleSiteIds = accessibleSites.map((site) => site.siteId);
        const baseQuery = querySites(orgId, accessibleSiteIds);

        let countQuery = db
            .select({ count: count() })
            .from(sites)
            .where(
                and(
                    inArray(sites.siteId, accessibleSiteIds),
                    eq(sites.orgId, orgId)
                )
            );

        const sitesList = await baseQuery.limit(limit).offset(offset);
        const totalCountResult = await countQuery;
        const totalCount = totalCountResult[0].count;

        const latestNewtVersion = await getLatestNewtVersion();

        const sitesWithUpdates: SiteWithUpdateAvailable[] = sitesList.map(
            (site) => {
                const siteWithUpdate: SiteWithUpdateAvailable = { ...site };

                if (
                    site.type === "newt" &&
                    site.newtVersion &&
                    latestNewtVersion
                ) {
                    try {
                        siteWithUpdate.newtUpdateAvailable = semver.lt(
                            site.newtVersion,
                            latestNewtVersion
                        );
                    } catch (error) {
                        siteWithUpdate.newtUpdateAvailable = false;
                    }
                } else {
                    siteWithUpdate.newtUpdateAvailable = false;
                }

                return siteWithUpdate;
            }
        );

        return response<ListSitesResponse>(res, {
            data: {
                sites: sitesWithUpdates,
                pagination: {
                    total: totalCount,
                    limit,
                    offset
                }
            },
            success: true,
            error: false,
            message: "Sites retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
