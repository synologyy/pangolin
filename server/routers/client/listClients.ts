import { db } from "@server/db";
import {
    clients,
    orgs,
    roleClients,
    sites,
    userClients,
    clientSites
} from "@server/db";
import logger from "@server/logger";
import HttpCode from "@server/types/HttpCode";
import response from "@server/lib/response";
import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";

const listClientsParamsSchema = z
    .object({
        orgId: z.string()
    })
    .strict();

const listClientsSchema = z.object({
    limit: z
        .string()
        .optional()
        .default("1000")
        .transform(Number)
        .pipe(z.number().int().positive()),
    offset: z
        .string()
        .optional()
        .default("0")
        .transform(Number)
        .pipe(z.number().int().nonnegative())
});

function queryClients(orgId: string, accessibleClientIds: number[]) {
    return db
        .select({
            clientId: clients.clientId,
            orgId: clients.orgId,
            name: clients.name,
            pubKey: clients.pubKey,
            subnet: clients.subnet,
            megabytesIn: clients.megabytesIn,
            megabytesOut: clients.megabytesOut,
            orgName: orgs.name,
            type: clients.type,
            online: clients.online
        })
        .from(clients)
        .leftJoin(orgs, eq(clients.orgId, orgs.orgId))
        .where(
            and(
                inArray(clients.clientId, accessibleClientIds),
                eq(clients.orgId, orgId)
            )
        );
}

async function getSiteAssociations(clientIds: number[]) {
    if (clientIds.length === 0) return [];

    return db
        .select({
            clientId: clientSites.clientId,
            siteId: clientSites.siteId,
            siteName: sites.name,
            siteNiceId: sites.niceId
        })
        .from(clientSites)
        .leftJoin(sites, eq(clientSites.siteId, sites.siteId))
        .where(inArray(clientSites.clientId, clientIds));
}

export type ListClientsResponse = {
    clients: Array<Awaited<ReturnType<typeof queryClients>>[0] & { sites: Array<{
        siteId: number;
        siteName: string | null;
        siteNiceId: string | null;
    }> }>;
    pagination: { total: number; limit: number; offset: number };
};

registry.registerPath({
    method: "get",
    path: "/org/{orgId}/clients",
    description: "List all clients for an organization.",
    tags: [OpenAPITags.Client, OpenAPITags.Org],
    request: {
        query: listClientsSchema,
        params: listClientsParamsSchema
    },
    responses: {}
});

export async function listClients(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedQuery = listClientsSchema.safeParse(req.query);
        if (!parsedQuery.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedQuery.error)
                )
            );
        }
        const { limit, offset } = parsedQuery.data;

        const parsedParams = listClientsParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error)
                )
            );
        }
        const { orgId } = parsedParams.data;

        if (req.user && orgId && orgId !== req.userOrgId) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    "User does not have access to this organization"
                )
            );
        }

        let accessibleClients;
        if (req.user) {
            accessibleClients = await db
                .select({
                    clientId: sql<number>`COALESCE(${userClients.clientId}, ${roleClients.clientId})`
                })
                .from(userClients)
                .fullJoin(
                    roleClients,
                    eq(userClients.clientId, roleClients.clientId)
                )
                .where(
                    or(
                        eq(userClients.userId, req.user!.userId),
                        eq(roleClients.roleId, req.userOrgRoleId!)
                    )
                );
        } else {
            accessibleClients = await db
                .select({ clientId: clients.clientId })
                .from(clients)
                .where(eq(clients.orgId, orgId));
        }

        const accessibleClientIds = accessibleClients.map(
            (client) => client.clientId
        );
        const baseQuery = queryClients(orgId, accessibleClientIds);

        // Get client count
        const countQuery = db
            .select({ count: count() })
            .from(clients)
            .where(
                and(
                    inArray(clients.clientId, accessibleClientIds),
                    eq(clients.orgId, orgId)
                )
            );

        const clientsList = await baseQuery.limit(limit).offset(offset);
        const totalCountResult = await countQuery;
        const totalCount = totalCountResult[0].count;

        // Get associated sites for all clients
        const clientIds = clientsList.map(client => client.clientId);
        const siteAssociations = await getSiteAssociations(clientIds);

        // Group site associations by client ID
        const sitesByClient = siteAssociations.reduce((acc, association) => {
            if (!acc[association.clientId]) {
                acc[association.clientId] = [];
            }
            acc[association.clientId].push({
                siteId: association.siteId,
                siteName: association.siteName,
                siteNiceId: association.siteNiceId
            });
            return acc;
        }, {} as Record<number, Array<{
            siteId: number;
            siteName: string | null;
            siteNiceId: string | null;
        }>>);

        // Merge clients with their site associations
        const clientsWithSites = clientsList.map(client => ({
            ...client,
            sites: sitesByClient[client.clientId] || []
        }));

        return response<ListClientsResponse>(res, {
            data: {
                clients: clientsWithSites,
                pagination: {
                    total: totalCount,
                    limit,
                    offset
                }
            },
            success: true,
            error: false,
            message: "Clients retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
