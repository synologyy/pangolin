import { APP_PATH } from "@server/lib/consts";
import Database from "better-sqlite3";
import path from "path";

const version = "1.11.1";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    const location = path.join(APP_PATH, "db", "db.sqlite");
    const db = new Database(location);

    db.transaction(() => {
        const exitNodes = db
            .prepare(`SELECT * FROM exitNodes WHERE type = 'gerbil' LIMIT 1`)
            .all() as {
            exitNodeId: number;
            name: string;
        }[];

        const exitNodeId =
            exitNodes.length > 0 ? exitNodes[0].exitNodeId : null;

        // get all of the targets
        const sites = db
            .prepare(`SELECT * FROM sites WHERE type = 'local'`)
            .all() as {
            siteId: number;
            exitNodeId: number | null;
        }[];

        const defineExitNodeOnSite = db.prepare(
            `UPDATE sites SET exitNodeId = ? WHERE siteId = ?`
        );

        for (const site of sites) {
            defineExitNodeOnSite.run(exitNodeId, site.siteId);
        }

        db.prepare(`UPDATE exitNodes SET online = 1`).run(); // mark exit nodes as online
    })();

    console.log(`${version} migration complete`);
}
