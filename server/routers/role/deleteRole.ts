import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { roles, userOrgs } from "@server/db";
import { eq } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";

const deleteRoleSchema = z.strictObject({
    roleId: z.string().transform(Number).pipe(z.int().positive())
});

const deelteRoleBodySchema = z.strictObject({
    roleId: z.string().transform(Number).pipe(z.int().positive())
});

registry.registerPath({
    method: "delete",
    path: "/role/{roleId}",
    description: "Delete a role.",
    tags: [OpenAPITags.Role],
    request: {
        params: deleteRoleSchema,
        body: {
            content: {
                "application/json": {
                    schema: deelteRoleBodySchema
                }
            }
        }
    },
    responses: {}
});

export async function deleteRole(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = deleteRoleSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const parsedBody = deelteRoleBodySchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { roleId } = parsedParams.data;
        const { roleId: newRoleId } = parsedBody.data;

        if (roleId === newRoleId) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    `Cannot delete a role and assign the same role`
                )
            );
        }

        const role = await db
            .select()
            .from(roles)
            .where(eq(roles.roleId, roleId))
            .limit(1);

        if (role.length === 0) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Role with ID ${roleId} not found`
                )
            );
        }

        if (role[0].isAdmin) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    `Cannot delete a Admin role`
                )
            );
        }

        const newRole = await db
            .select()
            .from(roles)
            .where(eq(roles.roleId, newRoleId))
            .limit(1);

        if (newRole.length === 0) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Role with ID ${newRoleId} not found`
                )
            );
        }

        await db.transaction(async (trx) => {
            // move all users from the userOrgs table with roleId to newRoleId
            await trx
                .update(userOrgs)
                .set({ roleId: newRoleId })
                .where(eq(userOrgs.roleId, roleId));

            // delete the old role
            await trx.delete(roles).where(eq(roles.roleId, roleId));
        });

        return response(res, {
            data: null,
            success: true,
            error: false,
            message: "Role deleted successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
