import { NextFunction, Request, Response } from "express";
import db from "@server/db";
import { hash } from "@node-rs/argon2";
import HttpCode from "@server/types/HttpCode";
import { z } from "zod";
import { generateId } from "lucia";
import { users } from "@server/db/schema";
import lucia from "@server/auth";
import { fromError } from "zod-validation-error";
import createHttpError from "http-errors";
import response from "@server/utils/response";
import { SqliteError } from "better-sqlite3";
import { sendEmailVerificationCode } from "./sendEmailVerificationCode";
import { passwordSchema } from "@server/auth/passwordSchema";

export const signupBodySchema = z.object({
    email: z.string().email(),
    password: passwordSchema,
});

export type SignUpBody = z.infer<typeof signupBodySchema>;

export type SignUpResponse = {
    emailVerificationRequired: boolean;
};

export async function signup(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<any> {
    const parsedBody = signupBodySchema.safeParse(req.body);

    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString(),
            ),
        );
    }

    const { email, password } = parsedBody.data;

    const passwordHash = await hash(password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
    });
    const userId = generateId(15);

    try {
        await db.insert(users).values({
            id: userId,
            email: email,
            passwordHash,
        });

        const session = await lucia.createSession(userId, {});
        res.appendHeader(
            "Set-Cookie",
            lucia.createSessionCookie(session.id).serialize(),
        );

        sendEmailVerificationCode(email, userId);

        return response<SignUpResponse>(res, {
            data: {
                emailVerificationRequired: true,
            },
            success: true,
            error: false,
            message: `User created successfully. We sent an email to ${email} with a verification code.`,
            status: HttpCode.OK,
        });
    } catch (e) {
        if (e instanceof SqliteError && e.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    "A user with that email address already exists",
                ),
            );
        } else {
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    "Failed to create user",
                ),
            );
        }
    }
}
