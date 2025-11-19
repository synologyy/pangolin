import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { clients, clientSitesAssociationsCache } from "@server/db";
import { eq } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";

const deleteClientSchema = z.strictObject({
        clientId: z.string().transform(Number).pipe(z.int().positive())
    });

registry.registerPath({
    method: "delete",
    path: "/client/{clientId}",
    description: "Delete a client by its client ID.",
    tags: [OpenAPITags.Client],
    request: {
        params: deleteClientSchema
    },
    responses: {}
});

export async function deleteClient(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = deleteClientSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { clientId } = parsedParams.data;

        const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.clientId, clientId))
            .limit(1);

        if (!client) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Client with ID ${clientId} not found`
                )
            );
        }

        if (client.userId) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    `Cannot delete a user client with this endpoint`
                )
            );
        }

        await db.transaction(async (trx) => {
            // Delete the client-site associations first
            await trx
                .delete(clientSitesAssociationsCache)
                .where(eq(clientSitesAssociationsCache.clientId, clientId));

            // Then delete the client itself
            await trx.delete(clients).where(eq(clients.clientId, clientId));

            // this is a machine client
            if (!client.userId && client.olmId) {
                await trx
                    .delete(clients)
                    .where(eq(clients.olmId, client.olmId));
            }
        });

        return response(res, {
            data: null,
            success: true,
            error: false,
            message: "Client deleted successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
