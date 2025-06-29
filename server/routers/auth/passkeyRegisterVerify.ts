import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import { response } from "@server/lib";
import { User } from "@server/db";
import { finishRegistration } from "@server/auth/passkey";
import { z } from "zod";
import { fromError } from "zod-validation-error";

const bodySchema = z.object({ credential: z.any() });

export async function passkeyRegisterVerify(
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
    const user = req.user as User;
    try {
        const verified = await finishRegistration(user.userId, parsed.data.credential);
        if (!verified) {
            return next(createHttpError(HttpCode.BAD_REQUEST, "Invalid registration"));
        }
        return response<null>(res, {
            data: null,
            success: true,
            error: false,
            message: "Passkey registered",
            status: HttpCode.OK
        });
    } catch (e) {
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "Failed to verify passkey")
        );
    }
}
