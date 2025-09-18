import { __DIRNAME, APP_PATH } from "@server/lib/consts";
import Database from "better-sqlite3";
import path from "path";

const version = "1.10.1";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    const location = path.join(APP_PATH, "db", "db.sqlite");
    const db = new Database(location);

    try {
        db.pragma("foreign_keys = OFF");

        db.transaction(() => {
            db.exec(`PRAGMA foreign_keys = OFF;

-- 1. Rename the old table
ALTER TABLE targets RENAME TO targets_old;

-- 2. Create the new table
CREATE TABLE targets (
    targetId INTEGER PRIMARY KEY AUTOINCREMENT,
    resourceId INTEGER NOT NULL,
    siteId INTEGER NOT NULL,
    ip TEXT NOT NULL,
    method TEXT,
    port INTEGER NOT NULL,
    internalPort INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    path TEXT,
    pathMatchType TEXT,
    FOREIGN KEY (resourceId) REFERENCES resources(resourceId) ON DELETE CASCADE,
    FOREIGN KEY (siteId) REFERENCES sites(siteId) ON DELETE CASCADE
);

-- 3. Copy data *from the old table*
INSERT INTO targets (
    targetId,
    resourceId,
    siteId,
    ip,
    method,
    port,
    internalPort,
    enabled,
    path,
    pathMatchType
)
SELECT
    targetId,
    resourceId,
    siteId,
    ip,
    method,
    port,
    internalPort,
    enabled,
    path,
    pathMatchType
FROM targets_old;

-- 4. Drop the old table
DROP TABLE targets_old;

PRAGMA foreign_keys = ON;`);
        });

        db.pragma("foreign_keys = ON");

        console.log(`Migrated database`);
    } catch (e) {
        console.log("Failed to migrate db:", e);
        throw e;
    }
}
