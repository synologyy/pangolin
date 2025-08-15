import { Request, Response, NextFunction } from "express";
import { db } from "@server/db";
import { siteResources } from "@server/db";
import { eq, and } from "drizzle-orm";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import logger from "@server/logger";

export async function verifySiteResourceAccess(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const siteResourceId = parseInt(req.params.siteResourceId);
        const siteId = parseInt(req.params.siteId);
        const orgId = req.params.orgId;

        if (!siteResourceId || !siteId || !orgId) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    "Missing required parameters"
                )
            );
        }

        // Check if the site resource exists and belongs to the specified site and org
        const [siteResource] = await db
            .select()
            .from(siteResources)
            .where(and(
                eq(siteResources.siteResourceId, siteResourceId),
                eq(siteResources.siteId, siteId),
                eq(siteResources.orgId, orgId)
            ))
            .limit(1);

        if (!siteResource) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    "Site resource not found"
                )
            );
        }

        // Attach the siteResource to the request for use in the next middleware/route
        // @ts-ignore - Extending Request type
        req.siteResource = siteResource;

        next();
    } catch (error) {
        logger.error("Error verifying site resource access:", error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Error verifying site resource access"
            )
        );
    }
}
