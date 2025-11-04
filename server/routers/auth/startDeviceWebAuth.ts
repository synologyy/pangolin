import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import HttpCode from "@server/types/HttpCode";
import logger from "@server/logger";
import { response } from "@server/lib/response";
import { db, deviceWebAuthCodes } from "@server/db";
import { alphabet, generateRandomString } from "oslo/crypto";
import { createDate } from "oslo";
import { TimeSpan } from "oslo";
import { maxmindLookup } from "@server/db/maxmind";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";

const bodySchema = z.object({
    deviceName: z.string().optional(),
    applicationName: z.string().min(1, "Application name is required")
}).strict();

export type StartDeviceWebAuthBody = z.infer<typeof bodySchema>;

export type StartDeviceWebAuthResponse = {
    code: string;
    expiresAt: number;
};

// Helper function to generate device code in format A1AJ-N5JD
function generateDeviceCode(): string {
    const part1 = generateRandomString(4, alphabet("A-Z", "0-9"));
    const part2 = generateRandomString(4, alphabet("A-Z", "0-9"));
    return `${part1}-${part2}`;
}

// Helper function to hash device code before storing in database
function hashDeviceCode(code: string): string {
    return encodeHexLowerCase(
        sha256(new TextEncoder().encode(code))
    );
}

// Helper function to extract IP from request
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

// Helper function to get city from IP (if available)
async function getCityFromIp(ip: string): Promise<string | undefined> {
    try {
        if (!maxmindLookup) {
            return undefined;
        }

        const result = maxmindLookup.get(ip);
        if (!result) {
            return undefined;
        }

        // MaxMind CountryResponse doesn't include city by default
        // If city data is available, it would be in result.city?.names?.en
        // But since we're using CountryResponse type, we'll just return undefined
        // The user said "don't do this if not easy", so we'll skip city for now
        return undefined;
    } catch (error) {
        logger.debug("Failed to get city from IP", error);
        return undefined;
    }
}

export async function startDeviceWebAuth(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedBody = bodySchema.safeParse(req.body);

    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    try {
        const { deviceName, applicationName } = parsedBody.data;

        // Generate device code
        const code = generateDeviceCode();

        // Hash the code before storing in database
        const hashedCode = hashDeviceCode(code);

        // Extract IP from request
        const ip = extractIpFromRequest(req);

        // Get city (optional, may return undefined)
        const city = ip ? await getCityFromIp(ip) : undefined;

        // Set expiration to 5 minutes from now
        const expiresAt = createDate(new TimeSpan(5, "m")).getTime();

        // Insert into database (store hashed code)
        await db.insert(deviceWebAuthCodes).values({
            code: hashedCode,
            ip: ip || null,
            city: city || null,
            deviceName: deviceName || null,
            applicationName,
            expiresAt,
            createdAt: Date.now()
        });

        return response<StartDeviceWebAuthResponse>(res, {
            data: {
                code,
                expiresAt
            },
            success: true,
            error: false,
            message: "Device web auth code generated",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error(e);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to start device web auth"
            )
        );
    }
}
