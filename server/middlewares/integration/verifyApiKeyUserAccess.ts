import { Request, Response, NextFunction } from "express";
import { db } from "@server/db";
import { userOrgs } from "@server/db";
import { and, eq } from "drizzle-orm";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";

export async function verifyApiKeyUserAccess(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const apiKey = req.apiKey;
        const reqUserId =
            req.params.userId || req.body.userId || req.query.userId;

        if (!apiKey) {
            return next(
                createHttpError(HttpCode.UNAUTHORIZED, "Key not authenticated")
            );
        }

        if (!reqUserId) {
            return next(
                createHttpError(HttpCode.BAD_REQUEST, "Invalid user ID")
            );
        }

        if (apiKey.isRoot) {
            // Root keys can access any key in any org
            return next();
        }

        if (!req.apiKeyOrg || !req.apiKeyOrg.orgId) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    "Key does not have organization access"
                )
            );
        }

        const orgId = req.apiKeyOrg.orgId;

        const [userOrgRecord] = await db
            .select()
            .from(userOrgs)
            .where(
                and(eq(userOrgs.userId, reqUserId), eq(userOrgs.orgId, orgId))
            )
            .limit(1);

        if (!userOrgRecord) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    "Key does not have access to this user"
                )
            );
        }

        return next();
    } catch (error) {
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Error checking if key has access to this user"
            )
        );
    }
}
