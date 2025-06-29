import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import { response } from "@server/lib";
import { db } from "@server/db";
import { users } from "@server/db";
import { startLogin } from "@server/auth/passkey";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { eq, and } from "drizzle-orm";
import { UserType } from "@server/types/UserTypes";

const bodySchema = z.object({ email: z.string().email() });

export async function passkeyLoginChallenge(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
        return next(
            createHttpError(HttpCode.BAD_REQUEST, fromError(parsed.error).toString())
        );
    }
    const { email } = parsed.data;
    try {
        const userRes = await db
            .select()
            .from(users)
            .where(and(eq(users.type, UserType.Internal), eq(users.email, email)));
        if (!userRes.length) {
            return next(createHttpError(HttpCode.BAD_REQUEST, "User not found"));
        }
        const user = userRes[0];
        const options = await startLogin(user.userId);
        return response(res, {
            data: { options },
            success: true,
            error: false,
            message: "Challenge created",
            status: HttpCode.OK
        });
    } catch (e) {
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "Failed to create challenge")
        );
    }
}
