import { db, newts } from "@server/db";
import { MessageHandler } from "../ws";
import { exitNodes, Newt, resources, sites, Target, targets } from "@server/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { addPeer, deletePeer } from "../gerbil/peers";
import logger from "@server/logger";
import config from "@server/lib/config";
import {
    findNextAvailableCidr,
    getNextAvailableClientSubnet
} from "@server/lib/ip";
import { selectBestExitNode, verifyExitNodeOrgAccess } from "@server/lib/exitNodes";
import { fetchContainers } from "./dockerSocket";

export type ExitNodePingResult = {
    exitNodeId: number;
    latencyMs: number;
    weight: number;
    error?: string;
    exitNodeName: string;
    endpoint: string;
    wasPreviouslyConnected: boolean;
};

export const handleNewtRegisterMessage: MessageHandler = async (context) => {
    const { message, client, sendToClient } = context;
    const newt = client as Newt;

    logger.debug("Handling register newt message!");

    if (!newt) {
        logger.warn("Newt not found");
        return;
    }

    if (!newt.siteId) {
        logger.warn("Newt has no site!"); // TODO: Maybe we create the site here?
        return;
    }

    const siteId = newt.siteId;

    const { publicKey, pingResults, newtVersion, backwardsCompatible } =
        message.data;
    if (!publicKey) {
        logger.warn("Public key not provided");
        return;
    }

    if (backwardsCompatible) {
        logger.debug(
            "Backwards compatible mode detecting - not sending connect message and waiting for ping response."
        );
        return;
    }

    let exitNodeId: number | undefined;
    if (pingResults) {
        const bestPingResult = selectBestExitNode(
            pingResults as ExitNodePingResult[]
        );
        if (!bestPingResult) {
            logger.warn("No suitable exit node found based on ping results");
            return;
        }
        exitNodeId = bestPingResult.exitNodeId;
    }

    const [oldSite] = await db
        .select()
        .from(sites)
        .where(eq(sites.siteId, siteId))
        .limit(1);

    if (!oldSite) {
        logger.warn("Site not found");
        return;
    }

    logger.debug(`Docker socket enabled: ${oldSite.dockerSocketEnabled}`);

    if (oldSite.dockerSocketEnabled) {
        logger.debug(
            "Site has docker socket enabled - requesting docker containers"
        );
        fetchContainers(newt.newtId);
    }

    let siteSubnet = oldSite.subnet;
    let exitNodeIdToQuery = oldSite.exitNodeId;
    if (exitNodeId && (oldSite.exitNodeId !== exitNodeId || !oldSite.subnet)) {
        // This effectively moves the exit node to the new one
        exitNodeIdToQuery = exitNodeId; // Use the provided exitNodeId if it differs from the site's exitNodeId

        const { exitNode, hasAccess } = await verifyExitNodeOrgAccess(exitNodeIdToQuery, oldSite.orgId);

        if (!exitNode) {
            logger.warn("Exit node not found");
            return;
        }

        if (!hasAccess) {
            logger.warn("Not authorized to use this exit node");
            return;
        }

        const sitesQuery = await db
            .select({
                subnet: sites.subnet
            })
            .from(sites)
            .where(eq(sites.exitNodeId, exitNodeId));

        const blockSize = config.getRawConfig().gerbil.site_block_size;
        const subnets = sitesQuery
            .map((site) => site.subnet)
            .filter((subnet) => subnet !== null);
        subnets.push(exitNode.address.replace(/\/\d+$/, `/${blockSize}`));
        const newSubnet = findNextAvailableCidr(
            subnets,
            blockSize,
            exitNode.address
        );
        if (!newSubnet) {
            logger.error("No available subnets found for the new exit node");
            return;
        }

        siteSubnet = newSubnet;

        await db
            .update(sites)
            .set({
                pubKey: publicKey,
                exitNodeId: exitNodeId,
                subnet: newSubnet
            })
            .where(eq(sites.siteId, siteId))
            .returning();
    } else {
        await db
            .update(sites)
            .set({
                pubKey: publicKey
            })
            .where(eq(sites.siteId, siteId))
            .returning();
    }

    if (!exitNodeIdToQuery) {
        logger.warn("No exit node ID to query");
        return;
    }

    const [exitNode] = await db
        .select()
        .from(exitNodes)
        .where(eq(exitNodes.exitNodeId, exitNodeIdToQuery))
        .limit(1);

    if (oldSite.pubKey && oldSite.pubKey !== publicKey && oldSite.exitNodeId) {
        logger.info("Public key mismatch. Deleting old peer...");
        await deletePeer(oldSite.exitNodeId, oldSite.pubKey);
    }

    if (!siteSubnet) {
        logger.warn("Site has no subnet");
        return;
    }

    // add the peer to the exit node
    await addPeer(exitNodeIdToQuery, {
        publicKey: publicKey,
        allowedIps: [siteSubnet]
    });

    if (newtVersion && newtVersion !== newt.version) {
        // update the newt version in the database
        await db
            .update(newts)
            .set({
                version: newtVersion as string
            })
            .where(eq(newts.newtId, newt.newtId));
    }

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

    return {
        message: {
            type: "newt/wg/connect",
            data: {
                endpoint: `${exitNode.endpoint}:${exitNode.listenPort}`,
                publicKey: exitNode.publicKey,
                serverIP: exitNode.address.split("/")[0],
                tunnelIP: siteSubnet.split("/")[0],
                targets: {
                    udp: udpTargets,
                    tcp: tcpTargets
                }
            }
        },
        broadcast: false, // Send to all clients
        excludeSender: false // Include sender in broadcast
    };
};