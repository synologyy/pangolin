/*
 * This file is part of a proprietary work.
 *
 * Copyright (c) 2025 Fossorial, Inc.
 * All rights reserved.
 *
 * This file is licensed under the Fossorial Commercial License.
 * You may not use this file except in compliance with the License.
 * Unauthorized use, copying, modification, or distribution is strictly prohibited.
 *
 * This file is not licensed under the AGPLv3.
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
    db,
    idpOrg,
    loginPage,
    loginPageBranding,
    loginPageBrandingOrg,
    loginPageOrg,
    resources
} from "@server/db";
import { eq, and, type InferSelectModel } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import type { LoadLoginPageBrandingResponse } from "@server/routers/loginPage/types";

const querySchema = z.object({
    resourceId: z.coerce.number().int().positive().optional(),
    idpId: z.coerce.number().int().positive().optional(),
    orgId: z.string().min(1).optional(),
    fullDomain: z.string().min(1).optional()
});

async function query(orgId?: string, fullDomain?: string) {
    let orgLink: InferSelectModel<typeof loginPageBrandingOrg> | null = null;
    if (orgId !== undefined) {
        [orgLink] = await db
            .select()
            .from(loginPageBrandingOrg)
            .where(eq(loginPageBrandingOrg.orgId, orgId));
    } else if (fullDomain) {
        const [res] = await db
            .select()
            .from(loginPage)
            .where(eq(loginPage.fullDomain, fullDomain))
            .innerJoin(
                loginPageOrg,
                eq(loginPage.loginPageId, loginPageOrg.loginPageId)
            )
            .innerJoin(
                loginPageBrandingOrg,
                eq(loginPageBrandingOrg.orgId, loginPageOrg.orgId)
            )
            .limit(1);

        orgLink = res.loginPageBrandingOrg;
    }

    if (!orgLink) {
        return null;
    }

    const [res] = await db
        .select()
        .from(loginPageBranding)
        .where(
            and(
                eq(
                    loginPageBranding.loginPageBrandingId,
                    orgLink.loginPageBrandingId
                )
            )
        )
        .limit(1);
    return {
        ...res,
        orgId: orgLink.orgId
    };
}

export async function loadLoginPageBranding(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedQuery = querySchema.safeParse(req.query);
        if (!parsedQuery.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedQuery.error).toString()
                )
            );
        }

        const { resourceId, idpId, fullDomain } = parsedQuery.data;

        let orgId: string | undefined = undefined;
        if (resourceId) {
            const [resource] = await db
                .select()
                .from(resources)
                .where(eq(resources.resourceId, resourceId))
                .limit(1);

            if (!resource) {
                return next(
                    createHttpError(HttpCode.NOT_FOUND, "Resource not found")
                );
            }

            orgId = resource.orgId;
        } else if (idpId) {
            const [idpOrgLink] = await db
                .select()
                .from(idpOrg)
                .where(eq(idpOrg.idpId, idpId));

            if (!idpOrgLink) {
                return next(
                    createHttpError(HttpCode.NOT_FOUND, "IdP not found")
                );
            }

            orgId = idpOrgLink.orgId;
        } else if (parsedQuery.data.orgId) {
            orgId = parsedQuery.data.orgId;
        }

        const branding = await query(orgId, fullDomain);

        if (!branding) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    "Branding for Login page not found"
                )
            );
        }

        return response<LoadLoginPageBrandingResponse>(res, {
            data: branding,
            success: true,
            error: false,
            message: "Login page branding retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
