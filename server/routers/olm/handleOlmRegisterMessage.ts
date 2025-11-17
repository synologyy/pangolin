import {
    Client,
    db,
    ExitNode,
    orgs,
    roleClients,
    roles,
    siteResources,
    Transaction,
    userClients,
    userOrgs,
    users
} from "@server/db";
import { MessageHandler } from "@server/routers/ws";
import { clients, clientSites, exitNodes, Olm, olms, sites } from "@server/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { addPeer, deletePeer } from "../newt/peers";
import logger from "@server/logger";
import { listExitNodes } from "#dynamic/lib/exitNodes";
import { getNextAvailableClientSubnet } from "@server/lib/ip";
import { generateRemoteSubnetsStr } from "@server/lib/ip";

export const handleOlmRegisterMessage: MessageHandler = async (context) => {
    logger.info("Handling register olm message!");
    const { message, client: c, sendToClient } = context;
    const olm = c as Olm;

    const now = new Date().getTime() / 1000;

    if (!olm) {
        logger.warn("Olm not found");
        return;
    }

    const { publicKey, relay, olmVersion, orgId, doNotCreateNewClient } =
        message.data;
    let client: Client;

    if (orgId) {
        try {
            client = await getOrCreateOrgClient(
                orgId,
                olm.userId,
                olm.olmId,
                olm.name || "User Device",
                // doNotCreateNewClient ? true : false
                true // for now never create a new client automatically because we create the users clients when they are added to the org
            );
        } catch (err) {
            logger.error(
                `Error switching olm client ${olm.olmId} to org ${orgId}: ${err}`
            );
            return;
        }

        if (!client) {
            logger.warn("Client not found");
            return;
        }

        logger.debug(
            `Switching olm client ${olm.olmId} to org ${orgId} for user ${olm.userId}`
        );

        await db
            .update(olms)
            .set({
                clientId: client.clientId
            })
            .where(eq(olms.olmId, olm.olmId));
    } else {
        if (!olm.clientId) {
            logger.warn("Olm has no client ID!");
            return;
        }

        logger.debug(`Using last connected org for client ${olm.clientId}`);

        [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.clientId, olm.clientId))
            .limit(1);
    }

    if (!client) {
        logger.warn("Client ID not found");
        return;
    }

    logger.debug(
        `Olm client ID: ${client.clientId}, Public Key: ${publicKey}, Relay: ${relay}`
    );

    if (!publicKey) {
        logger.warn("Public key not provided");
        return;
    }

    if (client.exitNodeId) {
        // TODO: FOR NOW WE ARE JUST HOLEPUNCHING ALL EXIT NODES BUT IN THE FUTURE WE SHOULD HANDLE THIS BETTER

        // Get the exit node
        const allExitNodes = await listExitNodes(client.orgId, true); // FILTER THE ONLINE ONES

        const exitNodesHpData = allExitNodes.map((exitNode: ExitNode) => {
            return {
                publicKey: exitNode.publicKey,
                endpoint: exitNode.endpoint
            };
        });

        // Send holepunch message
        await sendToClient(olm.olmId, {
            type: "olm/wg/holepunch/all",
            data: {
                exitNodes: exitNodesHpData
            }
        });

        if (!olmVersion) {
            // THIS IS FOR BACKWARDS COMPATIBILITY
            // THE OLDER CLIENTS DID NOT SEND THE VERSION
            await sendToClient(olm.olmId, {
                type: "olm/wg/holepunch",
                data: {
                    serverPubKey: allExitNodes[0].publicKey,
                    endpoint: allExitNodes[0].endpoint
                }
            });
        }
    }

    if (olmVersion) {
        await db
            .update(olms)
            .set({
                version: olmVersion
            })
            .where(eq(olms.olmId, olm.olmId));
    }

    // if (now - (client.lastHolePunch || 0) > 6) {
    //     logger.warn("Client last hole punch is too old, skipping all sites");
    //     return;
    // }

    if (client.pubKey !== publicKey) {
        logger.info(
            "Public key mismatch. Updating public key and clearing session info..."
        );
        // Update the client's public key
        await db
            .update(clients)
            .set({
                pubKey: publicKey
            })
            .where(eq(clients.clientId, client.clientId));

        // set isRelay to false for all of the client's sites to reset the connection metadata
        await db
            .update(clientSites)
            .set({
                isRelayed: relay == true
            })
            .where(eq(clientSites.clientId, client.clientId));
    }

    // Get all sites data
    const sitesData = await db
        .select()
        .from(sites)
        .innerJoin(clientSites, eq(sites.siteId, clientSites.siteId))
        .where(eq(clientSites.clientId, client.clientId));

    // Prepare an array to store site configurations
    const siteConfigurations = [];
    logger.debug(
        `Found ${sitesData.length} sites for client ${client.clientId}`
    );

    if (sitesData.length === 0) {
        sendToClient(olm.olmId, {
            type: "olm/register/no-sites",
            data: {}
        });
    }

    // Process each site
    for (const { sites: site } of sitesData) {
        if (!site.exitNodeId) {
            logger.warn(
                `Site ${site.siteId} does not have exit node, skipping`
            );
            continue;
        }

        // Validate endpoint and hole punch status
        if (!site.endpoint) {
            logger.warn(
                `In olm register: site ${site.siteId} has no endpoint, skipping`
            );
            continue;
        }

        // if (site.lastHolePunch && now - site.lastHolePunch > 6 && relay) {
        //     logger.warn(
        //         `Site ${site.siteId} last hole punch is too old, skipping`
        //     );
        //     continue;
        // }

        // If public key changed, delete old peer from this site
        if (client.pubKey && client.pubKey != publicKey) {
            logger.info(
                `Public key mismatch. Deleting old peer from site ${site.siteId}...`
            );
            await deletePeer(site.siteId, client.pubKey!);
        }

        if (!site.subnet) {
            logger.warn(`Site ${site.siteId} has no subnet, skipping`);
            continue;
        }

        const [clientSite] = await db
            .select()
            .from(clientSites)
            .where(
                and(
                    eq(clientSites.clientId, client.clientId),
                    eq(clientSites.siteId, site.siteId)
                )
            )
            .limit(1);

        const allSiteResources = await db
            .select()
            .from(siteResources)
            .where(eq(siteResources.siteId, site.siteId));

        // Add the peer to the exit node for this site
        if (clientSite.endpoint) {
            logger.info(
                `Adding peer ${publicKey} to site ${site.siteId} with endpoint ${clientSite.endpoint}`
            );
            await addPeer(site.siteId, {
                publicKey: publicKey,
                allowedIps: [`${client.subnet.split("/")[0]}/32`], // we want to only allow from that client
                endpoint: relay ? "" : clientSite.endpoint
            });
        } else {
            logger.warn(
                `Client ${client.clientId} has no endpoint, skipping peer addition`
            );
        }

        let endpoint = site.endpoint;
        if (relay) {
            const [exitNode] = await db
                .select()
                .from(exitNodes)
                .where(eq(exitNodes.exitNodeId, site.exitNodeId))
                .limit(1);
            if (!exitNode) {
                logger.warn(`Exit node not found for site ${site.siteId}`);
                continue;
            }
            endpoint = `${exitNode.endpoint}:21820`;
        }

        // Add site configuration to the array
        siteConfigurations.push({
            siteId: site.siteId,
            endpoint: endpoint,
            publicKey: site.publicKey,
            serverIP: site.address,
            serverPort: site.listenPort,
            remoteSubnets: generateRemoteSubnetsStr(allSiteResources)
        });
    }

    // REMOVED THIS SO IT CREATES THE INTERFACE AND JUST WAITS FOR THE SITES
    // if (siteConfigurations.length === 0) {
    //     logger.warn("No valid site configurations found");
    //     return;
    // }

    // Return connect message with all site configurations
    return {
        message: {
            type: "olm/wg/connect",
            data: {
                sites: siteConfigurations,
                tunnelIP: client.subnet
            }
        },
        broadcast: false,
        excludeSender: false
    };
};

async function getOrCreateOrgClient(
    orgId: string,
    userId: string | null,
    olmId: string,
    name: string,
    doNotCreateNewClient: boolean,
    trx: Transaction | typeof db = db
): Promise<Client> {
    // get the org
    const [org] = await trx
        .select()
        .from(orgs)
        .where(eq(orgs.orgId, orgId))
        .limit(1);

    if (!org) {
        throw new Error("Org not found");
    }

    if (!org.subnet) {
        throw new Error("Org has no subnet defined");
    }

    // check if the user has a client in the org and if not then create a client for them
    const [existingClient] = await trx
        .select()
        .from(clients)
        .where(
            and(
                eq(clients.orgId, orgId),
                userId ? eq(clients.userId, userId) : isNull(clients.userId), // we dont check the user id if it is null because the olm is not tied to a user?
                eq(clients.olmId, olmId)
            )
        ) // checking the olmid here because we want to create a new client PER OLM PER ORG
        .limit(1);

    let client = existingClient;
    if (!client && !doNotCreateNewClient) {
        logger.debug(
            `Client does not exist in org ${orgId}, creating new client for user ${userId}`
        );

        if (!userId) {
            throw new Error("User ID is required to create client in org");
        }

        // Verify that the user belongs to the org
        const [userOrg] = await trx
            .select()
            .from(userOrgs)
            .where(and(eq(userOrgs.orgId, orgId), eq(userOrgs.userId, userId)))
            .limit(1);

        if (!userOrg) {
            throw new Error("User does not belong to org");
        }

        // TODO: more intelligent way to pick the exit node
        const exitNodesList = await listExitNodes(orgId);
        const randomExitNode =
            exitNodesList[Math.floor(Math.random() * exitNodesList.length)];

        const [adminRole] = await trx
            .select()
            .from(roles)
            .where(and(eq(roles.isAdmin, true), eq(roles.orgId, orgId)))
            .limit(1);

        if (!adminRole) {
            throw new Error("Admin role not found");
        }

        const newSubnet = await getNextAvailableClientSubnet(orgId);
        if (!newSubnet) {
            throw new Error("No available subnet found");
        }

        const subnet = newSubnet.split("/")[0];
        const updatedSubnet = `${subnet}/${org.subnet.split("/")[1]}`; // we want the block size of the whole org

        const [newClient] = await trx
            .insert(clients)
            .values({
                exitNodeId: randomExitNode.exitNodeId,
                orgId,
                name,
                subnet: updatedSubnet,
                type: "olm",
                userId: userId,
                olmId: olmId // to lock this client to the olm even as the olm moves between clients in different orgs
            })
            .returning();

        await trx.insert(roleClients).values({
            roleId: adminRole.roleId,
            clientId: newClient.clientId
        });

        await trx.insert(userClients).values({
            // we also want to make sure that the user can see their own client if they are not an admin
            userId,
            clientId: newClient.clientId
        });

        if (userOrg.roleId != adminRole.roleId) {
            // make sure the user can access the client
            trx.insert(userClients).values({
                userId,
                clientId: newClient.clientId
            });
        }

        client = newClient;
    }

    return client;
}
