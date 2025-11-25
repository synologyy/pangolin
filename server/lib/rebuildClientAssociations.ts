import {
    Client,
    clients,
    clientSiteResources,
    clientSiteResourcesAssociationsCache,
    clientSitesAssociationsCache,
    db,
    exitNodes,
    newts,
    olms,
    roleSiteResources,
    Site,
    SiteResource,
    siteResources,
    sites,
    Transaction,
    userOrgs,
    users,
    userSiteResources
} from "@server/db";
import { and, eq, inArray, ne } from "drizzle-orm";

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
import {
    generateAliasConfig,
    generateRemoteSubnets,
    generateSubnetProxyTargets,
    SubnetProxyTarget
} from "@server/lib/ip";
import {
    addPeerData,
    addTargets as addSubnetProxyTargets,
    removePeerData,
    removeTargets as removeSubnetProxyTargets
} from "@server/routers/client/targets";

export async function getClientSiteResourceAccess(
    siteResource: SiteResource,
    trx: Transaction | typeof db = db
) {
    // get the site
    const [site] = await trx
        .select()
        .from(sites)
        .where(eq(sites.siteId, siteResource.siteId))
        .limit(1);

    if (!site) {
        throw new Error(`Site with ID ${siteResource.siteId} not found`);
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

    const allClientSiteResources = await trx // this is for if a client is directly associated with a resource instead of implicitly via a user
        .select()
        .from(clientSiteResources)
        .where(
            eq(clientSiteResources.siteResourceId, siteResource.siteResourceId)
        );

    const directClientIds = allClientSiteResources.map((row) => row.clientId);

    // Get full client details for directly associated clients
    const directClients = await trx
        .select({
            clientId: clients.clientId,
            pubKey: clients.pubKey,
            subnet: clients.subnet
        })
        .from(clients)
        .where(inArray(clients.clientId, directClientIds));

    // Merge user-based clients with directly associated clients
    const allClientsMap = new Map(
        [...newAllClients, ...directClients].map((c) => [c.clientId, c])
    );
    const mergedAllClients = Array.from(allClientsMap.values());
    const mergedAllClientIds = mergedAllClients.map((c) => c.clientId);

    return {
        site,
        mergedAllClients,
        mergedAllClientIds
    };
}

export async function rebuildClientAssociationsFromSiteResource(
    siteResource: SiteResource,
    trx: Transaction | typeof db = db
): Promise<{
    mergedAllClients: {
        clientId: number;
        pubKey: string | null;
        subnet: string | null;
    }[];
}> {
    const siteId = siteResource.siteId;

    const { site, mergedAllClients, mergedAllClientIds } =
        await getClientSiteResourceAccess(siteResource, trx);

    /////////// process the client-siteResource associations ///////////

    // get all of the clients associated with other resources on this site
    const allUpdatedClientsFromOtherResourcesOnThisSite = await trx
        .select({
            clientId: clientSiteResourcesAssociationsCache.clientId
        })
        .from(clientSiteResourcesAssociationsCache)
        .innerJoin(
            siteResources,
            eq(
                clientSiteResourcesAssociationsCache.siteResourceId,
                siteResources.siteResourceId
            )
        )
        .where(
            and(
                eq(siteResources.siteId, siteId),
                ne(siteResources.siteResourceId, siteResource.siteResourceId)
            )
        );

    const allClientIdsFromOtherResourcesOnThisSite = Array.from(
        new Set(
            allUpdatedClientsFromOtherResourcesOnThisSite.map(
                (row) => row.clientId
            )
        )
    );

    const existingClientSiteResources = await trx
        .select({
            clientId: clientSiteResourcesAssociationsCache.clientId
        })
        .from(clientSiteResourcesAssociationsCache)
        .where(
            eq(
                clientSiteResourcesAssociationsCache.siteResourceId,
                siteResource.siteResourceId
            )
        );

    const existingClientSiteResourceIds = existingClientSiteResources.map(
        (row) => row.clientId
    );

    // Get full client details for existing resource clients (needed for sending delete messages)
    const existingResourceClients =
        existingClientSiteResourceIds.length > 0
            ? await trx
                  .select({
                      clientId: clients.clientId,
                      pubKey: clients.pubKey,
                      subnet: clients.subnet
                  })
                  .from(clients)
                  .where(
                      inArray(clients.clientId, existingClientSiteResourceIds)
                  )
            : [];

    const clientSiteResourcesToAdd = mergedAllClientIds.filter(
        (clientId) => !existingClientSiteResourceIds.includes(clientId)
    );

    const clientSiteResourcesToInsert = clientSiteResourcesToAdd.map(
        (clientId) => ({
            clientId,
            siteResourceId: siteResource.siteResourceId
        })
    );

    if (clientSiteResourcesToInsert.length > 0) {
        await trx
            .insert(clientSiteResourcesAssociationsCache)
            .values(clientSiteResourcesToInsert)
            .returning();
    }

    const clientSiteResourcesToRemove = existingClientSiteResourceIds.filter(
        (clientId) => !mergedAllClientIds.includes(clientId)
    );

    if (clientSiteResourcesToRemove.length > 0) {
        await trx
            .delete(clientSiteResourcesAssociationsCache)
            .where(
                and(
                    eq(
                        clientSiteResourcesAssociationsCache.siteResourceId,
                        siteResource.siteResourceId
                    ),
                    inArray(
                        clientSiteResourcesAssociationsCache.clientId,
                        clientSiteResourcesToRemove
                    )
                )
            );
    }

    /////////// process the client-site associations ///////////

    const existingClientSites = await trx
        .select({
            clientId: clientSitesAssociationsCache.clientId
        })
        .from(clientSitesAssociationsCache)
        .where(eq(clientSitesAssociationsCache.siteId, siteResource.siteId));

    const existingClientSiteIds = existingClientSites.map(
        (row) => row.clientId
    );

    // Get full client details for existing clients (needed for sending delete messages)
    const existingClients = await trx
        .select({
            clientId: clients.clientId,
            pubKey: clients.pubKey,
            subnet: clients.subnet
        })
        .from(clients)
        .where(inArray(clients.clientId, existingClientSiteIds));

    const clientSitesToAdd = mergedAllClientIds.filter(
        (clientId) =>
            !existingClientSiteIds.includes(clientId) &&
            !allClientIdsFromOtherResourcesOnThisSite.includes(clientId) // dont remove if there is still another connection for another site resource
    );

    const clientSitesToInsert = clientSitesToAdd.map((clientId) => ({
        clientId,
        siteId
    }));

    if (clientSitesToInsert.length > 0) {
        await trx
            .insert(clientSitesAssociationsCache)
            .values(clientSitesToInsert)
            .returning();
    }

    // Now remove any client-site associations that should no longer exist
    const clientSitesToRemove = existingClientSiteIds.filter(
        (clientId) =>
            !mergedAllClientIds.includes(clientId) &&
            !allClientIdsFromOtherResourcesOnThisSite.includes(clientId) // dont remove if there is still another connection for another site resource
    );

    if (clientSitesToRemove.length > 0) {
        await trx
            .delete(clientSitesAssociationsCache)
            .where(
                and(
                    eq(clientSitesAssociationsCache.siteId, siteId),
                    inArray(
                        clientSitesAssociationsCache.clientId,
                        clientSitesToRemove
                    )
                )
            );
    }

    /////////// send the messages ///////////

    // Now handle the messages to add/remove peers on both the newt and olm sides
    await handleMessagesForSiteClients(
        site,
        siteId,
        mergedAllClients,
        existingClients,
        clientSitesToAdd,
        clientSitesToRemove,
        trx
    );

    // Handle subnet proxy target updates for the resource associations
    await handleSubnetProxyTargetUpdates(
        siteResource,
        mergedAllClients,
        existingResourceClients,
        clientSiteResourcesToAdd,
        clientSiteResourcesToRemove,
        trx
    );

    return {
        mergedAllClients
    };
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
    const clientsToProcess = new Map<
        number,
        {
            clientId: number;
            pubKey: string | null;
            subnet: string | null;
        }
    >();

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

            // TODO: should we have this here?
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
                            client.clientId
                        )
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
                        remoteSubnets: generateRemoteSubnets(
                            allSiteResources.map(
                                ({ siteResources }) => siteResources
                            )
                        )
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
        .innerJoin(
            clientSitesAssociationsCache,
            eq(sites.siteId, clientSitesAssociationsCache.siteId)
        )
        .leftJoin(exitNodes, eq(sites.exitNodeId, exitNodes.exitNodeId))
        .where(eq(clientSitesAssociationsCache.clientId, client.clientId));

    for (const site of sitesData) {
        if (!site.sites.subnet) {
            logger.warn(`Site ${site.sites.siteId} has no subnet, skipping`);
            continue;
        }

        if (!site.clientSitesAssociationsCache.endpoint) {
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
                sourceIp:
                    site.clientSitesAssociationsCache.endpoint.split(":")[0] ||
                    "",
                sourcePort:
                    parseInt(
                        site.clientSitesAssociationsCache.endpoint.split(":")[1]
                    ) || 0,
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

async function handleSubnetProxyTargetUpdates(
    siteResource: SiteResource,
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
    clientSiteResourcesToAdd: number[],
    clientSiteResourcesToRemove: number[],
    trx: Transaction | typeof db = db
): Promise<void> {
    // Get the newt for this site
    const [newt] = await trx
        .select()
        .from(newts)
        .where(eq(newts.siteId, siteResource.siteId))
        .limit(1);

    if (!newt) {
        logger.warn(
            `Newt not found for site ${siteResource.siteId}, skipping subnet proxy target updates`
        );
        return;
    }

    let proxyJobs = [];
    let olmJobs = [];
    // Generate targets for added associations
    if (clientSiteResourcesToAdd.length > 0) {
        const addedClients = allClients.filter((client) =>
            clientSiteResourcesToAdd.includes(client.clientId)
        );

        if (addedClients.length > 0) {
            const targetsToAdd = generateSubnetProxyTargets(
                siteResource,
                addedClients
            );

            if (targetsToAdd.length > 0) {
                logger.info(
                    `Adding ${targetsToAdd.length} subnet proxy targets for siteResource ${siteResource.siteResourceId}`
                );
                proxyJobs.push(
                    addSubnetProxyTargets(newt.newtId, targetsToAdd)
                );
            }

            for (const client of addedClients) {
                olmJobs.push(
                    addPeerData(
                        client.clientId,
                        siteResource.siteId,
                        generateRemoteSubnets([siteResource]),
                        generateAliasConfig([siteResource])
                    )
                );
            }
        }
    }

    // here we use the existingSiteResource from BEFORE we updated the destination so we dont need to worry about updating destinations here

    // Generate targets for removed associations
    if (clientSiteResourcesToRemove.length > 0) {
        const removedClients = existingClients.filter((client) =>
            clientSiteResourcesToRemove.includes(client.clientId)
        );

        if (removedClients.length > 0) {
            const targetsToRemove = generateSubnetProxyTargets(
                siteResource,
                removedClients
            );

            if (targetsToRemove.length > 0) {
                logger.info(
                    `Removing ${targetsToRemove.length} subnet proxy targets for siteResource ${siteResource.siteResourceId}`
                );
                proxyJobs.push(
                    removeSubnetProxyTargets(newt.newtId, targetsToRemove)
                );
            }

            for (const client of removedClients) {
                olmJobs.push(
                    removePeerData(
                        client.clientId,
                        siteResource.siteId,
                        generateRemoteSubnets([siteResource]),
                        generateAliasConfig([siteResource])
                    )
                );
            }
        }
    }

    await Promise.all(proxyJobs);
}

export async function rebuildClientAssociationsFromClient(
    client: Client,
    trx: Transaction | typeof db = db
): Promise<void> {
    let newSiteResourceIds: number[] = [];

    // 1. Direct client associations
    const directSiteResources = await trx
        .select({ siteResourceId: clientSiteResources.siteResourceId })
        .from(clientSiteResources)
        .where(eq(clientSiteResources.clientId, client.clientId));

    newSiteResourceIds.push(
        ...directSiteResources.map((r) => r.siteResourceId)
    );

    // 2. User-based and role-based access (if client has a userId)
    if (client.userId) {
        // Direct user associations
        const userSiteResourceIds = await trx
            .select({ siteResourceId: userSiteResources.siteResourceId })
            .from(userSiteResources)
            .where(eq(userSiteResources.userId, client.userId));

        newSiteResourceIds.push(
            ...userSiteResourceIds.map((r) => r.siteResourceId)
        );

        // Role-based access
        const roleIds = await trx
            .select({ roleId: userOrgs.roleId })
            .from(userOrgs)
            .where(eq(userOrgs.userId, client.userId))
            .then((rows) => rows.map((row) => row.roleId));

        if (roleIds.length > 0) {
            const roleSiteResourceIds = await trx
                .select({ siteResourceId: roleSiteResources.siteResourceId })
                .from(roleSiteResources)
                .where(inArray(roleSiteResources.roleId, roleIds));

            newSiteResourceIds.push(
                ...roleSiteResourceIds.map((r) => r.siteResourceId)
            );
        }
    }

    // Remove duplicates
    newSiteResourceIds = Array.from(new Set(newSiteResourceIds));

    // Get full siteResource details
    const newSiteResources =
        newSiteResourceIds.length > 0
            ? await trx
                  .select()
                  .from(siteResources)
                  .where(
                      inArray(siteResources.siteResourceId, newSiteResourceIds)
                  )
            : [];

    // Group by siteId for site-level associations
    const newSiteIds = Array.from(
        new Set(newSiteResources.map((sr) => sr.siteId))
    );

    /////////// Process client-siteResource associations ///////////

    // Get existing resource associations
    const existingResourceAssociations = await trx
        .select({
            siteResourceId: clientSiteResourcesAssociationsCache.siteResourceId
        })
        .from(clientSiteResourcesAssociationsCache)
        .where(
            eq(clientSiteResourcesAssociationsCache.clientId, client.clientId)
        );

    const existingSiteResourceIds = existingResourceAssociations.map(
        (r) => r.siteResourceId
    );

    const resourcesToAdd = newSiteResourceIds.filter(
        (id) => !existingSiteResourceIds.includes(id)
    );

    const resourcesToRemove = existingSiteResourceIds.filter(
        (id) => !newSiteResourceIds.includes(id)
    );

    // Insert new associations
    if (resourcesToAdd.length > 0) {
        await trx.insert(clientSiteResourcesAssociationsCache).values(
            resourcesToAdd.map((siteResourceId) => ({
                clientId: client.clientId,
                siteResourceId
            }))
        );
    }

    // Remove old associations
    if (resourcesToRemove.length > 0) {
        await trx
            .delete(clientSiteResourcesAssociationsCache)
            .where(
                and(
                    eq(
                        clientSiteResourcesAssociationsCache.clientId,
                        client.clientId
                    ),
                    inArray(
                        clientSiteResourcesAssociationsCache.siteResourceId,
                        resourcesToRemove
                    )
                )
            );
    }

    /////////// Process client-site associations ///////////

    // Get existing site associations
    const existingSiteAssociations = await trx
        .select({ siteId: clientSitesAssociationsCache.siteId })
        .from(clientSitesAssociationsCache)
        .where(eq(clientSitesAssociationsCache.clientId, client.clientId));

    const existingSiteIds = existingSiteAssociations.map((s) => s.siteId);

    const sitesToAdd = newSiteIds.filter((id) => !existingSiteIds.includes(id));
    const sitesToRemove = existingSiteIds.filter(
        (id) => !newSiteIds.includes(id)
    );

    // Insert new site associations
    if (sitesToAdd.length > 0) {
        await trx.insert(clientSitesAssociationsCache).values(
            sitesToAdd.map((siteId) => ({
                clientId: client.clientId,
                siteId
            }))
        );
    }

    // Remove old site associations
    if (sitesToRemove.length > 0) {
        await trx
            .delete(clientSitesAssociationsCache)
            .where(
                and(
                    eq(clientSitesAssociationsCache.clientId, client.clientId),
                    inArray(clientSitesAssociationsCache.siteId, sitesToRemove)
                )
            );
    }

    /////////// Send messages ///////////

    // Get the olm for this client
    const [olm] = await trx
        .select({ olmId: olms.olmId })
        .from(olms)
        .where(eq(olms.clientId, client.clientId))
        .limit(1);

    if (!olm) {
        logger.warn(
            `Olm not found for client ${client.clientId}, skipping peer updates`
        );
        return;
    }

    // Handle messages for sites being added
    await handleMessagesForClientSites(
        client,
        olm.olmId,
        sitesToAdd,
        sitesToRemove,
        trx
    );

    // Handle subnet proxy target updates for resources
    await handleMessagesForClientResources(
        client,
        newSiteResources,
        resourcesToAdd,
        resourcesToRemove,
        trx
    );
}

async function handleMessagesForClientSites(
    client: {
        clientId: number;
        pubKey: string | null;
        subnet: string | null;
        userId: string | null;
        orgId: string;
    },
    olmId: string,
    sitesToAdd: number[],
    sitesToRemove: number[],
    trx: Transaction | typeof db = db
): Promise<void> {
    if (!client.subnet || !client.pubKey) {
        logger.warn(
            `Client ${client.clientId} missing subnet or pubKey, skipping peer updates`
        );
        return;
    }

    const allSiteIds = [...sitesToAdd, ...sitesToRemove];
    if (allSiteIds.length === 0) {
        return;
    }

    // Get site details for all affected sites
    const sitesData = await trx
        .select()
        .from(sites)
        .leftJoin(exitNodes, eq(sites.exitNodeId, exitNodes.exitNodeId))
        .leftJoin(newts, eq(sites.siteId, newts.siteId))
        .where(inArray(sites.siteId, allSiteIds));

    let newtJobs: Promise<any>[] = [];
    let olmJobs: Promise<any>[] = [];
    let exitNodeJobs: Promise<any>[] = [];

    for (const siteData of sitesData) {
        const site = siteData.sites;
        const exitNode = siteData.exitNodes;
        const newt = siteData.newt;

        if (!site.publicKey) {
            logger.warn(
                `Site ${site.siteId} missing publicKey, skipping peer updates`
            );
            continue;
        }

        if (!newt) {
            logger.warn(
                `Newt not found for site ${site.siteId}, skipping peer updates`
            );
            continue;
        }

        const isAdd = sitesToAdd.includes(site.siteId);
        const isRemove = sitesToRemove.includes(site.siteId);

        if (isRemove) {
            // Remove peer from newt
            newtJobs.push(
                newtDeletePeer(site.siteId, client.pubKey, newt.newtId)
            );
            try {
                // Remove peer from olm
                olmJobs.push(
                    olmDeletePeer(
                        client.clientId,
                        site.siteId,
                        site.publicKey,
                        olmId
                    )
                );
            } catch (error) {
                // if the error includes not found then its just because the olm does not exist anymore or yet and its fine if we dont send
                if (
                    error instanceof Error &&
                    error.message.includes("not found")
                ) {
                    logger.debug(
                        `Olm data not found for client ${client.clientId}, skipping removal`
                    );
                } else {
                    throw error;
                }
            }
        }

        if (isAdd) {
            if (!exitNode) {
                logger.warn(
                    `Exit node not found for site ${site.siteId}, skipping peer add`
                );
                continue;
            }

            // Add peer to newt
            const isRelayed = true; // Default to relaying for new connections
            newtJobs.push(
                newtAddPeer(
                    site.siteId,
                    {
                        publicKey: client.pubKey,
                        allowedIps: [`${client.subnet.split("/")[0]}/32`],
                        endpoint: isRelayed ? "" : ""
                    },
                    newt.newtId
                )
            );

            // Get all site resources for this site that the client has access to
            const accessibleResources = await trx
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
                            client.clientId
                        )
                    )
                );
            try {
                // Add peer to olm
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
                            serverIP: site.address || "",
                            serverPort: site.listenPort || 0,
                            remoteSubnets: generateRemoteSubnets(
                                accessibleResources.map(
                                    ({ siteResources }) => siteResources
                                )
                            )
                        },
                        olmId
                    )
                );
            } catch (error) {
                // if the error includes not found then its just because the olm does not exist anymore or yet and its fine if we dont send
                if (
                    error instanceof Error &&
                    error.message.includes("not found")
                ) {
                    logger.debug(
                        `Olm data not found for client ${client.clientId}, skipping removal`
                    );
                } else {
                    throw error;
                }
            }
        }

        // Update exit node destinations
        exitNodeJobs.push(
            updateClientSiteDestinations(
                {
                    clientId: client.clientId,
                    pubKey: client.pubKey,
                    subnet: client.subnet
                },
                trx
            )
        );
    }

    await Promise.all(exitNodeJobs);
    await Promise.all(newtJobs);
    await Promise.all(olmJobs);
}

async function handleMessagesForClientResources(
    client: {
        clientId: number;
        pubKey: string | null;
        subnet: string | null;
        userId: string | null;
        orgId: string;
    },
    allNewResources: SiteResource[],
    resourcesToAdd: number[],
    resourcesToRemove: number[],
    trx: Transaction | typeof db = db
): Promise<void> {
    // Group resources by site
    const resourcesBySite = new Map<number, SiteResource[]>();

    for (const resource of allNewResources) {
        if (!resourcesBySite.has(resource.siteId)) {
            resourcesBySite.set(resource.siteId, []);
        }
        resourcesBySite.get(resource.siteId)!.push(resource);
    }

    let proxyJobs: Promise<any>[] = [];
    let olmJobs: Promise<any>[] = [];

    // Handle additions
    if (resourcesToAdd.length > 0) {
        const addedResources = allNewResources.filter((r) =>
            resourcesToAdd.includes(r.siteResourceId)
        );

        // Group by site for proxy updates
        const addedBySite = new Map<number, SiteResource[]>();
        for (const resource of addedResources) {
            if (!addedBySite.has(resource.siteId)) {
                addedBySite.set(resource.siteId, []);
            }
            addedBySite.get(resource.siteId)!.push(resource);
        }

        // Add subnet proxy targets for each site
        for (const [siteId, resources] of addedBySite.entries()) {
            const [newt] = await trx
                .select({ newtId: newts.newtId })
                .from(newts)
                .where(eq(newts.siteId, siteId))
                .limit(1);

            if (!newt) {
                logger.warn(
                    `Newt not found for site ${siteId}, skipping proxy updates`
                );
                continue;
            }

            for (const resource of resources) {
                const targets = generateSubnetProxyTargets(resource, [
                    {
                        clientId: client.clientId,
                        pubKey: client.pubKey,
                        subnet: client.subnet
                    }
                ]);

                if (targets.length > 0) {
                    proxyJobs.push(addSubnetProxyTargets(newt.newtId, targets));
                }

                try {
                    // Add peer data to olm
                    olmJobs.push(
                        addPeerData(
                            client.clientId,
                            resource.siteId,
                            generateRemoteSubnets([resource]),
                            generateAliasConfig([resource])
                        )
                    );
                } catch (error) {
                    // if the error includes not found then its just because the olm does not exist anymore or yet and its fine if we dont send
                    if (
                        error instanceof Error &&
                        error.message.includes("not found")
                    ) {
                        logger.debug(
                            `Olm data not found for client ${client.clientId} and site ${resource.siteId}, skipping removal`
                        );
                    } else {
                        throw error;
                    }
                }
            }
        }
    }

    // Handle removals
    if (resourcesToRemove.length > 0) {
        const removedResources = await trx
            .select()
            .from(siteResources)
            .where(inArray(siteResources.siteResourceId, resourcesToRemove));

        // Group by site for proxy updates
        const removedBySite = new Map<number, SiteResource[]>();
        for (const resource of removedResources) {
            if (!removedBySite.has(resource.siteId)) {
                removedBySite.set(resource.siteId, []);
            }
            removedBySite.get(resource.siteId)!.push(resource);
        }

        // Remove subnet proxy targets for each site
        for (const [siteId, resources] of removedBySite.entries()) {
            const [newt] = await trx
                .select({ newtId: newts.newtId })
                .from(newts)
                .where(eq(newts.siteId, siteId))
                .limit(1);

            if (!newt) {
                logger.warn(
                    `Newt not found for site ${siteId}, skipping proxy updates`
                );
                continue;
            }

            for (const resource of resources) {
                const targets = generateSubnetProxyTargets(resource, [
                    {
                        clientId: client.clientId,
                        pubKey: client.pubKey,
                        subnet: client.subnet
                    }
                ]);

                if (targets.length > 0) {
                    proxyJobs.push(
                        removeSubnetProxyTargets(newt.newtId, targets)
                    );
                }

                try {
                    // Remove peer data from olm
                    olmJobs.push(
                        removePeerData(
                            client.clientId,
                            resource.siteId,
                            generateRemoteSubnets([resource]),
                            generateAliasConfig([resource])
                        )
                    );
                } catch (error) {
                    // if the error includes not found then its just because the olm does not exist anymore or yet and its fine if we dont send
                    if (
                        error instanceof Error &&
                        error.message.includes("not found")
                    ) {
                        logger.debug(
                            `Olm data not found for client ${client.clientId} and site ${resource.siteId}, skipping removal`
                        );
                    } else {
                        throw error;
                    }
                }
            }
        }
    }

    await Promise.all([...proxyJobs, ...olmJobs]);
}
