import { NextFunction, Request, Response } from "express";
import { db } from "@server/db";
import { olms, clients, clientSites } from "@server/db";
import { eq } from "drizzle-orm";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import response from "@server/lib/response";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";

const deleteOlmParamsSchema = z
    .object({
        olmId: z.string()
    })
    .strict();

export async function deleteOlm(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return next(
                createHttpError(HttpCode.UNAUTHORIZED, "User not authenticated")
            );
        }

        const parsedParams = deleteOlmParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { olmId } = parsedParams.data;

        // Verify the OLM belongs to the current user
        const [existingOlm] = await db
            .select()
            .from(olms)
            .where(eq(olms.olmId, olmId))
            .limit(1);

        if (!existingOlm) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Olm with ID ${olmId} not found`
                )
            );
        }

        if (existingOlm.userId !== userId) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    "You do not have permission to delete this device"
                )
            );
        }

        // Delete associated clients and the OLM in a transaction
        await db.transaction(async (trx) => {
            // Find all clients associated with this OLM
            const associatedClients = await trx
                .select({ clientId: clients.clientId })
                .from(clients)
                .where(eq(clients.olmId, olmId));

            // Delete client-site associations for each associated client
            for (const client of associatedClients) {
                await trx
                    .delete(clientSites)
                    .where(eq(clientSites.clientId, client.clientId));
            }

            // Delete all associated clients
            if (associatedClients.length > 0) {
                await trx
                    .delete(clients)
                    .where(eq(clients.olmId, olmId));
            }

            // Finally, delete the OLM itself
            await trx.delete(olms).where(eq(olms.olmId, olmId));
        });

        return response(res, {
            data: null,
            success: true,
            error: false,
            message: "Device deleted successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to delete device"
            )
        );
    }
}

