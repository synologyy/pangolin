import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import HttpCode from "@server/types/HttpCode";
import logger from "@server/logger";
import { response } from "@server/lib/response";
import { db, deviceWebAuthCodes } from "@server/db";
import { eq, and, gt } from "drizzle-orm";

const bodySchema = z.object({
    code: z.string().min(1, "Code is required"),
    verify: z.boolean().optional().default(false) // If false, just check and return metadata
}).strict();

export type VerifyDeviceWebAuthBody = z.infer<typeof bodySchema>;

export type VerifyDeviceWebAuthResponse = {
    success: boolean;
    message: string;
    metadata?: {
        ip: string | null;
        city: string | null;
        deviceName: string | null;
        applicationName: string;
        createdAt: number;
    };
};

export async function verifyDeviceWebAuth(
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
        const { code, verify } = parsedBody.data;
        const now = Date.now();

        logger.debug("Verifying device web auth code:", { code });

        // Find the code in the database that is not expired and not already verified
        const [deviceCode] = await db
            .select()
            .from(deviceWebAuthCodes)
            .where(
                and(
                    eq(deviceWebAuthCodes.code, code),
                    gt(deviceWebAuthCodes.expiresAt, now),
                    eq(deviceWebAuthCodes.verified, false)
                )
            )
            .limit(1);

        logger.debug("Device code lookup result:", deviceCode);

        if (!deviceCode) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    "Invalid, expired, or already verified code"
                )
            );
        }

        // If verify is false, just return metadata without verifying
        if (!verify) {
            return response<VerifyDeviceWebAuthResponse>(res, {
                data: {
                    success: true,
                    message: "Code is valid",
                    metadata: {
                        ip: deviceCode.ip,
                        city: deviceCode.city,
                        deviceName: deviceCode.deviceName,
                        applicationName: deviceCode.applicationName,
                        createdAt: deviceCode.createdAt
                    }
                },
                success: true,
                error: false,
                message: "Code validation successful",
                status: HttpCode.OK
            });
        }

        // Update the code to mark it as verified and store the user who verified it
        await db
            .update(deviceWebAuthCodes)
            .set({
                verified: true,
                userId: req.user!.userId
            })
            .where(eq(deviceWebAuthCodes.codeId, deviceCode.codeId));

        return response<VerifyDeviceWebAuthResponse>(res, {
            data: {
                success: true,
                message: "Device code verified successfully"
            },
            success: true,
            error: false,
            message: "Device code verified successfully",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error(e);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to verify device code"
            )
        );
    }
}

