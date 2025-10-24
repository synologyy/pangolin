import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { orgs, users } from "@server/db";
import { eq } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";
import { build } from "@server/build";
import { UserType } from "@server/types/UserTypes";
import license from "#dynamic/license/license";
import { getOrgTierData } from "#dynamic/lib/billing";
import { TierId } from "@server/lib/billing/tiers";

const updateOrgParamsSchema = z
    .object({
        orgId: z.string()
    })
    .strict();

const updateOrgBodySchema = z
    .object({
        name: z.string().min(1).max(255).optional(),
        requireTwoFactor: z.boolean().optional()
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided for update"
    });

registry.registerPath({
    method: "post",
    path: "/org/{orgId}",
    description: "Update an organization",
    tags: [OpenAPITags.Org],
    request: {
        params: updateOrgParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: updateOrgBodySchema
                }
            }
        }
    },
    responses: {}
});

export async function updateOrg(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = updateOrgParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const parsedBody = updateOrgBodySchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { orgId } = parsedParams.data;

        const isLicensed = await isLicensedOrSubscribed(orgId);
        if (!isLicensed) {
            parsedBody.data.requireTwoFactor = undefined;
        }

        if (
            req.user &&
            req.user.type === UserType.Internal &&
            parsedBody.data.requireTwoFactor === true &&
            !req.user.twoFactorEnabled
        ) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    "You must enable two-factor authentication for your account before enforcing it for all users"
                )
            );
        }

        const updatedOrg = await db
            .update(orgs)
            .set({
                name: parsedBody.data.name,
                requireTwoFactor: parsedBody.data.requireTwoFactor
            })
            .where(eq(orgs.orgId, orgId))
            .returning();

        if (updatedOrg.length === 0) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Organization with ID ${orgId} not found`
                )
            );
        }

        return response(res, {
            data: updatedOrg[0],
            success: true,
            error: false,
            message: "Organization updated successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}

async function isLicensedOrSubscribed(orgId: string): Promise<boolean> {
    if (build === "enterprise") {
        const isUnlocked = await license.isUnlocked();
        if (!isUnlocked) {
            return false;
        }
    }

    if (build === "saas") {
        const { tier } = await getOrgTierData(orgId);
        const subscribed = tier === TierId.STANDARD;
        if (!subscribed) {
            return false;
        }
    }

    return true;
}
