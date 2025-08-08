import { Request, Response, NextFunction } from "express";
import { db } from "@server/db";
import { userOrgs, clients, roleClients, userClients } from "@server/db";
import { and, eq } from "drizzle-orm";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";

export async function verifyClientAccess(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const userId = req.user!.userId; // Assuming you have user information in the request
    const clientId = parseInt(
        req.params.clientId || req.body.clientId || req.query.clientId
    );

    if (!userId) {
        return next(
            createHttpError(HttpCode.UNAUTHORIZED, "User not authenticated")
        );
    }

    if (isNaN(clientId)) {
        return next(createHttpError(HttpCode.BAD_REQUEST, "Invalid client ID"));
    }

    try {
        // Get the client
        const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.clientId, clientId))
            .limit(1);

        if (!client) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Client with ID ${clientId} not found`
                )
            );
        }

        if (!client.orgId) {
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    `Client with ID ${clientId} does not have an organization ID`
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
                        eq(userOrgs.orgId, client.orgId)
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
        req.userOrgId = client.orgId;

        // Check role-based site access first
        const [roleClientAccess] = await db
            .select()
            .from(roleClients)
            .where(
                and(
                    eq(roleClients.clientId, clientId),
                    eq(roleClients.roleId, userOrgRoleId)
                )
            )
            .limit(1);

        if (roleClientAccess) {
            // User has access to the site through their role
            return next();
        }

        // If role doesn't have access, check user-specific site access
        const [userClientAccess] = await db
            .select()
            .from(userClients)
            .where(
                and(
                    eq(userClients.userId, userId),
                    eq(userClients.clientId, clientId)
                )
            )
            .limit(1);

        if (userClientAccess) {
            // User has direct access to the site
            return next();
        }

        // If we reach here, the user doesn't have access to the site
        return next(
            createHttpError(
                HttpCode.FORBIDDEN,
                "User does not have access to this client"
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
