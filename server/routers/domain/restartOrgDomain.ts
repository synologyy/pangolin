import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db, domains } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { and, eq } from "drizzle-orm";

const paramsSchema = z.strictObject({
    domainId: z.string(),
    orgId: z.string()
});

export type RestartOrgDomainResponse = {
    success: boolean;
};

export async function restartOrgDomain(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsed = paramsSchema.safeParse(req.params);
        if (!parsed.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsed.error).toString()
                )
            );
        }
        const { domainId, orgId } = parsed.data;

        await db
            .update(domains)
            .set({ failed: false, tries: 0 })
            .where(and(eq(domains.domainId, domainId)));

        return response<RestartOrgDomainResponse>(res, {
            data: { success: true },
            success: true,
            error: false,
            message: "Domain restarted successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
