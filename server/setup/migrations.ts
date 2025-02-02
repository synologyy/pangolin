import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import db, { exists } from "@server/db";
import path from "path";
import semver from "semver";
import { versionMigrations } from "@server/db/schema";
import { __DIRNAME } from "@server/lib/consts";
import { loadAppVersion } from "@server/lib/loadAppVersion";
import { SqliteError } from "better-sqlite3";
import m1 from "./scripts/1.0.0-beta1";
import m2 from "./scripts/1.0.0-beta2";
import m3 from "./scripts/1.0.0-beta3";
import m4 from "./scripts/1.0.0-beta5";
import m5 from "./scripts/1.0.0-beta6";
import m6 from "./scripts/1.0.0-beta9";
import m7 from "./scripts/1.0.0-beta10";

// THIS CANNOT IMPORT ANYTHING FROM THE SERVER
// EXCEPT FOR THE DATABASE AND THE SCHEMA

// Define the migration list with versions and their corresponding functions
const migrations = [
    { version: "1.0.0-beta.1", run: m1 },
    { version: "1.0.0-beta.2", run: m2 },
    { version: "1.0.0-beta.3", run: m3 },
    { version: "1.0.0-beta.5", run: m4 },
    { version: "1.0.0-beta.6", run: m5 },
    { version: "1.0.0-beta.9", run: m6 },
    { version: "1.0.0-beta.10", run: m7 }
    // Add new migrations here as they are created
] as const;

// Run the migrations
await runMigrations();

export async function runMigrations() {
    try {
        const appVersion = loadAppVersion();
        if (!appVersion) {
            throw new Error("APP_VERSION is not set in the environment");
        }

        if (exists) {
            await executeScripts();
        } else {
            console.log("Running migrations...");
            try {
                migrate(db, {
                    migrationsFolder: path.join(__DIRNAME, "init") // put here during the docker build
                });
                console.log("Migrations completed successfully.");
            } catch (error) {
                console.error("Error running migrations:", error);
            }

            await db
                .insert(versionMigrations)
                .values({
                    version: appVersion,
                    executedAt: Date.now()
                })
                .execute();
        }
    } catch (e) {
        console.error("Error running migrations:", e);
        await new Promise((resolve) =>
            setTimeout(resolve, 1000 * 60 * 60 * 24 * 1)
        );
    }
}

async function executeScripts() {
    try {
        // Get the last executed version from the database
        const lastExecuted = await db.select().from(versionMigrations);

        // Filter and sort migrations
        const pendingMigrations = lastExecuted
            .map((m) => m)
            .sort((a, b) => semver.compare(b.version, a.version));
        const startVersion = pendingMigrations[0]?.version ?? "0.0.0";
        console.log(`Starting migrations from version ${startVersion}`);

        const migrationsToRun = migrations.filter((migration) =>
            semver.gt(migration.version, startVersion)
        );

        console.log(
            "Migrations to run:",
            migrationsToRun.map((m) => m.version).join(", ")
        );

        // Run migrations in order
        for (const migration of migrationsToRun) {
            console.log(`Running migration ${migration.version}`);

            try {
                await migration.run();

                // Update version in database
                await db
                    .insert(versionMigrations)
                    .values({
                        version: migration.version,
                        executedAt: Date.now()
                    })
                    .execute();

                console.log(
                    `Successfully completed migration ${migration.version}`
                );
            } catch (e) {
                if (e instanceof SqliteError && e.code === "SQLITE_CONSTRAINT_UNIQUE") {
                    console.error("Migration has already run! Skipping...");
                    continue;
                }
                console.error(
                    `Failed to run migration ${migration.version}:`,
                    e
                );
                throw e; // Re-throw to stop migration process
            }
        }

        console.log("All migrations completed successfully");
    } catch (error) {
        console.error("Migration process failed:", error);
        throw error;
    }
}
