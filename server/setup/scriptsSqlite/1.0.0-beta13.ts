import { db } from "../../db/sqlite";
import { sql } from "drizzle-orm";

const version = "1.0.0-beta.13";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    try {
        db.transaction((trx) => {
            trx.run(sql`CREATE TABLE resourceRules (
                ruleId integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                resourceId integer NOT NULL,
                priority integer NOT NULL,
                enabled integer DEFAULT true NOT NULL,
                action text NOT NULL,
                match text NOT NULL,
                value text NOT NULL,
                FOREIGN KEY (resourceId) REFERENCES resources(resourceId) ON UPDATE no action ON DELETE cascade
            );`);
            trx.run(
                sql`ALTER TABLE resources ADD applyRules integer DEFAULT false NOT NULL;`
            );
        });

        console.log(`Added new table and column: resourceRules, applyRules`);
    } catch (e) {
        console.log(
            "Unable to add new table and column: resourceRules, applyRules"
        );
        throw e;
    }

    console.log(`${version} migration complete`);
}
