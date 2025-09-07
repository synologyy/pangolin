import { Request, Response, NextFunction } from "express";
import { db } from "@server/db";
import { userOrgs } from "@server/db";
import { and, eq, inArray } from "drizzle-orm";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";

export async function verifyApiKeySetResourceUsers(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const apiKey = req.apiKey;
    const userIds = req.body.userIds;

    if (!apiKey) {
        return next(
            createHttpError(HttpCode.UNAUTHORIZED, "Key not authenticated")
        );
    }

    if (apiKey.isRoot) {
        // Root keys can access any key in any org
        return next();
    }

    if (!req.apiKeyOrg) {
        return next(
            createHttpError(
                HttpCode.FORBIDDEN,
                "Key does not have access to this organization"
            )
        );
    }

    if (!userIds) {
        return next(createHttpError(HttpCode.BAD_REQUEST, "Invalid user IDs"));
    }

    if (userIds.length === 0) {
        return next();
    }

    try {
        const orgId = req.apiKeyOrg.orgId;
        const userOrgsData = await db
            .select()
            .from(userOrgs)
            .where(
                and(
                    inArray(userOrgs.userId, userIds),
                    eq(userOrgs.orgId, orgId)
                )
            );

        if (userOrgsData.length !== userIds.length) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    "Key does not have access to one or more specified users"
                )
            );
        }

        return next();
    } catch (error) {
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Error checking if key has access to the specified users"
            )
        );
    }
}
