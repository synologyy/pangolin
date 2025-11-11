import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import { GetUserResponse } from "@server/routers/user";
import { AxiosResponse } from "axios";
import { pullEnv } from "../pullEnv";
import { cache } from "react";

export const verifySession = cache(async function ({
    skipCheckVerifyEmail
}: {
    skipCheckVerifyEmail?: boolean;
} = {}): Promise<GetUserResponse | null> {
    const env = pullEnv();

    try {
        const res = await internal.get<AxiosResponse<GetUserResponse>>(
            "/user",
            await authCookieHeader()
        );

        const user = res.data.data;

        if (!user) {
            return null;
        }

        if (
            !skipCheckVerifyEmail &&
            !user.emailVerified &&
            env.flags.emailVerificationRequired
        ) {
            return null;
        }

        return user;
    } catch (e) {
        return null;
    }
});
