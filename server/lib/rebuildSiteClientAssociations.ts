import {
    Client,
    clients,
    clientSites,
    db,
    exitNodes,
    newts,
    olms,
    roleSiteResources,
    Site,
    SiteResource,
    sites,
    Transaction,
    userOrgs,
    users,
    userSiteResources
} from "@server/db";
import { and, eq, inArray } from "drizzle-orm";

import {
    addPeer as newtAddPeer,
    deletePeer as newtDeletePeer
} from "@server/routers/newt/peers";
import {
    addPeer as olmAddPeer,
    deletePeer as olmDeletePeer
} from "@server/routers/olm/peers";
import { sendToExitNode } from "#dynamic/lib/exitNodes";
import logger from "@server/logger";

export async function rebuildSiteClientAssociations(
    siteResource: SiteResource,
    trx: Transaction | typeof db = db
): Promise<void> {
    const siteId = siteResource.siteId;

    // get the site
    const [site] = await trx
        .select()
        .from(sites)
        .where(eq(sites.siteId, siteId))
        .limit(1);

    if (!site) {
        throw new Error(`Site with ID ${siteId} not found`);
    }

    const roleIds = await trx
        .select()
        .from(roleSiteResources)
        .where(
            eq(roleSiteResources.siteResourceId, siteResource.siteResourceId)
        )
        .then((rows) => rows.map((row) => row.roleId));

    const directUserIds = await trx
        .select()
        .from(userSiteResources)
        .where(
            eq(userSiteResources.siteResourceId, siteResource.siteResourceId)
        )
        .then((rows) => rows.map((row) => row.userId));

    // get all of the users in these roles
    const userIdsFromRoles = await trx
        .select({
            userId: userOrgs.userId
        })
        .from(userOrgs)
        .where(inArray(userOrgs.roleId, roleIds))
        .then((rows) => rows.map((row) => row.userId));

    const newAllUserIds = Array.from(
        new Set([...directUserIds, ...userIdsFromRoles])
    );

    const newAllClients = await trx
        .select({
            clientId: clients.clientId,
            pubKey: clients.pubKey,
            subnet: clients.subnet
        })
        .from(clients)
        .where(inArray(clients.userId, newAllUserIds));

    const newAllClientIds = newAllClients.map((client) => client.clientId);

    const existingClientSites = await trx
        .select({
            clientId: clientSites.clientId
        })
        .from(clientSites)
        .where(eq(clientSites.siteId, siteId));

    const existingClientSiteIds = existingClientSites.map((row) => row.clientId);

    // Get full client details for existing clients (needed for sending delete messages)
    const existingClients = await trx
        .select({
            clientId: clients.clientId,
            pubKey: clients.pubKey,
            subnet: clients.subnet
        })
        .from(clients)
        .where(inArray(clients.clientId, existingClientSiteIds));

    const clientSitesToAdd = newAllClientIds.filter(
        (clientId) => !existingClientSiteIds.includes(clientId)
    );

    const clientSitesToInsert = newAllClientIds
        .filter((clientId) => !existingClientSiteIds.includes(clientId))
        .map((clientId) => ({
            clientId,
            siteId
        }));

    if (clientSitesToInsert.length > 0) {
        await trx.insert(clientSites).values(clientSitesToInsert);
    }

    // Now remove any client-site associations that should no longer exist
    const clientSitesToRemove = existingClientSiteIds.filter(
        (clientId) => !newAllClientIds.includes(clientId)
    );

    if (clientSitesToRemove.length > 0) {
        await trx
            .delete(clientSites)
            .where(
                and(
                    eq(clientSites.siteId, siteId),
                    inArray(clientSites.clientId, clientSitesToRemove)
                )
            );
    }

    // Now handle the messages to add/remove peers on both the newt and olm sides
    await handleMessagesForSiteClients(
        site,
        siteId,
        newAllClients,
        existingClients,
        clientSitesToAdd,
        clientSitesToRemove,
        trx
    );
}

async function handleMessagesForSiteClients(
    site: Site,
    siteId: number,
    allClients: {
        clientId: number;
        pubKey: string | null;
        subnet: string | null;
    }[],
    existingClients: {
        clientId: number;
        pubKey: string | null;
        subnet: string | null;
    }[],
    clientSitesToAdd: number[],
    clientSitesToRemove: number[],
    trx: Transaction | typeof db = db
): Promise<void> {
    if (!site.exitNodeId) {
        logger.warn(
            `Exit node ID not on site ${site.siteId} so there is no reason to update clients because it must be offline`
        );
        return;
    }

    // get the exit node for the site
    const [exitNode] = await trx
        .select()
        .from(exitNodes)
        .where(eq(exitNodes.exitNodeId, site.exitNodeId))
        .limit(1);

    if (!exitNode) {
        logger.warn(
            `Exit node not found for site ${site.siteId} so there is no reason to update clients because it must be offline`
        );
        return;
    }

    if (!site.publicKey) {
        logger.warn(
            `Site publicKey not set for site ${site.siteId} so cannot add peers to clients`
        );
        return;
    }

    const [newt] = await trx
        .select({
            newtId: newts.newtId
        })
        .from(newts)
        .where(eq(newts.siteId, siteId))
        .limit(1);
    if (!newt) {
        logger.warn(
            `Newt not found for site ${siteId} so cannot add peers to clients`
        );
        return;
    }

    let newtJobs: Promise<any>[] = [];
    let olmJobs: Promise<any>[] = [];
    let exitNodeJobs: Promise<any>[] = [];
    
    // Combine all clients that need processing (those being added or removed)
    const clientsToProcess = new Map<number, {
        clientId: number;
        pubKey: string | null;
        subnet: string | null;
    }>();
    
    // Add clients that are being added (from newAllClients)
    for (const client of allClients) {
        if (clientSitesToAdd.includes(client.clientId)) {
            clientsToProcess.set(client.clientId, client);
        }
    }
    
    // Add clients that are being removed (from existingClients)
    for (const client of existingClients) {
        if (clientSitesToRemove.includes(client.clientId)) {
            clientsToProcess.set(client.clientId, client);
        }
    }
    
    for (const client of clientsToProcess.values()) {
        // UPDATE THE NEWT
        if (!client.subnet || !client.pubKey) {
            logger.debug("Client subnet, pubKey or endpoint is not set");
            continue;
        }

        // is this an add or a delete?
        const isAdd = clientSitesToAdd.includes(client.clientId);
        const isDelete = clientSitesToRemove.includes(client.clientId);

        if (!isAdd && !isDelete) {
            // nothing to do for this client
            continue;
        }

        const [olm] = await trx
            .select({
                olmId: olms.olmId
            })
            .from(olms)
            .where(eq(olms.clientId, client.clientId))
            .limit(1);
        if (!olm) {
            logger.warn(
                `Olm not found for client ${client.clientId} so cannot add/delete peers`
            );
            continue;
        }

        if (isDelete) {
            newtJobs.push(newtDeletePeer(siteId, client.pubKey, newt.newtId));
            olmJobs.push(
                olmDeletePeer(
                    client.clientId,
                    siteId,
                    site.publicKey,
                    olm.olmId
                )
            );
        }

        if (isAdd) {
            // TODO: WE NEED TO HANDLE THIS BETTER. WE ARE DEFAULTING TO RELAYING FOR NEW SITES
            // BUT REALLY WE NEED TO TRACK THE USERS PREFERENCE THAT THEY CHOSE IN THE CLIENTS
            // AND TRIGGER A HOLEPUNCH OR SOMETHING TO GET THE ENDPOINT AND HP TO THE NEW SITES
            const isRelayed = true;

            newtJobs.push(
                newtAddPeer(
                    siteId,
                    {
                        publicKey: client.pubKey,
                        allowedIps: [`${client.subnet.split("/")[0]}/32`], // we want to only allow from that client
                        // endpoint: isRelayed ? "" : clientSite.endpoint
                        endpoint: isRelayed ? "" : "" // we are not HPing yet so no endpoint
                    },
                    newt.newtId
                )
            );

            olmJobs.push(
                olmAddPeer(
                    client.clientId,
                    {
                        siteId: site.siteId,
                        endpoint:
                            isRelayed || !site.endpoint
                                ? `${exitNode.endpoint}:21820`
                                : site.endpoint,
                        publicKey: site.publicKey,
                        serverIP: site.address,
                        serverPort: site.listenPort,
                        remoteSubnets: site.remoteSubnets
                    },
                    olm.olmId
                )
            );
        }

        exitNodeJobs.push(updateClientSiteDestinations(client, trx));
    }

    await Promise.all(exitNodeJobs);
    await Promise.all(newtJobs); // do the servers first to make sure they are ready?
    await Promise.all(olmJobs);
}

interface PeerDestination {
    destinationIP: string;
    destinationPort: number;
}

// this updates the relay destinations for a client to point to all of the new sites
export async function updateClientSiteDestinations(
    client: {
        clientId: number;
        pubKey: string | null;
        subnet: string | null;
    },
    trx: Transaction | typeof db = db
): Promise<void> {
    let exitNodeDestinations: {
        reachableAt: string;
        exitNodeId: number;
        type: string;
        name: string;
        sourceIp: string;
        sourcePort: number;
        destinations: PeerDestination[];
    }[] = [];

    const sitesData = await trx
        .select()
        .from(sites)
        .innerJoin(clientSites, eq(sites.siteId, clientSites.siteId))
        .leftJoin(exitNodes, eq(sites.exitNodeId, exitNodes.exitNodeId))
        .where(eq(clientSites.clientId, client.clientId));

    for (const site of sitesData) {
        if (!site.sites.subnet) {
            logger.warn(`Site ${site.sites.siteId} has no subnet, skipping`);
            continue;
        }

        if (!site.clientSites.endpoint) {
            logger.warn(`Site ${site.sites.siteId} has no endpoint, skipping`); // if this is a new association the endpoint is not set yet // TODO: FIX THIS
            continue;
        }

        // find the destinations in the array
        let destinations = exitNodeDestinations.find(
            (d) => d.reachableAt === site.exitNodes?.reachableAt
        );

        if (!destinations) {
            destinations = {
                reachableAt: site.exitNodes?.reachableAt || "",
                exitNodeId: site.exitNodes?.exitNodeId || 0,
                type: site.exitNodes?.type || "",
                name: site.exitNodes?.name || "",
                sourceIp: site.clientSites.endpoint.split(":")[0] || "",
                sourcePort:
                    parseInt(site.clientSites.endpoint.split(":")[1]) || 0,
                destinations: [
                    {
                        destinationIP: site.sites.subnet.split("/")[0],
                        destinationPort: site.sites.listenPort || 0
                    }
                ]
            };
        } else {
            // add to the existing destinations
            destinations.destinations.push({
                destinationIP: site.sites.subnet.split("/")[0],
                destinationPort: site.sites.listenPort || 0
            });
        }

        // update it in the array
        exitNodeDestinations = exitNodeDestinations.filter(
            (d) => d.reachableAt !== site.exitNodes?.reachableAt
        );
        exitNodeDestinations.push(destinations);
    }

    for (const destination of exitNodeDestinations) {
        logger.info(
            `Updating destinations for exit node at ${destination.reachableAt}`
        );
        const payload = {
            sourceIp: destination.sourceIp,
            sourcePort: destination.sourcePort,
            destinations: destination.destinations
        };
        logger.info(
            `Payload for update-destinations: ${JSON.stringify(payload, null, 2)}`
        );

        // Create an ExitNode-like object for sendToExitNode
        const exitNodeForComm = {
            exitNodeId: destination.exitNodeId,
            type: destination.type,
            reachableAt: destination.reachableAt,
            name: destination.name
        } as any; // Using 'as any' since we know sendToExitNode will handle this correctly

        await sendToExitNode(exitNodeForComm, {
            remoteType: "remoteExitNode/update-destinations",
            localPath: "/update-destinations",
            method: "POST",
            data: payload
        });
    }
}
