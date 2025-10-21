import { db } from "@server/db/pg/driver";
import { sql } from "drizzle-orm";

const version = "1.11.1";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    try {
        await db.execute(sql`BEGIN`);

        // Get the first exit node with type 'gerbil'
        const exitNodesQuery = await db.execute(
            sql`SELECT * FROM "exitNodes" WHERE "type" = 'gerbil' LIMIT 1`
        );
        const exitNodes = exitNodesQuery.rows as {
            exitNodeId: number;
        }[];

        const exitNodeId = exitNodes.length > 0 ? exitNodes[0].exitNodeId : null;

        // Get all sites with type 'local'
        const sitesQuery = await db.execute(
            sql`SELECT "siteId" FROM "sites" WHERE "type" = 'local'`
        );
        const sites = sitesQuery.rows as {
            siteId: number;
        }[];

        // Update sites to use the exit node
        for (const site of sites) {
            await db.execute(sql`
                UPDATE "sites" SET "exitNode" = ${exitNodeId} WHERE "siteId" = ${site.siteId}
            `);
        }

        await db.execute(sql`UPDATE "exitNodes" SET "online" = true`); // Mark exit nodes as online

        await db.execute(sql`COMMIT`);
        console.log(`Updated sites with exit node`);
    } catch (e) {
        await db.execute(sql`ROLLBACK`);
        console.log("Unable to update sites with exit node");
        console.log(e);
        throw e;
    }

    console.log(`${version} migration complete`);
}
