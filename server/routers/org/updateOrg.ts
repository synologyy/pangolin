import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { orgs } from "@server/db";
import { eq } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";
import { build } from "@server/build";
import { getOrgTierData } from "@server/lib/billing";
import { TierId } from "@server/lib/billing/tiers";

const updateOrgParamsSchema = z
    .object({
        orgId: z.string()
    })
    .strict();

const updateOrgBodySchema = z
    .object({
        name: z.string().min(1).max(255).optional(),
        settingsLogRetentionDaysRequest: z
            .number()
            .min(build === "saas" ? 0 : -1)
            .optional(),
        settingsLogRetentionDaysAccess: z
            .number()
            .min(build === "saas" ? 0 : -1)
            .optional(),
        settingsLogRetentionDaysAction: z
            .number()
            .min(build === "saas" ? 0 : -1)
            .optional()
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

        const { tier } = await getOrgTierData(orgId); // returns null in oss
        if (
            tier != TierId.STANDARD &&
            parsedBody.data.settingsLogRetentionDaysRequest &&
            parsedBody.data.settingsLogRetentionDaysRequest > 30
        ) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    "You are not allowed to set log retention days greater than 30 because you are not subscribed to the Standard tier"
                )
            );
        }

        const updatedOrg = await db
            .update(orgs)
            .set({
                ...parsedBody.data
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
