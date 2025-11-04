import { NextFunction, Request, Response } from "express";
import { db } from "@server/db";
import { hash } from "@node-rs/argon2";
import HttpCode from "@server/types/HttpCode";
import { z } from "zod";
import { olms } from "@server/db";
import createHttpError from "http-errors";
import response from "@server/lib/response";
import { SqliteError } from "better-sqlite3";
import moment from "moment";
import { generateId, generateSessionToken } from "@server/auth/sessions/app";
import { createOlmSession } from "@server/auth/sessions/olm";
import { fromError } from "zod-validation-error";
import { hashPassword } from "@server/auth/password";

export const createOlmBodySchema = z.object({});

export type CreateOlmBody = z.infer<typeof createOlmBodySchema>;

export type CreateOlmResponse = {
    // token: string;
    olmId: string;
    secret: string;
};

const createOlmSchema = z
    .object({
        name: z.string().min(1).max(255)
    })
    .strict();

const createOlmParamsSchema = z
    .object({
        userId: z.string().optional()
    });

export async function createOlm(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedBody = createOlmSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { name } = parsedBody.data;

        const parsedParams = createOlmParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { userId } = parsedParams.data;
        let userIdFinal = userId;

        if (req.user) { // overwrite the user with the one calling because we want to assign the olm to the user creating it
            userIdFinal = req.user.userId;
        }
        
        if (!userIdFinal) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    "Either userId must be provided or request must be authenticated"
                )
            );
        }

        const olmId = generateId(15);
        const secret = generateId(48);

        const secretHash = await hashPassword(secret);

        await db.insert(olms).values({
            olmId: olmId,
            userId: userIdFinal,
            name,
            secretHash,
            dateCreated: moment().toISOString()
        });

        // const token = generateSessionToken();
        // await createOlmSession(token, olmId);

        return response<CreateOlmResponse>(res, {
            data: {
                olmId,
                secret
                // token,
            },
            success: true,
            error: false,
            message: "Olm created successfully",
            status: HttpCode.OK
        });
    } catch (e) {
        console.error(e);

        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to create olm"
            )
        );
    }
}
