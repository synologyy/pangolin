import { db } from "@server/db/pg/driver";
import { sql } from "drizzle-orm";
import { __DIRNAME, APP_PATH } from "@server/lib/consts";
import { readFileSync } from "fs";
import path, { join } from "path";

const version = "1.10.1";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    try {
        const resources = await db.execute(sql`
            SELECT * FROM "resources"
        `);

        await db.execute(sql`BEGIN`);

        for (const resource of resources.rows) {
            const headers = resource.headers as string | null;
            if (headers && headers !== "") {
                // lets convert it to json
                // fist split at commas
                const headersArray = headers
                    .split(",")
                    .map((header: string) => {
                        const [name, ...valueParts] = header.split(":");
                        const value = valueParts.join(":").trim();
                        return { name: name.trim(), value };
                    });

                await db.execute(sql`
                    UPDATE "resources" SET "headers" = ${JSON.stringify(headersArray)} WHERE "resourceId" = ${resource.resourceId}
                `);

                console.log(
                    `Updated resource ${resource.resourceId} headers to JSON format`
                );
            }
        }

        await db.execute(sql`COMMIT`);
        console.log(`Migrated database`);
    } catch (e) {
        await db.execute(sql`ROLLBACK`);
        console.log("Failed to migrate db:", e);
        throw e;
    }
}
