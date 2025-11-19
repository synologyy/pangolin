import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { clients, clientSitesAssociationsCache } from "@server/db";
import { eq, and } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import stoi from "@server/lib/stoi";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";

const getClientSchema = z.strictObject({
        clientId: z.string().transform(stoi).pipe(z.int().positive())
    });

async function query(clientId: number) {
    // Get the client
    const [client] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.clientId, clientId)))
        .limit(1);

    if (!client) {
        return null;
    }

    // Get the siteIds associated with this client
    const sites = await db
        .select({ siteId: clientSitesAssociationsCache.siteId })
        .from(clientSitesAssociationsCache)
        .where(eq(clientSitesAssociationsCache.clientId, clientId));

    // Add the siteIds to the client object
    return {
        ...client,
        siteIds: sites.map((site) => site.siteId)
    };
}

export type GetClientResponse = NonNullable<Awaited<ReturnType<typeof query>>>;

registry.registerPath({
    method: "get",
    path: "/client/{clientId}",
    description: "Get a client by its client ID.",
    tags: [OpenAPITags.Client],
    request: {
        params: getClientSchema
    },
    responses: {}
});

export async function getClient(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = getClientSchema.safeParse(req.params);
        if (!parsedParams.success) {
            logger.error(
                `Error parsing params: ${fromError(parsedParams.error).toString()}`
            );
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { clientId } = parsedParams.data;

        const client = await query(clientId);

        if (!client) {
            return next(
                createHttpError(HttpCode.NOT_FOUND, "Client not found")
            );
        }

        return response<GetClientResponse>(res, {
            data: client,
            success: true,
            error: false,
            message: "Client retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
