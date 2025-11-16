import { NextFunction, Request, Response } from "express";
import { db } from "@server/db";
import HttpCode from "@server/types/HttpCode";
import { z } from "zod";
import { apiKeyOrg, apiKeys, orgs } from "@server/db";
import { fromError } from "zod-validation-error";
import createHttpError from "http-errors";
import response from "@server/lib/response";
import moment from "moment";
import {
    generateId,
    generateIdFromEntropySize
} from "@server/auth/sessions/app";
import logger from "@server/logger";
import { hashPassword } from "@server/auth/password";

const bodySchema = z.strictObject({
        name: z.string().min(1).max(255)
    });

export type CreateRootApiKeyBody = z.infer<typeof bodySchema>;

export type CreateRootApiKeyResponse = {
    apiKeyId: string;
    name: string;
    apiKey: string;
    lastChars: string;
    createdAt: string;
};

export async function createRootApiKey(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedBody = bodySchema.safeParse(req.body);

    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    const { name } = parsedBody.data;

    const apiKeyId = generateId(15);
    const apiKey = generateIdFromEntropySize(25);
    const apiKeyHash = await hashPassword(apiKey);
    const lastChars = apiKey.slice(-4);
    const createdAt = moment().toISOString();

    await db.transaction(async (trx) => {
        await trx.insert(apiKeys).values({
            apiKeyId,
            name,
            apiKeyHash,
            createdAt,
            lastChars,
            isRoot: true
        });
    });

    try {
        return response<CreateRootApiKeyResponse>(res, {
            data: {
                apiKeyId,
                name,
                apiKey,
                lastChars,
                createdAt
            },
            success: true,
            error: false,
            message: "API key created",
            status: HttpCode.CREATED
        });
    } catch (e) {
        logger.error(e);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to create API key"
            )
        );
    }
}
