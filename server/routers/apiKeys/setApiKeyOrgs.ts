import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { apiKeyOrg, orgs } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { eq, and, inArray } from "drizzle-orm";

const bodySchema = z.strictObject({
        orgIds: z.tuple([z.string()], z.string())
            .transform((v) => Array.from(new Set(v)))
    });

const paramsSchema = z.object({
    apiKeyId: z.string().nonempty()
});

export async function setApiKeyOrgs(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedBody = bodySchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { orgIds: newOrgIds } = parsedBody.data;

        const parsedParams = paramsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { apiKeyId } = parsedParams.data;

        // make sure all orgs exist
        const allOrgs = await db
            .select()
            .from(orgs)
            .where(inArray(orgs.orgId, newOrgIds));

        if (allOrgs.length !== newOrgIds.length) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    "One or more orgs do not exist"
                )
            );
        }

        await db.transaction(async (trx) => {
            const existingOrgs = await trx
                .select({ orgId: apiKeyOrg.orgId })
                .from(apiKeyOrg)
                .where(eq(apiKeyOrg.apiKeyId, apiKeyId));

            const existingOrgIds = existingOrgs.map((a) => a.orgId);

            const orgIdsToAdd = newOrgIds.filter(
                (id) => !existingOrgIds.includes(id)
            );
            const orgIdsToRemove = existingOrgIds.filter(
                (id) => !newOrgIds.includes(id)
            );

            if (orgIdsToRemove.length > 0) {
                await trx
                    .delete(apiKeyOrg)
                    .where(
                        and(
                            eq(apiKeyOrg.apiKeyId, apiKeyId),
                            inArray(apiKeyOrg.orgId, orgIdsToRemove)
                        )
                    );
            }

            if (orgIdsToAdd.length > 0) {
                const insertValues = orgIdsToAdd.map((orgId) => ({
                    apiKeyId,
                    orgId
                }));
                await trx.insert(apiKeyOrg).values(insertValues);
            }

            return response(res, {
                data: {},
                success: true,
                error: false,
                message: "API key orgs updated successfully",
                status: HttpCode.OK
            });
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
