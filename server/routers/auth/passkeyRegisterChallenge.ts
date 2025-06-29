import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import { response } from "@server/lib";
import { User } from "@server/db";
import { startRegistration } from "@server/auth/passkey";

export type PasskeyRegisterChallengeResponse = {
    options: any;
};

export async function passkeyRegisterChallenge(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const user = req.user as User;
    try {
        const options = await startRegistration(
            user.userId,
            user.email || user.username
        );
        return response<PasskeyRegisterChallengeResponse>(res, {
            data: { options },
            success: true,
            error: false,
            message: "Challenge created",
            status: HttpCode.OK
        });
    } catch (e) {
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to create challenge"
            )
        );
    }
}
