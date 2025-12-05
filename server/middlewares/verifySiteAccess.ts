import { Request, Response, NextFunction } from "express";
import { db } from "@server/db";
import { sites, userOrgs, userSites, roleSites, roles } from "@server/db";
import { and, eq, or } from "drizzle-orm";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import logger from "@server/logger";
import { checkOrgAccessPolicy } from "#dynamic/lib/checkOrgAccessPolicy";

export async function verifySiteAccess(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const userId = req.user!.userId; // Assuming you have user information in the request
    const siteId = parseInt(
        req.params.siteId || req.body.siteId || req.query.siteId
    );

    if (!userId) {
        return next(
            createHttpError(HttpCode.UNAUTHORIZED, "User not authenticated")
        );
    }

    if (isNaN(siteId)) {
        return next(createHttpError(HttpCode.BAD_REQUEST, "Invalid site ID"));
    }

    try {
        // Get the site
        const site = await db
            .select()
            .from(sites)
            .where(eq(sites.siteId, siteId))
            .limit(1);

        if (site.length === 0) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Site with ID ${siteId} not found`
                )
            );
        }

        if (!site[0].orgId) {
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    `Site with ID ${siteId} does not have an organization ID`
                )
            );
        }

        if (!req.userOrg) {
            // Get user's role ID in the organization
            const userOrgRole = await db
                .select()
                .from(userOrgs)
                .where(
                    and(
                        eq(userOrgs.userId, userId),
                        eq(userOrgs.orgId, site[0].orgId)
                    )
                )
                .limit(1);
            req.userOrg = userOrgRole[0];
        }

        if (!req.userOrg) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    "User does not have access to this organization"
                )
            );
        }

        if (req.orgPolicyAllowed === undefined && req.userOrg.orgId) {
            const policyCheck = await checkOrgAccessPolicy({
                orgId: req.userOrg.orgId,
                userId,
                session: req.session
            });
            req.orgPolicyAllowed = policyCheck.allowed;
            if (!policyCheck.allowed || policyCheck.error) {
                return next(
                    createHttpError(
                        HttpCode.FORBIDDEN,
                        "Failed organization access policy check: " +
                            (policyCheck.error || "Unknown error")
                    )
                );
            }
        }

        const userOrgRoleId = req.userOrg.roleId;
        req.userOrgRoleId = userOrgRoleId;
        req.userOrgId = site[0].orgId;

        // Check role-based site access first
        const roleSiteAccess = await db
            .select()
            .from(roleSites)
            .where(
                and(
                    eq(roleSites.siteId, siteId),
                    eq(roleSites.roleId, userOrgRoleId)
                )
            )
            .limit(1);

        if (roleSiteAccess.length > 0) {
            // User's role has access to the site
            return next();
        }

        // If role doesn't have access, check user-specific site access
        const userSiteAccess = await db
            .select()
            .from(userSites)
            .where(
                and(eq(userSites.userId, userId), eq(userSites.siteId, siteId))
            )
            .limit(1);

        if (userSiteAccess.length > 0) {
            // User has direct access to the site
            return next();
        }

        // If we reach here, the user doesn't have access to the site
        return next(
            createHttpError(
                HttpCode.FORBIDDEN,
                "User does not have access to this site"
            )
        );
    } catch (error) {
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Error verifying site access"
            )
        );
    }
}
