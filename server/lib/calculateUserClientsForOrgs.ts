import { clients, clientSites, db, olms, orgs, roleClients, roles, userClients, userOrgs, Transaction } from "@server/db";
import { eq, and, notInArray } from "drizzle-orm";
import { listExitNodes } from "#dynamic/lib/exitNodes";
import { getNextAvailableClientSubnet } from "@server/lib/ip";
import logger from "@server/logger";

export async function calculateUserClientsForOrgs(
    userId: string,
    trx?: Transaction
): Promise<void> {
    const execute = async (transaction: Transaction) => {
        // Get all OLMs for this user
        const userOlms = await transaction
            .select()
            .from(olms)
            .where(eq(olms.userId, userId));

        if (userOlms.length === 0) {
            // No OLMs for this user, but we should still clean up any orphaned clients
            await cleanupOrphanedClients(userId, transaction);
            return;
        }

        // Get all user orgs
        const allUserOrgs = await transaction
            .select()
            .from(userOrgs)
            .where(eq(userOrgs.userId, userId));

        const userOrgIds = allUserOrgs.map((uo) => uo.orgId);

        // For each OLM, ensure there's a client in each org the user is in
        for (const olm of userOlms) {
            for (const userOrg of allUserOrgs) {
                const orgId = userOrg.orgId;

                const [org] = await transaction
                    .select()
                    .from(orgs)
                    .where(eq(orgs.orgId, orgId));

                if (!org) {
                    logger.warn(
                        `Skipping org ${orgId} for OLM ${olm.olmId} (user ${userId}): org not found`
                    );
                    continue;
                }

                if (!org.subnet) {
                    logger.warn(
                        `Skipping org ${orgId} for OLM ${olm.olmId} (user ${userId}): org has no subnet configured`
                    );
                    continue;
                }

                // Get admin role for this org (needed for access grants)
                const [adminRole] = await transaction
                    .select()
                    .from(roles)
                    .where(and(eq(roles.isAdmin, true), eq(roles.orgId, orgId)))
                    .limit(1);

                if (!adminRole) {
                    logger.warn(
                        `Skipping org ${orgId} for OLM ${olm.olmId} (user ${userId}): no admin role found`
                    );
                    continue;
                }

                // Check if a client already exists for this OLM+user+org combination
                const [existingClient] = await transaction
                    .select()
                    .from(clients)
                    .where(
                        and(
                            eq(clients.userId, userId),
                            eq(clients.orgId, orgId),
                            eq(clients.olmId, olm.olmId)
                        )
                    )
                    .limit(1);

                if (existingClient) {
                    // Ensure admin role has access to the client
                    const [existingRoleClient] = await transaction
                        .select()
                        .from(roleClients)
                        .where(
                            and(
                                eq(roleClients.roleId, adminRole.roleId),
                                eq(roleClients.clientId, existingClient.clientId)
                            )
                        )
                        .limit(1);

                    if (!existingRoleClient) {
                        await transaction.insert(roleClients).values({
                            roleId: adminRole.roleId,
                            clientId: existingClient.clientId
                        });
                        logger.debug(
                            `Granted admin role access to existing client ${existingClient.clientId} for OLM ${olm.olmId} in org ${orgId} (user ${userId})`
                        );
                    }

                    // Ensure user has access to the client
                    const [existingUserClient] = await transaction
                        .select()
                        .from(userClients)
                        .where(
                            and(
                                eq(userClients.userId, userId),
                                eq(userClients.clientId, existingClient.clientId)
                            )
                        )
                        .limit(1);

                    if (!existingUserClient) {
                        await transaction.insert(userClients).values({
                            userId,
                            clientId: existingClient.clientId
                        });
                        logger.debug(
                            `Granted user access to existing client ${existingClient.clientId} for OLM ${olm.olmId} in org ${orgId} (user ${userId})`
                        );
                    }

                    logger.debug(
                        `Client already exists for OLM ${olm.olmId} in org ${orgId} (user ${userId}), skipping creation`
                    );
                    continue;
                }

                // Get exit nodes for this org
                const exitNodesList = await listExitNodes(orgId);

                if (exitNodesList.length === 0) {
                    logger.warn(
                        `Skipping org ${orgId} for OLM ${olm.olmId} (user ${userId}): no exit nodes found`
                    );
                    continue;
                }

                const randomExitNode =
                    exitNodesList[
                        Math.floor(Math.random() * exitNodesList.length)
                    ];

                // Get next available subnet
                const newSubnet = await getNextAvailableClientSubnet(orgId);
                if (!newSubnet) {
                    logger.warn(
                        `Skipping org ${orgId} for OLM ${olm.olmId} (user ${userId}): no available subnet found`
                    );
                    continue;
                }

                const subnet = newSubnet.split("/")[0];
                const updatedSubnet = `${subnet}/${org.subnet.split("/")[1]}`;

                // Create the client
                const [newClient] = await transaction
                    .insert(clients)
                    .values({
                        userId,
                        orgId: userOrg.orgId,
                        exitNodeId: randomExitNode.exitNodeId,
                        name: olm.name || "User Client",
                        subnet: updatedSubnet,
                        olmId: olm.olmId,
                        type: "olm"
                    })
                    .returning();

                // Grant admin role access to the client
                await transaction.insert(roleClients).values({
                    roleId: adminRole.roleId,
                    clientId: newClient.clientId
                });

                // Grant user access to the client
                await transaction.insert(userClients).values({
                    userId,
                    clientId: newClient.clientId
                });

                logger.debug(
                    `Created client for OLM ${olm.olmId} in org ${orgId} (user ${userId}) with access granted to admin role and user`
                );
            }
        }

        // Clean up clients in orgs the user is no longer in
        await cleanupOrphanedClients(userId, transaction, userOrgIds);
    };

    if (trx) {
        // Use provided transaction
        await execute(trx);
    } else {
        // Create new transaction
        await db.transaction(async (transaction) => {
            await execute(transaction);
        });
    }
}

async function cleanupOrphanedClients(
    userId: string,
    trx: Transaction,
    userOrgIds: string[] = []
): Promise<void> {
    // Find all OLM clients for this user that should be deleted
    // If userOrgIds is empty, delete all OLM clients (user has no orgs)
    // If userOrgIds has values, delete clients in orgs they're not in
    const clientsToDelete = await trx
        .select({ clientId: clients.clientId })
        .from(clients)
        .where(
            userOrgIds.length > 0
                ? and(
                      eq(clients.userId, userId),
                      notInArray(clients.orgId, userOrgIds)
                  )
                : and(eq(clients.userId, userId))
        );

    // Delete client-site associations first, then delete the clients
    for (const client of clientsToDelete) {
        await trx
            .delete(clientSites)
            .where(eq(clientSites.clientId, client.clientId));
    }

    if (clientsToDelete.length > 0) {
        await trx
            .delete(clients)
            .where(
                userOrgIds.length > 0
                    ? and(
                          eq(clients.userId, userId),
                          notInArray(clients.orgId, userOrgIds)
                      )
                    : and(eq(clients.userId, userId))
            );

        if (userOrgIds.length === 0) {
            logger.debug(
                `Deleted all ${clientsToDelete.length} OLM client(s) for user ${userId} (user has no orgs)`
            );
        } else {
            logger.debug(
                `Deleted ${clientsToDelete.length} orphaned OLM client(s) for user ${userId} in orgs they're no longer in`
            );
        }
    }
}

