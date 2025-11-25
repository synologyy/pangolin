import { Request } from "express";
import {
    validateSessionToken,
    SESSION_COOKIE_NAME
} from "@server/auth/sessions/app";

export async function verifySession(req: Request, forceLogin?: boolean) {
    const res = await validateSessionToken(
        req.cookies[SESSION_COOKIE_NAME] ?? ""
    );

    if (!forceLogin) {
        return res;
    }
    if (!res.session || !res.user) {
        return {
            session: null,
            user: null
        };
    }
    if (!res.session.issuedAt) {
        return {
            session: null,
            user: null
        };
    }
    const mins = 3 * 60 * 1000;
    const now = new Date().getTime();
    if (now - res.session.issuedAt > mins) {
        return {
            session: null,
            user: null
        };
    }

    return res;
}
