import { drizzle as DrizzlePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readConfigFile } from "@server/lib/readConfigFile";
import { withReplicas } from "drizzle-orm/pg-core";

function createDb() {
    const config = readConfigFile();

    if (!config.postgres) {
        throw new Error(
            "Postgres configuration is missing in the configuration file."
        );
    }

    const connectionString = config.postgres?.connection_string;
    const replicaConnections = config.postgres?.replicas || [];

    if (!connectionString) {
        throw new Error(
            "A primary db connection string is required in the configuration file."
        );
    }

    // Create connection pools instead of individual connections
    const primaryPool = new Pool({
        connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    const replicas = [];

    if (!replicaConnections.length) {
        replicas.push(DrizzlePostgres(primaryPool));
    } else {
        for (const conn of replicaConnections) {
            const replicaPool = new Pool({
                connectionString: conn.connection_string,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });
            replicas.push(DrizzlePostgres(replicaPool));
        }
    }

    return withReplicas(DrizzlePostgres(primaryPool), replicas as any);
}

export const db = createDb();
export default db;
export type Transaction = Parameters<Parameters<typeof db["transaction"]>[0]>[0];