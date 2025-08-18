import { z } from "zod";
import { MessageHandler } from "../ws";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import {
    db,
    ExitNode,
    exitNodes,
    resources,
    Target,
    targets
} from "@server/db";
import { clients, clientSites, Newt, sites } from "@server/db";
import { eq, and, inArray } from "drizzle-orm";
import { updatePeer } from "../olm/peers";
import { sendToExitNode } from "../../lib/exitNodeComms";

const inputSchema = z.object({
    publicKey: z.string(),
    port: z.number().int().positive()
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
        logger.warn(`Site ${existingSite.siteId} has no endpoint, skipping`);
        return;
    }

    if (existingSite.publicKey !== publicKey) {
        // TODO: somehow we should make sure a recent hole punch has happened if this occurs (hole punch could be from the last restart if done quickly)
    }

    if (existingSite.lastHolePunch && now - existingSite.lastHolePunch > 6) {
        logger.warn(
            `Site ${existingSite.siteId} last hole punch is too old, skipping`
        );
        return;
    }

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
        .innerJoin(clientSites, eq(clients.clientId, clientSites.clientId))
        .where(eq(clientSites.siteId, siteId));

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
                    if (client.clientSites.isRelayed) {
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
                            `Site ${site.siteId} has no endpoint, skipping`
                        );
                        return null;
                    }

                    await updatePeer(client.clients.clientId, {
                        siteId: site.siteId,
                        endpoint: endpoint,
                        publicKey: site.publicKey,
                        serverIP: site.address,
                        serverPort: site.listenPort,
                        remoteSubnets: site.remoteSubnets
                    });
                } catch (error) {
                    logger.error(
                        `Failed to add/update peer ${client.clients.pubKey} to olm ${newt.newtId}: ${error}`
                    );
                }

                return {
                    publicKey: client.clients.pubKey!,
                    allowedIps: [`${client.clients.subnet.split("/")[0]}/32`], // we want to only allow from that client
                    endpoint: client.clientSites.isRelayed
                        ? ""
                        : client.clientSites.endpoint! // if its relayed it should be localhost
                };
            })
    );

    // Filter out any null values from peers that didn't have an olm
    const validPeers = peers.filter((peer) => peer !== null);

    // Get all enabled targets with their resource protocol information
    const allTargets = await db
        .select({
            resourceId: targets.resourceId,
            targetId: targets.targetId,
            ip: targets.ip,
            method: targets.method,
            port: targets.port,
            internalPort: targets.internalPort,
            enabled: targets.enabled,
            protocol: resources.protocol
        })
        .from(targets)
        .innerJoin(resources, eq(targets.resourceId, resources.resourceId))
        .where(and(eq(targets.siteId, siteId), eq(targets.enabled, true)));

    const { tcpTargets, udpTargets } = allTargets.reduce(
        (acc, target) => {
            // Filter out invalid targets
            if (!target.internalPort || !target.ip || !target.port) {
                return acc;
            }

            // Format target into string
            const formattedTarget = `${target.internalPort}:${target.ip}:${target.port}`;

            // Add to the appropriate protocol array
            if (target.protocol === "tcp") {
                acc.tcpTargets.push(formattedTarget);
            } else {
                acc.udpTargets.push(formattedTarget);
            }

            return acc;
        },
        { tcpTargets: [] as string[], udpTargets: [] as string[] }
    );

    // Build the configuration response
    const configResponse = {
        ipAddress: site.address,
        peers: validPeers,
        targets: {
            udp: udpTargets,
            tcp: tcpTargets
        }
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
