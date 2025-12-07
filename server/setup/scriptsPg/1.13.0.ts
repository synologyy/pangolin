import { db } from "@server/db/pg/driver";
import { sql } from "drizzle-orm";
import { __DIRNAME } from "@server/lib/consts";
import { readFileSync } from "fs";
import { join } from "path";

const version = "1.13.0";

const dev = process.env.ENVIRONMENT !== "prod";
let file;
if (!dev) {
    file = join(__DIRNAME, "names.json");
} else {
    file = join("server/db/names.json");
}
export const names = JSON.parse(readFileSync(file, "utf-8"));

export function generateName(): string {
    const name = (
        names.descriptors[
            Math.floor(Math.random() * names.descriptors.length)
        ] +
        "-" +
        names.animals[Math.floor(Math.random() * names.animals.length)]
    )
        .toLowerCase()
        .replace(/\s/g, "-");

    // clean out any non-alphanumeric characters except for dashes
    return name.replace(/[^a-z0-9-]/g, "");
}

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    try {
        await db.execute(sql`BEGIN`);

        await db.execute(sql`
            CREATE TABLE "clientSiteResources" (
                "clientId" integer NOT NULL,
                "siteResourceId" integer NOT NULL
            );
        `);

        await db.execute(sql`
            CREATE TABLE "clientSiteResourcesAssociationsCache" (
                "clientId" integer NOT NULL,
                "siteResourceId" integer NOT NULL
            );
        `);

        await db.execute(sql`
            CREATE TABLE "deviceWebAuthCodes" (
                "codeId" serial PRIMARY KEY NOT NULL,
                "code" text NOT NULL,
                "ip" text,
                "city" text,
                "deviceName" text,
                "applicationName" text NOT NULL,
                "expiresAt" bigint NOT NULL,
                "createdAt" bigint NOT NULL,
                "verified" boolean DEFAULT false NOT NULL,
                "userId" varchar,
                CONSTRAINT "deviceWebAuthCodes_code_unique" UNIQUE("code")
            );
        `);

        await db.execute(sql`
            CREATE TABLE "roleSiteResources" (
                "roleId" integer NOT NULL,
                "siteResourceId" integer NOT NULL
            );
        `);

        await db.execute(sql`
            CREATE TABLE "userSiteResources" (
                "userId" varchar NOT NULL,
                "siteResourceId" integer NOT NULL
            );
        `);

        await db.execute(sql`ALTER TABLE "clientSites" RENAME TO "clientSitesAssociationsCache";`);

        await db.execute(sql`ALTER TABLE "clients" RENAME COLUMN "id" TO "clientId";`);

        await db.execute(sql`ALTER TABLE "siteResources" RENAME COLUMN "destinationIp" TO "destination";`);

        await db.execute(sql`ALTER TABLE "clientSitesAssociationsCache" DROP CONSTRAINT "clientSites_clientId_clients_id_fk";`);

        await db.execute(sql`ALTER TABLE "clientSitesAssociationsCache" DROP CONSTRAINT "clientSites_siteId_sites_siteId_fk";`);

        await db.execute(sql`ALTER TABLE "olms" DROP CONSTRAINT "olms_clientId_clients_id_fk";`);

        await db.execute(sql`ALTER TABLE "roleClients" DROP CONSTRAINT "roleClients_clientId_clients_id_fk";`);

        await db.execute(sql`ALTER TABLE "userClients" DROP CONSTRAINT "userClients_clientId_clients_id_fk";`);

        await db.execute(sql`ALTER TABLE "siteResources" ALTER COLUMN "protocol" DROP NOT NULL;`);

        await db.execute(sql`ALTER TABLE "siteResources" ALTER COLUMN "proxyPort" DROP NOT NULL;`);

        await db.execute(sql`ALTER TABLE "siteResources" ALTER COLUMN "destinationPort" DROP NOT NULL;`);

        await db.execute(sql`ALTER TABLE "clientSitesAssociationsCache" ADD COLUMN "publicKey" varchar;`);

        await db.execute(sql`ALTER TABLE "clients" ADD COLUMN "userId" text;`);

        await db.execute(sql`ALTER TABLE "clients" ADD COLUMN "niceId" varchar NOT NULL DEFAULT 'PLACEHOLDER';`);

        await db.execute(sql`ALTER TABLE "clients" ADD COLUMN "olmId" text;`);

        await db.execute(sql`ALTER TABLE "olms" ADD COLUMN "agent" text;`);

        await db.execute(sql`ALTER TABLE "olms" ADD COLUMN "name" varchar;`);

        await db.execute(sql`ALTER TABLE "olms" ADD COLUMN "userId" text;`);

        await db.execute(sql`ALTER TABLE "orgs" ADD COLUMN "utilitySubnet" varchar;`);

        await db.execute(sql`ALTER TABLE "session" ADD COLUMN "deviceAuthUsed" boolean DEFAULT false NOT NULL;`);

        await db.execute(sql`ALTER TABLE "siteResources" ADD COLUMN "mode" varchar NOT NULL DEFAULT 'host';`);

        await db.execute(sql`ALTER TABLE "siteResources" ADD COLUMN "alias" varchar;`);

        await db.execute(sql`ALTER TABLE "siteResources" ADD COLUMN "aliasAddress" varchar;`);

        await db.execute(sql`ALTER TABLE "targetHealthCheck" ADD COLUMN "hcTlsServerName" text;`);

        await db.execute(sql`ALTER TABLE "clientSiteResources" ADD CONSTRAINT "clientSiteResources_clientId_clients_clientId_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("clientId") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "clientSiteResources" ADD CONSTRAINT "clientSiteResources_siteResourceId_siteResources_siteResourceId_fk" FOREIGN KEY ("siteResourceId") REFERENCES "public"."siteResources"("siteResourceId") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "deviceWebAuthCodes" ADD CONSTRAINT "deviceWebAuthCodes_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "roleSiteResources" ADD CONSTRAINT "roleSiteResources_roleId_roles_roleId_fk" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("roleId") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "roleSiteResources" ADD CONSTRAINT "roleSiteResources_siteResourceId_siteResources_siteResourceId_fk" FOREIGN KEY ("siteResourceId") REFERENCES "public"."siteResources"("siteResourceId") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "userSiteResources" ADD CONSTRAINT "userSiteResources_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "userSiteResources" ADD CONSTRAINT "userSiteResources_siteResourceId_siteResources_siteResourceId_fk" FOREIGN KEY ("siteResourceId") REFERENCES "public"."siteResources"("siteResourceId") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "clients" ADD CONSTRAINT "clients_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "olms" ADD CONSTRAINT "olms_clientId_clients_clientId_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("clientId") ON DELETE set null ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "olms" ADD CONSTRAINT "olms_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "roleClients" ADD CONSTRAINT "roleClients_clientId_clients_clientId_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("clientId") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "userClients" ADD CONSTRAINT "userClients_clientId_clients_clientId_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("clientId") ON DELETE cascade ON UPDATE no action;`);

        await db.execute(sql`ALTER TABLE "sites" DROP COLUMN "remoteSubnets";`);

        // Associate clients with site resources based on their previous site access
        // Get all client-site associations from the renamed clientSitesAssociationsCache table
        const clientSiteAssociationsQuery = await db.execute(sql`
            SELECT "clientId", "siteId" FROM "clientSitesAssociationsCache"
        `);
        const clientSiteAssociations = clientSiteAssociationsQuery.rows as {
            clientId: number;
            siteId: number;
        }[];

        // For each client-site association, find all site resources for that site
        for (const association of clientSiteAssociations) {
            const siteResourcesQuery = await db.execute(sql`
                SELECT "siteResourceId" FROM "siteResources"
                WHERE "siteId" = ${association.siteId}
            `);
            const siteResources = siteResourcesQuery.rows as {
                siteResourceId: number;
            }[];

            // Associate the client with all site resources from this site
            for (const siteResource of siteResources) {
                await db.execute(sql`
                    INSERT INTO "clientSiteResources" ("clientId", "siteResourceId")
                    VALUES (${association.clientId}, ${siteResource.siteResourceId})
                `);
            }
        }

        // Associate existing site resources with their org's admin role
        const siteResourcesWithOrgQuery = await db.execute(sql`
            SELECT "siteResourceId", "orgId" FROM "siteResources"
        `);
        const siteResourcesWithOrg = siteResourcesWithOrgQuery.rows as {
            siteResourceId: number;
            orgId: string;
        }[];

        for (const siteResource of siteResourcesWithOrg) {
            const adminRoleQuery = await db.execute(sql`
                SELECT "roleId" FROM "roles" WHERE "orgId" = ${siteResource.orgId} AND "isAdmin" = true LIMIT 1
            `);
            const adminRole = adminRoleQuery.rows[0] as
                | { roleId: number }
                | undefined;

            if (adminRole) {
                const existingQuery = await db.execute(sql`
                    SELECT 1 FROM "roleSiteResources"
                    WHERE "roleId" = ${adminRole.roleId} AND "siteResourceId" = ${siteResource.siteResourceId}
                    LIMIT 1
                `);

                if (existingQuery.rows.length === 0) {
                    await db.execute(sql`
                        INSERT INTO "roleSiteResources" ("roleId", "siteResourceId")
                        VALUES (${adminRole.roleId}, ${siteResource.siteResourceId})
                    `);
                }
            }
        }

        // Populate niceId for clients
        const clientsQuery = await db.execute(sql`SELECT "clientId" FROM "clients"`);
        const clients = clientsQuery.rows as {
            clientId: number;
        }[];

        const usedNiceIds: string[] = [];

        for (const client of clients) {
            // Generate a unique name and ensure it's unique
            let niceId = "";
            let loops = 0;
            while (true) {
                if (loops > 100) {
                    throw new Error("Could not generate a unique name");
                }

                niceId = generateName();
                if (!usedNiceIds.includes(niceId)) {
                    usedNiceIds.push(niceId);
                    break;
                }
                loops++;
            }
            await db.execute(sql`
                UPDATE "clients" SET "niceId" = ${niceId} WHERE "clientId" = ${client.clientId}
            `);
        }

        await db.execute(sql`COMMIT`);
        console.log("Migrated database");
    } catch (e) {
        await db.execute(sql`ROLLBACK`);
        console.log("Unable to migrate database");
        console.log(e);
        throw e;
    }

    console.log(`${version} migration complete`);
}
