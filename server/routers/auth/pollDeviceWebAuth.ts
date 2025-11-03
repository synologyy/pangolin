import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import HttpCode from "@server/types/HttpCode";
import logger from "@server/logger";
import { response } from "@server/lib/response";
import { db, deviceWebAuthCodes } from "@server/db";
import { eq, and, gt } from "drizzle-orm";
import {
    createSession,
    generateSessionToken
} from "@server/auth/sessions/app";

const paramsSchema = z.object({
    code: z.string().min(1, "Code is required")
});

export type PollDeviceWebAuthParams = z.infer<typeof paramsSchema>;

export type PollDeviceWebAuthResponse = {
    verified: boolean;
    token?: string;
};

// Helper function to extract IP from request (same as in startDeviceWebAuth)
function extractIpFromRequest(req: Request): string | undefined {
    const ip = req.ip || req.socket.remoteAddress;
    if (!ip) {
        return undefined;
    }

    // Handle IPv6 format [::1] or IPv4 format
    if (ip.startsWith("[") && ip.includes("]")) {
        const ipv6Match = ip.match(/\[(.*?)\]/);
        if (ipv6Match) {
            return ipv6Match[1];
        }
    }

    // Handle IPv4 with port (split at last colon)
    const lastColonIndex = ip.lastIndexOf(":");
    if (lastColonIndex !== -1) {
        return ip.substring(0, lastColonIndex);
    }

    return ip;
}

export async function pollDeviceWebAuth(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedParams = paramsSchema.safeParse(req.params);

    if (!parsedParams.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedParams.error).toString()
            )
        );
    }

    try {
        const { code } = parsedParams.data;
        const now = Date.now();
        const requestIp = extractIpFromRequest(req);

        // Find the code in the database
        const [deviceCode] = await db
            .select()
            .from(deviceWebAuthCodes)
            .where(eq(deviceWebAuthCodes.code, code))
            .limit(1);

        if (!deviceCode) {
            return response<PollDeviceWebAuthResponse>(res, {
                data: {
                    verified: false
                },
                success: true,
                error: false,
                message: "Code not found",
                status: HttpCode.OK
            });
        }

        // Check if code is expired
        if (deviceCode.expiresAt <= now) {
            return response<PollDeviceWebAuthResponse>(res, {
                data: {
                    verified: false
                },
                success: true,
                error: false,
                message: "Code expired",
                status: HttpCode.OK
            });
        }

        // Check if code is verified
        if (!deviceCode.verified) {
            return response<PollDeviceWebAuthResponse>(res, {
                data: {
                    verified: false
                },
                success: true,
                error: false,
                message: "Code not yet verified",
                status: HttpCode.OK
            });
        }

        // Check if IP matches
        if (!requestIp || !deviceCode.ip || requestIp !== deviceCode.ip) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    "IP address does not match"
                )
            );
        }

        // Check if userId is set (should be set when verified)
        if (!deviceCode.userId) {
            logger.error("Device code is verified but userId is missing", { codeId: deviceCode.codeId });
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    "Invalid code state"
                )
            );
        }

        // Generate session token
        const token = generateSessionToken();
        await createSession(token, deviceCode.userId);

        // Delete the code after successful exchange for a token
        await db
            .delete(deviceWebAuthCodes)
            .where(eq(deviceWebAuthCodes.codeId, deviceCode.codeId));

        return response<PollDeviceWebAuthResponse>(res, {
            data: {
                verified: true,
                token
            },
            success: true,
            error: false,
            message: "Code verified and session created",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error(e);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to poll device code"
            )
        );
    }
}

