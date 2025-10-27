import { db } from "@server/db/pg/driver";
import { sql } from "drizzle-orm";

const version = "1.11.2";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    try {
        await db.execute(sql`BEGIN`);

        await db.execute(sql`UPDATE "resourceRules" SET "match" = "COUNTRY" WHERE "match" = "GEOIP"`);

        await db.execute(sql`COMMIT`);
        console.log(`Updated resource rules match value from GEOIP to COUNTRY`);
    } catch (e) {
        await db.execute(sql`ROLLBACK`);
        console.log("Unable to update resource rules match value");
        console.log(e);
        throw e;
    }

    console.log(`${version} migration complete`);
}
