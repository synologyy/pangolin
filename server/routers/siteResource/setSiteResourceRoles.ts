import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db, siteResources } from "@server/db";
import { roleSiteResources, roles } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { eq, and, ne } from "drizzle-orm";
import { OpenAPITags, registry } from "@server/openApi";
import { rebuildSiteClientAssociations } from "@server/lib/rebuildSiteClientAssociations";

const setSiteResourceRolesBodySchema = z
    .object({
        roleIds: z.array(z.number().int().positive())
    })
    .strict();

const setSiteResourceRolesParamsSchema = z
    .object({
        siteResourceId: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive())
    })
    .strict();

registry.registerPath({
    method: "post",
    path: "/site-resource/{siteResourceId}/roles",
    description:
        "Set roles for a site resource. This will replace all existing roles.",
    tags: [OpenAPITags.Resource, OpenAPITags.Role],
    request: {
        params: setSiteResourceRolesParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: setSiteResourceRolesBodySchema
                }
            }
        }
    },
    responses: {}
});

export async function setSiteResourceRoles(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedBody = setSiteResourceRolesBodySchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { roleIds } = parsedBody.data;

        const parsedParams = setSiteResourceRolesParamsSchema.safeParse(
            req.params
        );
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { siteResourceId } = parsedParams.data;

        // get the site resource
        const [siteResource] = await db
            .select()
            .from(siteResources)
            .where(eq(siteResources.siteResourceId, siteResourceId))
            .limit(1);

        if (!siteResource) {
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    "Site resource not found"
                )
            );
        }

        // get this org's admin role
        const adminRole = await db
            .select()
            .from(roles)
            .where(
                and(
                    eq(roles.name, "Admin"),
                    eq(roles.orgId, siteResource.orgId)
                )
            )
            .limit(1);

        if (!adminRole.length) {
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    "Admin role not found"
                )
            );
        }

        if (roleIds.includes(adminRole[0].roleId)) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    "Admin role cannot be assigned to site resources"
                )
            );
        }

        await db.transaction(async (trx) => {
            await trx.delete(roleSiteResources).where(
                and(
                    eq(roleSiteResources.siteResourceId, siteResourceId),
                    ne(roleSiteResources.roleId, adminRole[0].roleId) // delete all but the admin role
                )
            );

            await Promise.all(
                roleIds.map((roleId) =>
                    trx
                        .insert(roleSiteResources)
                        .values({ roleId, siteResourceId })
                        .returning()
                )
            );

            await rebuildSiteClientAssociations(siteResource, trx);
        });

        return response(res, {
            data: {},
            success: true,
            error: false,
            message: "Roles set for site resource successfully",
            status: HttpCode.CREATED
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
