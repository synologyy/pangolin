import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db, resources } from "@server/db";
import { apiKeys, roleResources, roles } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { eq, and, ne } from "drizzle-orm";
import { OpenAPITags, registry } from "@server/openApi";

const setResourceRolesBodySchema = z.strictObject({
        roleIds: z.array(z.int().positive())
    });

const setResourceRolesParamsSchema = z.strictObject({
        resourceId: z
            .string()
            .transform(Number)
            .pipe(z.int().positive())
    });

registry.registerPath({
    method: "post",
    path: "/resource/{resourceId}/roles",
    description:
        "Set roles for a resource. This will replace all existing roles.",
    tags: [OpenAPITags.Resource, OpenAPITags.Role],
    request: {
        params: setResourceRolesParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: setResourceRolesBodySchema
                }
            }
        }
    },
    responses: {}
});

export async function setResourceRoles(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedBody = setResourceRolesBodySchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { roleIds } = parsedBody.data;

        const parsedParams = setResourceRolesParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { resourceId } = parsedParams.data;

        // get the resource
        const [resource] = await db
            .select()
            .from(resources)
            .where(eq(resources.resourceId, resourceId))
            .limit(1);

        if (!resource) {
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    "Resource not found"
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
                    eq(roles.orgId, resource.orgId)
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
                    "Admin role cannot be assigned to resources"
                )
            );
        }

        await db.transaction(async (trx) => {
            await trx.delete(roleResources).where(
                and(
                    eq(roleResources.resourceId, resourceId),
                    ne(roleResources.roleId, adminRole[0].roleId) // delete all but the admin role
                )
            );

            const newRoleResources = await Promise.all(
                roleIds.map((roleId) =>
                    trx
                        .insert(roleResources)
                        .values({ roleId, resourceId })
                        .returning()
                )
            );

            return response(res, {
                data: {},
                success: true,
                error: false,
                message: "Roles set for resource successfully",
                status: HttpCode.CREATED
            });
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}

