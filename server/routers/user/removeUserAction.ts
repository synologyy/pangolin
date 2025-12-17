import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { userActions } from "@server/db";
import { and, eq } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";

const removeUserActionParamsSchema = z.strictObject({
    userId: z.string()
});

const removeUserActionSchema = z.strictObject({
    actionId: z.string(),
    orgId: z.string()
});

export async function removeUserAction(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = removeUserActionParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { userId } = parsedParams.data;

        const parsedBody = removeUserActionSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { actionId, orgId } = parsedBody.data;

        const deletedUserAction = await db
            .delete(userActions)
            .where(
                and(
                    eq(userActions.userId, userId),
                    eq(userActions.actionId, actionId),
                    eq(userActions.orgId, orgId)
                )
            )
            .returning();

        if (deletedUserAction.length === 0) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Action with ID ${actionId} not found for user with ID ${userId} in organization ${orgId}`
                )
            );
        }

        return response(res, {
            data: null,
            success: true,
            error: false,
            message: "Action removed from user successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
