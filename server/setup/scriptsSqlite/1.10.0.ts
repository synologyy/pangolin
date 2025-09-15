import { __DIRNAME, APP_PATH } from "@server/lib/consts";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path, { join } from "path";

const version = "1.10.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    const location = path.join(APP_PATH, "db", "db.sqlite");
    const db = new Database(location);

    const resourceSiteMap = new Map<number, number>();
    const firstSiteId: number = 1;

    try {
        const resources = db
            .prepare(
                "SELECT resourceId FROM resources"
            )
            .all() as Array<{ resourceId: number }>;

        const siteResources = db
            .prepare(
                "SELECT siteResourceId FROM siteResources"
            )
            .all() as Array<{ siteResourceId: number }>;

        db.transaction(() => {
            db.exec(`
                ALTER TABLE 'exitNodes' ADD 'region' text;
                ALTER TABLE 'idpOidcConfig' ADD 'variant' text DEFAULT 'oidc' NOT NULL;
                ALTER TABLE 'resources' ADD 'niceId' text DEFAULT '' NOT NULL;
                ALTER TABLE 'userOrgs' ADD 'autoProvisioned' integer DEFAULT false;
                ALTER TABLE 'targets' ADD 'pathMatchType' text;
                ALTER TABLE 'targets' ADD 'path' text;
                ALTER TABLE 'resources' ADD 'headers' text;
                ALTER TABLE 'siteResources' ADD 'niceId' text NOT NULL;
            `); // this diverges from the schema a bit because the schema does not have a default on niceId but was required for the migration and I dont think it will effect much down the line...

            const usedNiceIds: string[] = [];

            for (const resourceId of resources) {
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
                db.prepare(
                    `UPDATE resources SET niceId = ? WHERE resourceId = ?`
                ).run(niceId, resourceId.resourceId);
            }

            for (const resourceId of siteResources) {
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
                db.prepare(
                    `UPDATE siteResources SET niceId = ? WHERE siteResourceId = ?`
                ).run(niceId, resourceId.siteResourceId);
            }
        })();

        console.log(`Migrated database`);
    } catch (e) {
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
