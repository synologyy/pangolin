import { APP_PATH } from "@server/lib/consts";
import Database from "better-sqlite3";
import path from "path";

const version = "1.10.2";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    const location = path.join(APP_PATH, "db", "db.sqlite");
    const db = new Database(location);

    const resources = db.prepare("SELECT * FROM resources").all() as Array<{
        resourceId: number;
        headers: string | null;
    }>;

    try {
        db.pragma("foreign_keys = OFF");

        db.transaction(() => {
            for (const resource of resources) {
                const headers = resource.headers;
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

                    db.prepare(
                        `
                            UPDATE "resources" SET "headers" = ? WHERE "resourceId" = ?`
                    ).run(JSON.stringify(headersArray), resource.resourceId);

                    console.log(
                        `Updated resource ${resource.resourceId} headers to JSON format`
                    );
                }
            }
        })();

        db.pragma("foreign_keys = ON");

        console.log(`Migrated database`);
    } catch (e) {
        console.log("Failed to migrate db:", e);
        throw e;
    }
}
