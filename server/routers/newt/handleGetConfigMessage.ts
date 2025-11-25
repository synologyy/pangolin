import { z } from "zod";
import { MessageHandler } from "@server/routers/ws";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import {
    db,
    ExitNode,
    exitNodes,
    siteResources,
    clientSiteResourcesAssociationsCache
} from "@server/db";
import { clients, clientSitesAssociationsCache, Newt, sites } from "@server/db";
import { eq, and, inArray } from "drizzle-orm";
import { updatePeer } from "../olm/peers";
import { sendToExitNode } from "#dynamic/lib/exitNodes";
import {
    generateRemoteSubnets,
    generateSubnetProxyTargets,
    SubnetProxyTarget
} from "@server/lib/ip";

const inputSchema = z.object({
    publicKey: z.string(),
    port: z.int().positive()
});

type Input = z.infer<typeof inputSchema>;

export const handleGetConfigMessage: MessageHandler = async (context) => {
    const { message, client, sendToClient } = context;
    const newt = client as Newt;

    const now = new Date().getTime() / 1000;

    logger.debug("Handling Newt get config message!");

    if (!newt) {
        logger.warn("Newt not found");
        return;
    }

    if (!newt.siteId) {
        logger.warn("Newt has no site!"); // TODO: Maybe we create the site here?
        return;
    }

    const parsed = inputSchema.safeParse(message.data);
    if (!parsed.success) {
        logger.error(
            "handleGetConfigMessage: Invalid input: " +
                fromError(parsed.error).toString()
        );
        return;
    }

    const { publicKey, port } = message.data as Input;
    const siteId = newt.siteId;

    // Get the current site data
    const [existingSite] = await db
        .select()
        .from(sites)
        .where(eq(sites.siteId, siteId));

    if (!existingSite) {
        logger.warn("handleGetConfigMessage: Site not found");
        return;
    }

    // we need to wait for hole punch success
    if (!existingSite.endpoint) {
        logger.debug(
            `In newt get config: existing site ${existingSite.siteId} has no endpoint, skipping`
        );
        return;
    }

    if (existingSite.publicKey !== publicKey) {
        // TODO: somehow we should make sure a recent hole punch has happened if this occurs (hole punch could be from the last restart if done quickly)
    }

    // if (existingSite.lastHolePunch && now - existingSite.lastHolePunch > 6) {
    //     logger.warn(
    //         `Site ${existingSite.siteId} last hole punch is too old, skipping`
    //     );
    //     return;
    // }

    // update the endpoint and the public key
    const [site] = await db
        .update(sites)
        .set({
            publicKey,
            listenPort: port
        })
        .where(eq(sites.siteId, siteId))
        .returning();

    if (!site) {
        logger.error("handleGetConfigMessage: Failed to update site");
        return;
    }

    let exitNode: ExitNode | undefined;
    if (site.exitNodeId) {
        [exitNode] = await db
            .select()
            .from(exitNodes)
            .where(eq(exitNodes.exitNodeId, site.exitNodeId))
            .limit(1);
        if (
            exitNode.reachableAt &&
            existingSite.subnet &&
            existingSite.listenPort
        ) {
            const payload = {
                oldDestination: {
                    destinationIP: existingSite.subnet?.split("/")[0],
                    destinationPort: existingSite.listenPort
                },
                newDestination: {
                    destinationIP: site.subnet?.split("/")[0],
                    destinationPort: site.listenPort
                }
            };

            await sendToExitNode(exitNode, {
                remoteType: "remoteExitNode/update-proxy-mapping",
                localPath: "/update-proxy-mapping",
                method: "POST",
                data: payload
            });
        }
    }

    // Get all clients connected to this site
    const clientsRes = await db
        .select()
        .from(clients)
        .innerJoin(
            clientSitesAssociationsCache,
            eq(clients.clientId, clientSitesAssociationsCache.clientId)
        )
        .where(eq(clientSitesAssociationsCache.siteId, siteId));

    // Prepare peers data for the response
    const peers = await Promise.all(
        clientsRes
            .filter((client) => {
                if (!client.clients.pubKey) {
                    return false;
                }
                if (!client.clients.subnet) {
                    return false;
                }
                return true;
            })
            .map(async (client) => {
                // Add or update this peer on the olm if it is connected
                try {
                    if (!site.publicKey) {
                        logger.warn(
                            `Site ${site.siteId} has no public key, skipping`
                        );
                        return null;
                    }
                    let endpoint = site.endpoint;
                    if (client.clientSitesAssociationsCache.isRelayed) {
                        if (!site.exitNodeId) {
                            logger.warn(
                                `Site ${site.siteId} has no exit node, skipping`
                            );
                            return null;
                        }

                        if (!exitNode) {
                            logger.warn(
                                `Exit node not found for site ${site.siteId}`
                            );
                            return null;
                        }
                        endpoint = `${exitNode.endpoint}:21820`;
                    }

                    if (!endpoint) {
                        logger.warn(
                            `In Newt get config: Peer site ${site.siteId} has no endpoint, skipping`
                        );
                        return null;
                    }

                    const allSiteResources = await db // only get the site resources that this client has access to
                        .select()
                        .from(siteResources)
                        .innerJoin(
                            clientSiteResourcesAssociationsCache,
                            eq(
                                siteResources.siteResourceId,
                                clientSiteResourcesAssociationsCache.siteResourceId
                            )
                        )
                        .where(
                            and(
                                eq(siteResources.siteId, site.siteId),
                                eq(
                                    clientSiteResourcesAssociationsCache.clientId,
                                    client.clients.clientId
                                )
                            )
                        );

                    await updatePeer(client.clients.clientId, {
                        siteId: site.siteId,
                        endpoint: endpoint,
                        publicKey: site.publicKey,
                        serverIP: site.address,
                        serverPort: site.listenPort,
                        remoteSubnets: generateRemoteSubnets(
                            allSiteResources.map(
                                ({ siteResources }) => siteResources
                            )
                        )
                    });
                } catch (error) {
                    logger.error(
                        `Failed to add/update peer ${client.clients.pubKey} to olm ${newt.newtId}: ${error}`
                    );
                }

                return {
                    publicKey: client.clients.pubKey!,
                    allowedIps: [`${client.clients.subnet.split("/")[0]}/32`], // we want to only allow from that client
                    endpoint: client.clientSitesAssociationsCache.isRelayed
                        ? ""
                        : client.clientSitesAssociationsCache.endpoint! // if its relayed it should be localhost
                };
            })
    );

    // Filter out any null values from peers that didn't have an olm
    const validPeers = peers.filter((peer) => peer !== null);

    // Get all enabled site resources for this site
    const allSiteResources = await db
        .select()
        .from(siteResources)
        .where(eq(siteResources.siteId, siteId));

    let targetsToSend: SubnetProxyTarget[] = [];

    for (const resource of allSiteResources) {
        // Get clients associated with this specific resource
        const resourceClients = await db
            .select({
                clientId: clients.clientId,
                pubKey: clients.pubKey,
                subnet: clients.subnet
            })
            .from(clients)
            .innerJoin(
                clientSiteResourcesAssociationsCache,
                eq(
                    clients.clientId,
                    clientSiteResourcesAssociationsCache.clientId
                )
            )
            .where(
                eq(
                    clientSiteResourcesAssociationsCache.siteResourceId,
                    resource.siteResourceId
                )
            );

        const resourceTargets = generateSubnetProxyTargets(
            resource,
            resourceClients
        );

        targetsToSend.push(...resourceTargets);
    }

    // Build the configuration response
    const configResponse = {
        ipAddress: site.address,
        peers: validPeers,
        targets: targetsToSend
    };

    logger.debug("Sending config: ", configResponse);
    return {
        message: {
            type: "newt/wg/receive-config",
            data: {
                ...configResponse
            }
        },
        broadcast: false,
        excludeSender: false
    };
};
