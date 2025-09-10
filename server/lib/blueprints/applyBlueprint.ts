import { db, newts, Target } from "@server/db";
import { Config, ConfigSchema } from "./types";
import { ResourcesResults, updateResources } from "./resources";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";
import { resources, targets, sites } from "@server/db";
import { eq, and, asc, or, ne, count, isNotNull } from "drizzle-orm";
import { addTargets } from "@server/routers/newt/targets";

export async function applyBlueprint(
    orgId: string,
    configData: unknown,
    siteId?: number
): Promise<void> {
    // Validate the input data
    const validationResult = ConfigSchema.safeParse(configData);
    if (!validationResult.success) {
        throw new Error(fromError(validationResult.error).toString());
    }

    const config: Config = validationResult.data;

    try {
        let resourcesResults: ResourcesResults = [];
        await db.transaction(async (trx) => {
            resourcesResults = await updateResources(orgId, config, trx, siteId);
        });

        logger.debug(
            `Successfully updated resources for org ${orgId}: ${JSON.stringify(resourcesResults)}`
        );

        // We need to update the targets on the newts from the successfully updated information
        for (const result of resourcesResults) {
            for (const target of result.targetsToUpdate) {
                const [site] = await db
                    .select()
                    .from(sites)
                    .innerJoin(newts, eq(sites.siteId, newts.siteId))
                    .where(
                        and(
                            eq(sites.siteId, target.siteId),
                            eq(sites.orgId, orgId),
                            eq(sites.type, "newt"),
                            isNotNull(sites.pubKey)
                        )
                    )
                    .limit(1);

                if (site) {
                    logger.debug(
                        `Updating target ${target.targetId} on site ${site.sites.siteId}`
                    );

                    await addTargets(
                        site.newt.newtId,
                        [target],
                        result.resource.protocol,
                        result.resource.proxyPort
                    );
                }
            }
        }
    } catch (error) {
        logger.error(`Failed to update database from config: ${error}`);
        throw error;
    }
}

// await updateDatabaseFromConfig("org_i21aifypnlyxur2", {
//     resources: {
//         "resource-nice-id": {
//             name: "this is my resource",
//             protocol: "http",
//             "full-domain": "level1.test.example.com",
//             "host-header": "example.com",
//             "tls-server-name": "example.com",
//             auth: {
//                 pincode: 123456,
//                 password: "sadfasdfadsf",
//                 "sso-enabled": true,
//                 "sso-roles": ["Member"],
//                 "sso-users": ["owen@fossorial.io"],
//                 "whitelist-users": ["owen@fossorial.io"]
//             },
//             targets: [
//                 {
//                     site: "glossy-plains-viscacha-rat",
//                     hostname: "localhost",
//                     method: "http",
//                     port: 8000,
//                     healthcheck: {
//                         port: 8000,
//                         hostname: "localhost"
//                     }
//                 },
//                 {
//                     site: "glossy-plains-viscacha-rat",
//                     hostname: "localhost",
//                     method: "http",
//                     port: 8001
//                 }
//             ]
//         },
        // "resource-nice-id2": {
        //     name: "http server",
        //     protocol: "tcp",
        //     "proxy-port": 3000,
        //     targets: [
        //         {
        //             site: "glossy-plains-viscacha-rat",
        //             hostname: "localhost",
        //             port: 3000,
        //         }
        //     ]
        // }
//     }
// });
