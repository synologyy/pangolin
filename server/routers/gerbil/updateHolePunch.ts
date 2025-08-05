import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
    clients,
    newts,
    olms,
    Site,
    sites,
    clientSites,
    exitNodes
} from "@server/db";
import { db } from "@server/db";
import { eq, and } from "drizzle-orm";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { validateNewtSessionToken } from "@server/auth/sessions/newt";
import { validateOlmSessionToken } from "@server/auth/sessions/olm";
import axios from "axios";

// Define Zod schema for request validation
const updateHolePunchSchema = z.object({
    olmId: z.string().optional(),
    newtId: z.string().optional(),
    token: z.string(),
    ip: z.string(),
    port: z.number(),
    timestamp: z.number(),
    reachableAt: z.string().optional(),
    publicKey: z.string()
});

// New response type with multi-peer destination support
interface PeerDestination {
    destinationIP: string;
    destinationPort: number;
}

export async function updateHolePunch(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        // Validate request parameters
        const parsedParams = updateHolePunchSchema.safeParse(req.body);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const {
            olmId,
            newtId,
            ip,
            port,
            timestamp,
            token,
            reachableAt,
            publicKey
        } = parsedParams.data;

        let currentSiteId: number | undefined;
        let destinations: PeerDestination[] = [];

        if (olmId) {
            logger.debug(
                `Got hole punch with ip: ${ip}, port: ${port} for olmId: ${olmId}${publicKey ? ` with exit node publicKey: ${publicKey}` : ""}`
            );

            const { session, olm: olmSession } =
                await validateOlmSessionToken(token);
            if (!session || !olmSession) {
                return next(
                    createHttpError(HttpCode.UNAUTHORIZED, "Unauthorized")
                );
            }

            if (olmId !== olmSession.olmId) {
                logger.warn(
                    `Olm ID mismatch: ${olmId} !== ${olmSession.olmId}`
                );
                return next(
                    createHttpError(HttpCode.UNAUTHORIZED, "Unauthorized")
                );
            }

            const [olm] = await db
                .select()
                .from(olms)
                .where(eq(olms.olmId, olmId));

            if (!olm || !olm.clientId) {
                logger.warn(`Olm not found: ${olmId}`);
                return next(
                    createHttpError(HttpCode.NOT_FOUND, "Olm not found")
                );
            }

            const [client] = await db
                .update(clients)
                .set({
                    lastHolePunch: timestamp
                })
                .where(eq(clients.clientId, olm.clientId))
                .returning();

            // Get the exit node by public key
            const [exitNode] = await db
                .select()
                .from(exitNodes)
                .where(eq(exitNodes.publicKey, publicKey));

            if (exitNode) {
                // Get sites that are on this specific exit node and connected to this client
                const sitesOnExitNode = await db
                    .select({ siteId: sites.siteId })
                    .from(sites)
                    .innerJoin(
                        clientSites,
                        eq(sites.siteId, clientSites.siteId)
                    )
                    .where(
                        and(
                            eq(sites.exitNodeId, exitNode.exitNodeId),
                            eq(clientSites.clientId, olm.clientId)
                        )
                    );

                // Update clientSites for each site on this exit node
                for (const site of sitesOnExitNode) {
                    await db
                        .update(clientSites)
                        .set({
                            endpoint: `${ip}:${port}`
                        })
                        .where(
                            and(
                                eq(clientSites.clientId, olm.clientId),
                                eq(clientSites.siteId, site.siteId)
                            )
                        );
                }

                logger.debug(
                    `Updated ${sitesOnExitNode.length} sites on exit node with publicKey: ${publicKey}`
                );
            } else {
                logger.warn(`Exit node not found for publicKey: ${publicKey}`);
            }

            if (!client) {
                logger.warn(`Client not found for olm: ${olmId}`);
                return next(
                    createHttpError(HttpCode.NOT_FOUND, "Client not found")
                );
            }

            // // Get all sites that this client is connected to
            // const clientSitePairs = await db
            //     .select()
            //     .from(clientSites)
            //     .where(eq(clientSites.clientId, client.clientId));

            // if (clientSitePairs.length === 0) {
            //     logger.warn(`No sites found for client: ${client.clientId}`);
            //     return next(
            //         createHttpError(HttpCode.NOT_FOUND, "No sites found for client")
            //     );
            // }

            // // Get all sites details
            // const siteIds = clientSitePairs.map(pair => pair.siteId);

            // for (const siteId of siteIds) {
            //     const [site] = await db
            //         .select()
            //         .from(sites)
            //         .where(eq(sites.siteId, siteId));

            //     if (site && site.subnet && site.listenPort) {
            //         destinations.push({
            //             destinationIP: site.subnet.split("/")[0],
            //             destinationPort: site.listenPort
            //         });
            //     }
            // }

            // get all sites for this client and join with exit nodes with site.exitNodeId
            const sitesData = await db
                .select()
                .from(sites)
                .innerJoin(clientSites, eq(sites.siteId, clientSites.siteId))
                .leftJoin(exitNodes, eq(sites.exitNodeId, exitNodes.exitNodeId))
                .where(eq(clientSites.clientId, client.clientId));

            let exitNodeDestinations: {
                reachableAt: string;
                destinations: PeerDestination[];
            }[] = [];

            for (const site of sitesData) {
                if (!site.sites.subnet) {
                    logger.warn(
                        `Site ${site.sites.siteId} has no subnet, skipping`
                    );
                    continue;
                }
                // find the destinations in the array
                let destinations = exitNodeDestinations.find(
                    (d) => d.reachableAt === site.exitNodes?.reachableAt
                );

                if (!destinations) {
                    destinations = {
                        reachableAt: site.exitNodes?.reachableAt || "",
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

            logger.debug(JSON.stringify(exitNodeDestinations, null, 2));

            // BECAUSE OF HARD NAT YOU DONT WANT TO SEND THE OLM IP AND PORT TO THE ALL THE OTHER EXIT NODES
            // BECAUSE THEY WILL GET A DIFFERENT IP AND PORT

            // for (const destination of exitNodeDestinations) {
            //     // if its the current exit node skip it because it is replying with the same data
            //     if (reachableAt && destination.reachableAt == reachableAt) {
            //         logger.debug(`Skipping update for reachableAt: ${reachableAt}`);
            //         continue;
            //     }

            //     try {
            //         const response = await axios.post(
            //             `${destination.reachableAt}/update-destinations`,
            //             {
            //                 sourceIp: client.endpoint?.split(":")[0] || "",
            //                 sourcePort: parseInt(client.endpoint?.split(":")[1] || "0"),
            //                 destinations: destination.destinations
            //             },
            //             {
            //                 headers: {
            //                     "Content-Type": "application/json"
            //                 }
            //             }
            //         );

            //         logger.info("Destinations updated:", {
            //             peer: response.data.status
            //         });
            //     } catch (error) {
            //         if (axios.isAxiosError(error)) {
            //             logger.error(
            //                 `Error updating destinations (can Pangolin see Gerbil HTTP API?) for exit node at ${destination.reachableAt} (status: ${error.response?.status}): ${JSON.stringify(error.response?.data, null, 2)}`
            //             );
            //         } else {
            //             logger.error(
            //                 `Error updating destinations for exit node at ${destination.reachableAt}: ${error}`
            //             );
            //         }
            //     }
            // }

            // Send the desinations back to the origin
            destinations =
                exitNodeDestinations.find((d) => d.reachableAt === reachableAt)
                    ?.destinations || [];
        } else if (newtId) {
            logger.debug(
                `Got hole punch with ip: ${ip}, port: ${port} for newtId: ${newtId}`
            );

            const { session, newt: newtSession } =
                await validateNewtSessionToken(token);

            if (!session || !newtSession) {
                return next(
                    createHttpError(HttpCode.UNAUTHORIZED, "Unauthorized")
                );
            }

            if (newtId !== newtSession.newtId) {
                logger.warn(
                    `Newt ID mismatch: ${newtId} !== ${newtSession.newtId}`
                );
                return next(
                    createHttpError(HttpCode.UNAUTHORIZED, "Unauthorized")
                );
            }

            const [newt] = await db
                .select()
                .from(newts)
                .where(eq(newts.newtId, newtId));

            if (!newt || !newt.siteId) {
                logger.warn(`Newt not found: ${newtId}`);
                return next(
                    createHttpError(HttpCode.NOT_FOUND, "New not found")
                );
            }

            currentSiteId = newt.siteId;

            // Update the current site with the new endpoint
            const [updatedSite] = await db
                .update(sites)
                .set({
                    endpoint: `${ip}:${port}`,
                    lastHolePunch: timestamp
                })
                .where(eq(sites.siteId, newt.siteId))
                .returning();

            if (!updatedSite || !updatedSite.subnet) {
                logger.warn(`Site not found: ${newt.siteId}`);
                return next(
                    createHttpError(HttpCode.NOT_FOUND, "Site not found")
                );
            }

            // Find all clients that connect to this site
            // const sitesClientPairs = await db
            //     .select()
            //     .from(clientSites)
            //     .where(eq(clientSites.siteId, newt.siteId));

            // THE NEWT IS NOT SENDING RAW WG TO THE GERBIL SO IDK IF WE REALLY NEED THIS - REMOVING
            // Get client details for each client
            // for (const pair of sitesClientPairs) {
            //     const [client] = await db
            //         .select()
            //         .from(clients)
            //         .where(eq(clients.clientId, pair.clientId));

            //     if (client && client.endpoint) {
            //         const [host, portStr] = client.endpoint.split(':');
            //         if (host && portStr) {
            //             destinations.push({
            //                 destinationIP: host,
            //                 destinationPort: parseInt(portStr, 10)
            //             });
            //         }
            //     }
            // }

            // If this is a newt/site, also add other sites in the same org
            //     if (updatedSite.orgId) {
            //         const orgSites = await db
            //             .select()
            //             .from(sites)
            //             .where(eq(sites.orgId, updatedSite.orgId));

            //         for (const site of orgSites) {
            //             // Don't add the current site to the destinations
            //             if (site.siteId !== currentSiteId && site.subnet && site.endpoint && site.listenPort) {
            //                 const [host, portStr] = site.endpoint.split(':');
            //                 if (host && portStr) {
            //                     destinations.push({
            //                         destinationIP: host,
            //                         destinationPort: site.listenPort
            //                     });
            //                 }
            //             }
            //         }
            //     }
        }

        // if (destinations.length === 0) {
        //     logger.warn(
        //         `No peer destinations found for olmId: ${olmId} or newtId: ${newtId}`
        //     );
        //     return next(createHttpError(HttpCode.NOT_FOUND, "No peer destinations found"));
        // }

        // Return the new multi-peer structure
        return res.status(HttpCode.OK).send({
            destinations: destinations
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "An error occurred..."
            )
        );
    }
}
