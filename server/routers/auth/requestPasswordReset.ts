import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import HttpCode from "@server/types/HttpCode";
import { response } from "@server/lib";
import { db } from "@server/db";
import { passwordResetTokens, users } from "@server/db";
import { eq } from "drizzle-orm";
import { alphabet, generateRandomString, sha256 } from "oslo/crypto";
import { createDate } from "oslo";
import logger from "@server/logger";
import { TimeSpan } from "oslo";
import config from "@server/lib/config";
import { sendEmail } from "@server/emails";
import ResetPasswordCode from "@server/emails/templates/ResetPasswordCode";
import { hashPassword } from "@server/auth/password";

export const requestPasswordResetBody = z
    .object({
        email: z
            .string()
            .email()
            .transform((v) => v.toLowerCase())
    })
    .strict();

export type RequestPasswordResetBody = z.infer<typeof requestPasswordResetBody>;

export type RequestPasswordResetResponse = {
    sentEmail: boolean;
};

export async function requestPasswordReset(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedBody = requestPasswordResetBody.safeParse(req.body);

    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    const { email } = parsedBody.data;

    try {
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

        if (!existingUser || !existingUser.length) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    "A user with that email does not exist"
                )
            );
        }

        const token = generateRandomString(8, alphabet("0-9", "A-Z", "a-z"));
        await db.transaction(async (trx) => {
            await trx
                .delete(passwordResetTokens)
                .where(eq(passwordResetTokens.userId, existingUser[0].userId));

            const tokenHash = await hashPassword(token);

            await trx.insert(passwordResetTokens).values({
                userId: existingUser[0].userId,
                email: existingUser[0].email!,
                tokenHash,
                expiresAt: createDate(new TimeSpan(2, "h")).getTime()
            });
        });

        const url = `${config.getRawConfig().app.dashboard_url}/auth/reset-password?email=${email}&token=${token}`;

        if (!config.getRawConfig().email) {
            // Avoid logging the reset token to prevent leakage of sensitive information
            logger.info(`Password reset requested for ${email}.`);
        }

        await sendEmail(
            ResetPasswordCode({
                email,
                code: token,
                link: url
            }),
            {
                from: config.getNoReplyEmail(),
                to: email,
                subject: "Reset your password"
            }
        );

        return response<RequestPasswordResetResponse>(res, {
            data: {
                sentEmail: true
            },
            success: true,
            error: false,
            message: "Password reset requested",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error(e);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to process password reset request"
            )
        );
    }
}
