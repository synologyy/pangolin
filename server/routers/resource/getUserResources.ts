import { Request, Response, NextFunction } from "express";
import { db } from "@server/db";
import { and, eq, or, inArray } from "drizzle-orm";
import { 
    resources, 
    userResources, 
    roleResources, 
    userOrgs, 
    roles,
    resourcePassword,
    resourcePincode,
    resourceWhitelist,
    sites
} from "@server/db";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import { response } from "@server/lib/response";

export async function getUserResources(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const { orgId } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return next(
                createHttpError(HttpCode.UNAUTHORIZED, "User not authenticated")
            );
        }

        // First get the user's role in the organization
        const userOrgResult = await db
            .select({
                roleId: userOrgs.roleId
            })
            .from(userOrgs)
            .where(
                and(
                    eq(userOrgs.userId, userId),
                    eq(userOrgs.orgId, orgId)
                )
            )
            .limit(1);

        if (userOrgResult.length === 0) {
            return next(
                createHttpError(HttpCode.FORBIDDEN, "User not in organization")
            );
        }

        const userRoleId = userOrgResult[0].roleId;

        // Get resources accessible through direct assignment or role assignment
        const directResourcesQuery = db
            .select({ resourceId: userResources.resourceId })
            .from(userResources)
            .where(eq(userResources.userId, userId));

        const roleResourcesQuery = db
            .select({ resourceId: roleResources.resourceId })
            .from(roleResources)
            .where(eq(roleResources.roleId, userRoleId));

        const [directResources, roleResourceResults] = await Promise.all([
            directResourcesQuery,
            roleResourcesQuery
        ]);

        // Combine all accessible resource IDs
        const accessibleResourceIds = [
            ...directResources.map(r => r.resourceId),
            ...roleResourceResults.map(r => r.resourceId)
        ];

        if (accessibleResourceIds.length === 0) {
            return response(res, {
                data: { resources: [] },
                success: true,
                error: false,
                message: "No resources found",
                status: HttpCode.OK
            });
        }

        // Get resource details for accessible resources
        const resourcesData = await db
            .select({
                resourceId: resources.resourceId,
                name: resources.name,
                fullDomain: resources.fullDomain,
                ssl: resources.ssl,
                enabled: resources.enabled,
                sso: resources.sso,
                protocol: resources.protocol,
                emailWhitelistEnabled: resources.emailWhitelistEnabled,
                siteName: sites.name
            })
            .from(resources)
            .leftJoin(sites, eq(sites.siteId, resources.siteId))
            .where(
                and(
                    inArray(resources.resourceId, accessibleResourceIds),
                    eq(resources.orgId, orgId),
                    eq(resources.enabled, true)
                )
            );

        // Check for password, pincode, and whitelist protection for each resource
        const resourcesWithAuth = await Promise.all(
            resourcesData.map(async (resource) => {
                const [passwordCheck, pincodeCheck, whitelistCheck] = await Promise.all([
                    db.select().from(resourcePassword).where(eq(resourcePassword.resourceId, resource.resourceId)).limit(1),
                    db.select().from(resourcePincode).where(eq(resourcePincode.resourceId, resource.resourceId)).limit(1),
                    db.select().from(resourceWhitelist).where(eq(resourceWhitelist.resourceId, resource.resourceId)).limit(1)
                ]);

                const hasPassword = passwordCheck.length > 0;
                const hasPincode = pincodeCheck.length > 0;
                const hasWhitelist = whitelistCheck.length > 0 || resource.emailWhitelistEnabled;

                return {
                    resourceId: resource.resourceId,
                    name: resource.name,
                    domain: `${resource.ssl ? "https://" : "http://"}${resource.fullDomain}`,
                    enabled: resource.enabled,
                    protected: !!(resource.sso || hasPassword || hasPincode || hasWhitelist),
                    protocol: resource.protocol,
                    sso: resource.sso,
                    password: hasPassword,
                    pincode: hasPincode,
                    whitelist: hasWhitelist,
                    siteName: resource.siteName
                };
            })
        );

        return response(res, {
            data: { resources: resourcesWithAuth },
            success: true,
            error: false,
            message: "User resources retrieved successfully",
            status: HttpCode.OK
        });

    } catch (error) {
        console.error("Error fetching user resources:", error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "Internal server error")
        );
    }
}

export type GetUserResourcesResponse = {
    success: boolean;
    data: {
        resources: Array<{
            resourceId: number;
            name: string;
            domain: string;
            enabled: boolean;
            protected: boolean;
            protocol: string;
        }>;
    };
}; 