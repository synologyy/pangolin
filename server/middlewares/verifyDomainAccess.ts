import { Request, Response, NextFunction } from "express";
import { db, domains, orgDomains } from "@server/db";
import { userOrgs, apiKeyOrg } from "@server/db";
import { and, eq } from "drizzle-orm";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";

export async function verifyDomainAccess(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user!.userId;
        const domainId =
            req.params.domainId || req.body.apiKeyId || req.query.apiKeyId;
        const orgId = req.params.orgId;

        if (!userId) {
            return next(
                createHttpError(HttpCode.UNAUTHORIZED, "User not authenticated")
            );
        }

        if (!orgId) {
            return next(
                createHttpError(HttpCode.BAD_REQUEST, "Invalid organization ID")
            );
        }

        if (!domainId) {
            return next(
                createHttpError(HttpCode.BAD_REQUEST, "Invalid domain ID")
            );
        }

        const [domain] = await db
            .select()
            .from(domains)
            .innerJoin(orgDomains, eq(orgDomains.domainId, domains.domainId))
            .where(
                and(
                    eq(orgDomains.domainId, domainId),
                    eq(orgDomains.orgId, orgId)
                )
            )
            .limit(1);

        if (!domain.orgDomains) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Domain with ID ${domainId} not found`
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
                        eq(userOrgs.orgId, apiKeyOrg.orgId)
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

        const userOrgRoleId = req.userOrg.roleId;
        req.userOrgRoleId = userOrgRoleId;

        return next();
    } catch (error) {
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Error verifying domain access"
            )
        );
    }
}
