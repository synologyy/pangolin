import { db, sites } from "@server/db";
import { MessageHandler } from "../ws";
import { exitNodes, Newt } from "@server/db";
import logger from "@server/logger";
import config from "@server/lib/config";
import { ne, eq, or, and, count } from "drizzle-orm";

export const handleNewtPingRequestMessage: MessageHandler = async (context) => {
    const { message, client, sendToClient } = context;
    const newt = client as Newt;

    logger.info("Handling ping request newt message!");

    if (!newt) {
        logger.warn("Newt not found");
        return;
    }

    // TODO: pick which nodes to send and ping better than just all of them
    let exitNodesList = await db
        .select()
        .from(exitNodes);

    exitNodesList = exitNodesList.filter((node) => node.maxConnections !== 0);

    let lastExitNodeId = null;
    if (newt.siteId) {
        const [lastExitNode] = await db
            .select()
            .from(sites)
            .where(eq(sites.siteId, newt.siteId))
            .limit(1);
        lastExitNodeId = lastExitNode?.exitNodeId || null;
    }

    const exitNodesPayload = await Promise.all(
        exitNodesList.map(async (node) => {
            // (MAX_CONNECTIONS - current_connections) / MAX_CONNECTIONS)
            // higher = more desirable
            // like saying, this node has x% of its capacity left

            let weight = 1;
            const maxConnections = node.maxConnections;
            if (maxConnections !== null && maxConnections !== undefined) {
                const [currentConnections] = await db
                    .select({
                        count: count()
                    })
                    .from(sites)
                    .where(
                        and(
                            eq(sites.exitNodeId, node.exitNodeId),
                            eq(sites.online, true)
                        )
                    );

                    if (currentConnections.count >= maxConnections) {
                        return null;
                    }

                weight =
                    (maxConnections - currentConnections.count) /
                    maxConnections;
            }

            return {
                exitNodeId: node.exitNodeId,
                exitNodeName: node.name,
                endpoint: node.endpoint,
                weight,
                wasPreviouslyConnected: node.exitNodeId === lastExitNodeId
            };
        })
    );

    // filter out null values
    const filteredExitNodes = exitNodesPayload.filter((node) => node !== null);

    return {
        message: {
            type: "newt/ping/exitNodes",
            data: {
                exitNodes: filteredExitNodes
            }
        },
        broadcast: false, // Send to all clients
        excludeSender: false // Include sender in broadcast
    };
};
