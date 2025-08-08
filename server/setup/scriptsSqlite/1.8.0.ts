import { APP_PATH } from "@server/lib/consts";
import Database from "better-sqlite3";
import path from "path";

const version = "1.8.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    const location = path.join(APP_PATH, "db", "db.sqlite");
    const db = new Database(location);

    try {
        db.transaction(() => {
            db.exec(`
                ALTER TABLE 'resources' ADD 'enableProxy' integer DEFAULT 1;
                ALTER TABLE 'sites' ADD 'remoteSubnets' text;
                ALTER TABLE 'user' ADD 'termsAcceptedTimestamp' text;
                ALTER TABLE 'user' ADD 'termsVersion' text;
            `);
        })();

        console.log("Migrated database schema");
    } catch (e) {
        console.log("Unable to migrate database schema");
        throw e;
    }

    console.log(`${version} migration complete`);
}
