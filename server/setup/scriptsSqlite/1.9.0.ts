import { APP_PATH } from "@server/lib/consts";
import Database from "better-sqlite3";
import path from "path";

const version = "1.9.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    const location = path.join(APP_PATH, "db", "db.sqlite");
    const db = new Database(location);

    try {
        db.pragma("foreign_keys = OFF");

        db.transaction(() => {
            db.exec(`
                CREATE TABLE 'setupTokens' (
                    'tokenId' text PRIMARY KEY NOT NULL,
                    'token' text NOT NULL,
                    'used' integer DEFAULT 0 NOT NULL,
                    'dateCreated' text NOT NULL,
                    'dateUsed' text
                );
            `);
        })();

        db.pragma("foreign_keys = ON");

        console.log(`Added setupTokens table`);
    } catch (e) {
        console.log("Unable to add setupTokens table:", e);
        throw e;
    }
} 