import { db } from "@server/db/pg/driver";
import { sql } from "drizzle-orm";
import { __DIRNAME, APP_PATH } from "@server/lib/consts";
import { readFileSync } from "fs";
import path, { join } from "path";

const version = "1.10.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    try {
        const resources = await db.execute(sql`
            SELECT "resourceId" FROM "resources" WHERE "siteId" IS NOT NULL
        `);

        await db.execute(sql`BEGIN`);

        await db.execute(sql`ALTER TABLE "exitNodes" ADD COLUMN "region" text;`);
        
        await db.execute(sql`ALTER TABLE "idpOidcConfig" ADD COLUMN "variant" text DEFAULT 'oidc' NOT NULL;`);
        
        await db.execute(sql`ALTER TABLE "resources" ADD COLUMN "niceId" text DEFAULT '' NOT NULL;`);
        
        await db.execute(sql`ALTER TABLE "userOrgs" ADD COLUMN "autoProvisioned" boolean DEFAULT false;`);

        const usedNiceIds: string[] = [];

        for (const resource of resources.rows) {
            // Generate a unique name and ensure it's unique
            let niceId = "";
            let loops = 0;
            while (true) {
                if (loops > 100) {
                    throw new Error("Could not generate a unique name");
                }

                niceId = generateName();
                if (!usedNiceIds.includes(niceId)) {
                    usedNiceIds.push(niceId);
                    break;
                }
                loops++;
            }
            await db.execute(sql`
                UPDATE "resources" SET "niceId" = ${niceId} WHERE "resourceId" = ${resource.resourceId}
            `);
        }

        await db.execute(sql`COMMIT`);
        console.log(`Migrated database`);
    } catch (e) {
        await db.execute(sql`ROLLBACK`);
        console.log("Failed to migrate db:", e);
        throw e;
    }
}

const dev = process.env.ENVIRONMENT !== "prod";
let file;
if (!dev) {
    file = join(__DIRNAME, "names.json");
} else {
    file = join("server/db/names.json");
}
export const names = JSON.parse(readFileSync(file, "utf-8"));

export function generateName(): string {
    const name = (
        names.descriptors[
            Math.floor(Math.random() * names.descriptors.length)
        ] +
        "-" +
        names.animals[Math.floor(Math.random() * names.animals.length)]
    )
        .toLowerCase()
        .replace(/\s/g, "-");

    // clean out any non-alphanumeric characters except for dashes
    return name.replace(/[^a-z0-9-]/g, "");
}
