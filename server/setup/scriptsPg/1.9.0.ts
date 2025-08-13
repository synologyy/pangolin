import { db } from "@server/db/pg/driver";
import { sql } from "drizzle-orm";

const version = "1.9.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    try {
        await db.execute(sql`
            CREATE TABLE "setupTokens" (
                "tokenId" varchar PRIMARY KEY NOT NULL,
                "token" varchar NOT NULL,
                "used" boolean DEFAULT false NOT NULL,
                "dateCreated" varchar NOT NULL,
                "dateUsed" varchar
            );
        `);

        console.log(`Added setupTokens table`);
    } catch (e) {
        console.log("Unable to add setupTokens table:", e);
        throw e;
    }
} 