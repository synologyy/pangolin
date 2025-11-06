import { NextFunction, Request, Response } from "express";
import { db } from "@server/db";
import { olms } from "@server/db";
import { eq, count, desc } from "drizzle-orm";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import response from "@server/lib/response";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";

const listOlmsSchema = z.object({
    limit: z
        .string()
        .optional()
        .default("1000")
        .transform(Number)
        .pipe(z.number().int().positive()),
    offset: z
        .string()
        .optional()
        .default("0")
        .transform(Number)
        .pipe(z.number().int().nonnegative())
});

export type ListOlmsResponse = {
    olms: Array<{
        olmId: string;
        dateCreated: string;
        version: string | null;
        name: string | null;
        clientId: number | null;
        userId: string | null;
    }>;
    pagination: {
        total: number;
        limit: number;
        offset: number;
    };
};

export async function listOlms(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return next(
                createHttpError(HttpCode.UNAUTHORIZED, "User not authenticated")
            );
        }

        const parsedQuery = listOlmsSchema.safeParse(req.query);
        if (!parsedQuery.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedQuery.error).toString()
                )
            );
        }

        const { limit, offset } = parsedQuery.data;

        // Get total count
        const [totalCountResult] = await db
            .select({ count: count() })
            .from(olms)
            .where(eq(olms.userId, userId));

        const total = totalCountResult?.count || 0;

        // Get OLMs for the current user
        const userOlms = await db
            .select({
                olmId: olms.olmId,
                dateCreated: olms.dateCreated,
                version: olms.version,
                name: olms.name,
                clientId: olms.clientId,
                userId: olms.userId
            })
            .from(olms)
            .where(eq(olms.userId, userId))
            .orderBy(desc(olms.dateCreated))
            .limit(limit)
            .offset(offset);

        return response<ListOlmsResponse>(res, {
            data: {
                olms: userOlms,
                pagination: {
                    total,
                    limit,
                    offset
                }
            },
            success: true,
            error: false,
            message: "OLMs retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to list OLMs"
            )
        );
    }
}

