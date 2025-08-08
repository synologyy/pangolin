import { APP_PATH } from "@server/lib/consts";
import Database from "better-sqlite3";
import path from "path";

const version = "1.7.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    const location = path.join(APP_PATH, "db", "db.sqlite");
    const db = new Database(location);

    try {
        db.pragma("foreign_keys = OFF");

        db.transaction(() => {
            db.exec(`
                CREATE TABLE 'clientSites' (
                    'clientId' integer NOT NULL,
                    'siteId' integer NOT NULL,
                    'isRelayed' integer DEFAULT 0 NOT NULL,
                    FOREIGN KEY ('clientId') REFERENCES 'clients'('id') ON UPDATE no action ON DELETE cascade,
                    FOREIGN KEY ('siteId') REFERENCES 'sites'('siteId') ON UPDATE no action ON DELETE cascade
                );

                CREATE TABLE 'clients' (
                    'id' integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                    'orgId' text NOT NULL,
                    'exitNode' integer,
                    'name' text NOT NULL,
                    'pubKey' text,
                    'subnet' text NOT NULL,
                    'bytesIn' integer,
                    'bytesOut' integer,
                    'lastBandwidthUpdate' text,
                    'lastPing' text,
                    'type' text NOT NULL,
                    'online' integer DEFAULT 0 NOT NULL,
                    'endpoint' text,
                    'lastHolePunch' integer,
                    FOREIGN KEY ('orgId') REFERENCES 'orgs'('orgId') ON UPDATE no action ON DELETE cascade,
                    FOREIGN KEY ('exitNode') REFERENCES 'exitNodes'('exitNodeId') ON UPDATE no action ON DELETE set null
                );

                CREATE TABLE 'clientSession' (
                    'id' text PRIMARY KEY NOT NULL,
                    'olmId' text NOT NULL,
                    'expiresAt' integer NOT NULL,
                    FOREIGN KEY ('olmId') REFERENCES 'olms'('id') ON UPDATE no action ON DELETE cascade
                );

                CREATE TABLE 'olms' (
                    'id' text PRIMARY KEY NOT NULL,
                    'secretHash' text NOT NULL,
                    'dateCreated' text NOT NULL,
                    'clientId' integer,
                    FOREIGN KEY ('clientId') REFERENCES 'clients'('id') ON UPDATE no action ON DELETE cascade
                );

                CREATE TABLE 'roleClients' (
                    'roleId' integer NOT NULL,
                    'clientId' integer NOT NULL,
                    FOREIGN KEY ('roleId') REFERENCES 'roles'('roleId') ON UPDATE no action ON DELETE cascade,
                    FOREIGN KEY ('clientId') REFERENCES 'clients'('id') ON UPDATE no action ON DELETE cascade
                );

                CREATE TABLE 'webauthnCredentials' (
                    'credentialId' text PRIMARY KEY NOT NULL,
                    'userId' text NOT NULL,
                    'publicKey' text NOT NULL,
                    'signCount' integer NOT NULL,
                    'transports' text,
                    'name' text,
                    'lastUsed' text NOT NULL,
                    'dateCreated' text NOT NULL,
                    FOREIGN KEY ('userId') REFERENCES 'user'('id') ON UPDATE no action ON DELETE cascade
                );

                CREATE TABLE 'userClients' (
                    'userId' text NOT NULL,
                    'clientId' integer NOT NULL,
                    FOREIGN KEY ('userId') REFERENCES 'user'('id') ON UPDATE no action ON DELETE cascade,
                    FOREIGN KEY ('clientId') REFERENCES 'clients'('id') ON UPDATE no action ON DELETE cascade
                );

                CREATE TABLE 'userDomains' (
                    'userId' text NOT NULL,
                    'domainId' text NOT NULL,
                    FOREIGN KEY ('userId') REFERENCES 'user'('id') ON UPDATE no action ON DELETE cascade,
                    FOREIGN KEY ('domainId') REFERENCES 'domains'('domainId') ON UPDATE no action ON DELETE cascade
                );

                CREATE TABLE 'webauthnChallenge' (
                    'sessionId' text PRIMARY KEY NOT NULL,
                    'challenge' text NOT NULL,
                    'securityKeyName' text,
                    'userId' text,
                    'expiresAt' integer NOT NULL,
                    FOREIGN KEY ('userId') REFERENCES 'user'('id') ON UPDATE no action ON DELETE cascade
                );

            `);

            db.exec(`
                CREATE TABLE '__new_sites' (
                    'siteId' integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                    'orgId' text NOT NULL,
                    'niceId' text NOT NULL,
                    'exitNode' integer,
                    'name' text NOT NULL,
                    'pubKey' text,
                    'subnet' text,
                    'bytesIn' integer DEFAULT 0,
                    'bytesOut' integer DEFAULT 0,
                    'lastBandwidthUpdate' text,
                    'type' text NOT NULL,
                    'online' integer DEFAULT 0 NOT NULL,
                    'address' text,
                    'endpoint' text,
                    'publicKey' text,
                    'lastHolePunch' integer,
                    'listenPort' integer,
                    'dockerSocketEnabled' integer DEFAULT 1 NOT NULL,
                    FOREIGN KEY ('orgId') REFERENCES 'orgs'('orgId') ON UPDATE no action ON DELETE cascade,
                    FOREIGN KEY ('exitNode') REFERENCES 'exitNodes'('exitNodeId') ON UPDATE no action ON DELETE set null
                );

                INSERT INTO '__new_sites' (
                    'siteId', 'orgId', 'niceId', 'exitNode', 'name', 'pubKey', 'subnet', 'bytesIn', 'bytesOut', 'lastBandwidthUpdate', 'type', 'online', 'address', 'endpoint', 'publicKey', 'lastHolePunch', 'listenPort', 'dockerSocketEnabled'
                )
                SELECT siteId, orgId, niceId, exitNode, name, pubKey, subnet, bytesIn, bytesOut, lastBandwidthUpdate, type, online, NULL, NULL, NULL, NULL, NULL, dockerSocketEnabled
                FROM sites;

                DROP TABLE 'sites';
                ALTER TABLE '__new_sites' RENAME TO 'sites';
            `);

            db.exec(`
                ALTER TABLE 'domains' ADD 'type' text;
                ALTER TABLE 'domains' ADD 'verified' integer DEFAULT 0 NOT NULL;
                ALTER TABLE 'domains' ADD 'failed' integer DEFAULT 0 NOT NULL;
                ALTER TABLE 'domains' ADD 'tries' integer DEFAULT 0 NOT NULL;
                ALTER TABLE 'exitNodes' ADD 'maxConnections' integer;
                ALTER TABLE 'newt' ADD 'version' text;
                ALTER TABLE 'orgs' ADD 'subnet' text;
                ALTER TABLE 'user' ADD 'twoFactorSetupRequested' integer DEFAULT 0;
                ALTER TABLE 'resources' DROP COLUMN 'isBaseDomain';
            `);
        })();

        db.pragma("foreign_keys = ON");

        console.log(`Migrated database schema`);
    } catch (e) {
        console.log("Unable to migrate database schema");
        throw e;
    }

    db.transaction(() => {
        // Update all existing orgs to have the default subnet
        db.exec(`UPDATE 'orgs' SET 'subnet' = '100.90.128.0/24'`);

        // Get all orgs and their sites to assign sequential IP addresses
        const orgs = db.prepare(`SELECT orgId FROM 'orgs'`).all() as {
            orgId: string;
        }[];

        for (const org of orgs) {
            const sites = db
                .prepare(
                    `SELECT siteId FROM 'sites' WHERE orgId = ? ORDER BY siteId`
                )
                .all(org.orgId) as { siteId: number }[];

            let ipIndex = 1;
            for (const site of sites) {
                const address = `100.90.128.${ipIndex}/24`;
                db.prepare(
                    `UPDATE 'sites' SET 'address' = ? WHERE siteId = ?`
                ).run(address, site.siteId);
                ipIndex++;
            }
        }
    })();

    console.log(`${version} migration complete`);
}
