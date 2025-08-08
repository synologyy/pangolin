import { db } from "@server/db/pg/driver";
import { sql } from "drizzle-orm";

const version = "1.7.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    try {
        await db.execute(sql`
            BEGIN;
            
            CREATE TABLE "clientSites" (
                "clientId" integer NOT NULL,
                "siteId" integer NOT NULL,
                "isRelayed" boolean DEFAULT false NOT NULL
            );
            
            CREATE TABLE "clients" (
                "id" serial PRIMARY KEY NOT NULL,
                "orgId" varchar NOT NULL,
                "exitNode" integer,
                "name" varchar NOT NULL,
                "pubKey" varchar,
                "subnet" varchar NOT NULL,
                "bytesIn" integer,
                "bytesOut" integer,
                "lastBandwidthUpdate" varchar,
                "lastPing" varchar,
                "type" varchar NOT NULL,
                "online" boolean DEFAULT false NOT NULL,
                "endpoint" varchar,
                "lastHolePunch" integer,
                "maxConnections" integer
            );
            
            CREATE TABLE "clientSession" (
                "id" varchar PRIMARY KEY NOT NULL,
                "olmId" varchar NOT NULL,
                "expiresAt" integer NOT NULL
            );
            
            CREATE TABLE "olms" (
                "id" varchar PRIMARY KEY NOT NULL,
                "secretHash" varchar NOT NULL,
                "dateCreated" varchar NOT NULL,
                "clientId" integer
            );
            
            CREATE TABLE "roleClients" (
                "roleId" integer NOT NULL,
                "clientId" integer NOT NULL
            );
            
            CREATE TABLE "webauthnCredentials" (
                "credentialId" varchar PRIMARY KEY NOT NULL,
                "userId" varchar NOT NULL,
                "publicKey" varchar NOT NULL,
                "signCount" integer NOT NULL,
                "transports" varchar,
                "name" varchar,
                "lastUsed" varchar NOT NULL,
                "dateCreated" varchar NOT NULL,
                "securityKeyName" varchar
            );
            
            CREATE TABLE "userClients" (
                "userId" varchar NOT NULL,
                "clientId" integer NOT NULL
            );
            
            CREATE TABLE "webauthnChallenge" (
                "sessionId" varchar PRIMARY KEY NOT NULL,
                "challenge" varchar NOT NULL,
                "securityKeyName" varchar,
                "userId" varchar,
                "expiresAt" bigint NOT NULL
            );
            
            ALTER TABLE "limits" DISABLE ROW LEVEL SECURITY;
            DROP TABLE "limits" CASCADE;
            ALTER TABLE "sites" ALTER COLUMN "subnet" DROP NOT NULL;
            ALTER TABLE "sites" ALTER COLUMN "bytesIn" SET DEFAULT 0;
            ALTER TABLE "sites" ALTER COLUMN "bytesOut" SET DEFAULT 0;
            ALTER TABLE "domains" ADD COLUMN "type" varchar;
            ALTER TABLE "domains" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;
            ALTER TABLE "domains" ADD COLUMN "failed" boolean DEFAULT false NOT NULL;
            ALTER TABLE "domains" ADD COLUMN "tries" integer DEFAULT 0 NOT NULL;
            ALTER TABLE "exitNodes" ADD COLUMN "maxConnections" integer;
            ALTER TABLE "newt" ADD COLUMN "version" varchar;
            ALTER TABLE "orgs" ADD COLUMN "subnet" varchar;
            ALTER TABLE "sites" ADD COLUMN "address" varchar;
            ALTER TABLE "sites" ADD COLUMN "endpoint" varchar;
            ALTER TABLE "sites" ADD COLUMN "publicKey" varchar;
            ALTER TABLE "sites" ADD COLUMN "lastHolePunch" bigint;
            ALTER TABLE "sites" ADD COLUMN "listenPort" integer;
            ALTER TABLE "user" ADD COLUMN "twoFactorSetupRequested" boolean DEFAULT false;
            ALTER TABLE "clientSites" ADD CONSTRAINT "clientSites_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "clientSites" ADD CONSTRAINT "clientSites_siteId_sites_siteId_fk" FOREIGN KEY ("siteId") REFERENCES "public"."sites"("siteId") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "clients" ADD CONSTRAINT "clients_orgId_orgs_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("orgId") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "clients" ADD CONSTRAINT "clients_exitNode_exitNodes_exitNodeId_fk" FOREIGN KEY ("exitNode") REFERENCES "public"."exitNodes"("exitNodeId") ON DELETE set null ON UPDATE no action;
            ALTER TABLE "clientSession" ADD CONSTRAINT "clientSession_olmId_olms_id_fk" FOREIGN KEY ("olmId") REFERENCES "public"."olms"("id") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "olms" ADD CONSTRAINT "olms_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "roleClients" ADD CONSTRAINT "roleClients_roleId_roles_roleId_fk" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("roleId") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "roleClients" ADD CONSTRAINT "roleClients_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "webauthnCredentials" ADD CONSTRAINT "webauthnCredentials_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "userClients" ADD CONSTRAINT "userClients_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "userClients" ADD CONSTRAINT "userClients_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "webauthnChallenge" ADD CONSTRAINT "webauthnChallenge_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "resources" DROP COLUMN "isBaseDomain";
            
            COMMIT;
        `);

        console.log(`Migrated database schema`);
    } catch (e) {
        console.log("Unable to migrate database schema");
        console.log(e);
        throw e;
    }

    try {
        await db.execute(sql`BEGIN`);
        
        // Update all existing orgs to have the default subnet
        await db.execute(sql`UPDATE "orgs" SET "subnet" = '100.90.128.0/24'`);

        // Get all orgs and their sites to assign sequential IP addresses
        const orgsQuery = await db.execute(sql`SELECT "orgId" FROM "orgs"`);

        const orgs = orgsQuery.rows as { orgId: string }[];

        for (const org of orgs) {
            const sitesQuery = await db.execute(sql`
                SELECT "siteId" FROM "sites" 
                WHERE "orgId" = ${org.orgId} 
                ORDER BY "siteId"
            `);

            const sites = sitesQuery.rows as { siteId: number }[];

            let ipIndex = 1;
            for (const site of sites) {
                const address = `100.90.128.${ipIndex}/24`;
                await db.execute(sql`
                    UPDATE "sites" SET "address" = ${address} 
                    WHERE "siteId" = ${site.siteId}
                `);
                ipIndex++;
            }
        }

        await db.execute(sql`COMMIT`);
        console.log(`Updated org subnets and site addresses`);
    } catch (e) {
        await db.execute(sql`ROLLBACK`);
        console.log("Unable to update org subnets");
        console.log(e);
        throw e;
    }

    console.log(`${version} migration complete`);
}
