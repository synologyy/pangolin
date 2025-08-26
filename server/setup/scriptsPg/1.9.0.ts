import { db } from "@server/db/pg/driver";
import { sql } from "drizzle-orm";

const version = "1.9.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    const resourceSiteMap = new Map<number, number>();
    let firstSiteId: number = 1;

    try {
        // Get the first siteId to use as default
        const firstSite = await db.execute(sql`SELECT "siteId" FROM "sites" LIMIT 1`);
        if (firstSite.rows.length > 0) {
            firstSiteId = firstSite.rows[0].siteId as number;
        }

        const resources = await db.execute(sql`
            SELECT "resourceId", "siteId" FROM "resources" WHERE "siteId" IS NOT NULL
        `);
        for (const resource of resources.rows) {
            resourceSiteMap.set(
                resource.resourceId as number,
                resource.siteId as number
            );
        }
    } catch (e) {
        console.log("Error getting resources:", e);
    }

    try {
        await db.execute(sql`BEGIN`);

        await db.execute(sql`CREATE TABLE "setupTokens" (
	"tokenId" varchar PRIMARY KEY NOT NULL,
	"token" varchar NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"dateCreated" varchar NOT NULL,
	"dateUsed" varchar
);`);

        await db.execute(sql`CREATE TABLE "siteResources" (
	"siteResourceId" serial PRIMARY KEY NOT NULL,
	"siteId" integer NOT NULL,
	"orgId" varchar NOT NULL,
	"name" varchar NOT NULL,
	"protocol" varchar NOT NULL,
	"proxyPort" integer NOT NULL,
	"destinationPort" integer NOT NULL,
	"destinationIp" varchar NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);`);

        await db.execute(sql`ALTER TABLE "resources" DROP CONSTRAINT "resources_siteId_sites_siteId_fk";`);

        await db.execute(sql`ALTER TABLE "clients" ALTER COLUMN "lastPing" TYPE integer USING NULL;`);

        await db.execute(sql`ALTER TABLE "clientSites" ADD COLUMN "endpoint" varchar;`);

        await db.execute(sql`ALTER TABLE "exitNodes" ADD COLUMN "online" boolean DEFAULT false NOT NULL;`);

        await db.execute(sql`ALTER TABLE "exitNodes" ADD COLUMN "lastPing" integer;`);

        await db.execute(sql`ALTER TABLE "exitNodes" ADD COLUMN "type" text DEFAULT 'gerbil';`);

        await db.execute(sql`ALTER TABLE "olms" ADD COLUMN "version" text;`);

        await db.execute(sql`ALTER TABLE "orgs" ADD COLUMN "createdAt" text;`);

        await db.execute(sql`ALTER TABLE "resources" ADD COLUMN "skipToIdpId" integer;`);

        await db.execute(sql.raw(`ALTER TABLE "targets" ADD COLUMN "siteId" integer NOT NULL DEFAULT ${firstSiteId || 1};`));

        await db.execute(sql`ALTER TABLE "siteResources" ADD CONSTRAINT "siteResources_siteId_sites_siteId_fk" FOREIGN KEY ("siteId") REFERENCES "public"."sites"("siteId") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "siteResources" ADD CONSTRAINT "siteResources_orgId_orgs_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("orgId") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "resources" ADD CONSTRAINT "resources_skipToIdpId_idp_idpId_fk" FOREIGN KEY ("skipToIdpId") REFERENCES "public"."idp"("idpId") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "targets" ADD CONSTRAINT "targets_siteId_sites_siteId_fk" FOREIGN KEY ("siteId") REFERENCES "public"."sites"("siteId") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "clients" DROP COLUMN "endpoint";`);

        await db.execute(sql`ALTER TABLE "resources" DROP COLUMN "siteId";`);

        // for each resource, get all of its targets, and update the siteId to be the previously stored siteId
        for (const [resourceId, siteId] of resourceSiteMap) {
            const targets = await db.execute(sql`
                SELECT "targetId" FROM "targets" WHERE "resourceId" = ${resourceId}
            `);
            for (const target of targets.rows) {
                await db.execute(sql`
                    UPDATE "targets" SET "siteId" = ${siteId} WHERE "targetId" = ${target.targetId}
                `);
            }
        }

        // list resources that have enableProxy false
        // move them to the siteResources table
        // remove them from the resources table
        const proxyFalseResources = await db.execute(sql`
            SELECT * FROM "resources" WHERE "enableProxy" = false
        `);

        for (const resource of proxyFalseResources.rows) {
            // Get the first target to derive destination IP and port
            const firstTarget = await db.execute(sql`
                SELECT "ip", "port" FROM "targets" WHERE "resourceId" = ${resource.resourceId} LIMIT 1
            `);

            if (firstTarget.rows.length === 0) {
                continue;
            }

            const target = firstTarget.rows[0];

            // Insert into siteResources table
            await db.execute(sql`
                INSERT INTO "siteResources" ("siteId", "orgId", "name", "protocol", "proxyPort", "destinationPort", "destinationIp", "enabled")
                VALUES (${resourceSiteMap.get(resource.resourceId as number)}, ${resource.orgId}, ${resource.name}, ${resource.protocol}, ${resource.proxyPort}, ${target.port}, ${target.ip}, ${resource.enabled})
            `);

            // Delete from resources table
            await db.execute(sql`
                DELETE FROM "resources" WHERE "resourceId" = ${resource.resourceId}
            `);

            // Delete the targets for this resource
            await db.execute(sql`
                DELETE FROM "targets" WHERE "resourceId" = ${resource.resourceId}
            `);
        }

        await db.execute(sql`COMMIT`);
        console.log(`Migrated database`);
    } catch (e) {
        await db.execute(sql`ROLLBACK`);
        console.log("Failed to migrate db:", e);
        throw e;
    }
}
