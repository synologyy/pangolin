import { Request, Response, NextFunction } from "express";
import { db } from "@server/db";
import { resources, userOrgs, userResources, roleResources } from "@server/db";
import { and, eq } from "drizzle-orm";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import { checkOrgAccessPolicy } from "#dynamic/lib/checkOrgAccessPolicy";

export async function verifyResourceAccess(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const userId = req.user!.userId;
    const resourceId =
        req.params.resourceId || req.body.resourceId || req.query.resourceId;

    if (!userId) {
        return next(
            createHttpError(HttpCode.UNAUTHORIZED, "User not authenticated")
        );
    }

    try {
        const resource = await db
            .select()
            .from(resources)
            .where(eq(resources.resourceId, resourceId))
            .limit(1);

        if (resource.length === 0) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Resource with ID ${resourceId} not found`
                )
            );
        }

        if (!resource[0].orgId) {
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    `Resource with ID ${resourceId} does not have an organization ID`
                )
            );
        }

        if (!req.userOrg) {
            const userOrgRole = await db
                .select()
                .from(userOrgs)
                .where(
                    and(
                        eq(userOrgs.userId, userId),
                        eq(userOrgs.orgId, resource[0].orgId)
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
        req.userOrgId = resource[0].orgId;

        const roleResourceAccess = await db
            .select()
            .from(roleResources)
            .where(
                and(
                    eq(roleResources.resourceId, resourceId),
                    eq(roleResources.roleId, userOrgRoleId)
                )
            )
            .limit(1);

        if (roleResourceAccess.length > 0) {
            return next();
        }

        const userResourceAccess = await db
            .select()
            .from(userResources)
            .where(
                and(
                    eq(userResources.userId, userId),
                    eq(userResources.resourceId, resourceId)
                )
            )
            .limit(1);

        if (userResourceAccess.length > 0) {
            return next();
        }

        return next(
            createHttpError(
                HttpCode.FORBIDDEN,
                "User does not have access to this resource"
            )
        );
    } catch (error) {
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Error verifying resource access"
            )
        );
    }
}
