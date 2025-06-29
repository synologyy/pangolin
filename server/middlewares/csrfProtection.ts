import { NextFunction, Request, Response } from "express";
import cookie from "cookie";

export function csrfProtectionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const csrfToken = req.headers["x-csrf-token"] as string | undefined;
    const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
    const csrfCookie = cookies["p_csrf"];

    // Skip CSRF check for GET requests as they should be idempotent
    if (req.method === "GET") {
        next();
        return;
    }

    if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
        res.status(403).json({
            error: "CSRF token missing or invalid"
        });
        return;
    }

    next();
}
