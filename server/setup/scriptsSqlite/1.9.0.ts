import { APP_PATH } from "@server/lib/consts";
import Database from "better-sqlite3";
import path from "path";

const version = "1.9.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    const location = path.join(APP_PATH, "db", "db.sqlite");
    const db = new Database(location);

    const resourceSiteMap = new Map<number, number>();
    let firstSiteId: number = 1;

    try {
        // Get the first siteId to use as default
        const firstSite = db
            .prepare("SELECT siteId FROM sites LIMIT 1")
            .get() as { siteId: number } | undefined;
        if (firstSite) {
            firstSiteId = firstSite.siteId;
        }

        const resources = db
            .prepare(
                "SELECT resourceId, siteId FROM resources WHERE siteId IS NOT NULL"
            )
            .all() as Array<{ resourceId: number; siteId: number }>;
        for (const resource of resources) {
            resourceSiteMap.set(resource.resourceId, resource.siteId);
        }
    } catch (e) {
        console.log("Error getting resources:", e);
    }

    try {
        db.pragma("foreign_keys = OFF");

        db.transaction(() => {
            db.exec(`CREATE TABLE 'setupTokens' (
	'tokenId' text PRIMARY KEY NOT NULL,
	'token' text NOT NULL,
	'used' integer DEFAULT false NOT NULL,
	'dateCreated' text NOT NULL,
	'dateUsed' text
);
--> statement-breakpoint
CREATE TABLE 'siteResources' (
	'siteResourceId' integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	'siteId' integer NOT NULL,
	'orgId' text NOT NULL,
	'name' text NOT NULL,
	'protocol' text NOT NULL,
	'proxyPort' integer NOT NULL,
	'destinationPort' integer NOT NULL,
	'destinationIp' text NOT NULL,
	'enabled' integer DEFAULT true NOT NULL,
	FOREIGN KEY ('siteId') REFERENCES 'sites'('siteId') ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ('orgId') REFERENCES 'orgs'('orgId') ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE '__new_resources' (
	'resourceId' integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	'orgId' text NOT NULL,
	'name' text NOT NULL,
	'subdomain' text,
	'fullDomain' text,
	'domainId' text,
	'ssl' integer DEFAULT false NOT NULL,
	'blockAccess' integer DEFAULT false NOT NULL,
	'sso' integer DEFAULT true NOT NULL,
	'http' integer DEFAULT true NOT NULL,
	'protocol' text NOT NULL,
	'proxyPort' integer,
	'emailWhitelistEnabled' integer DEFAULT false NOT NULL,
	'applyRules' integer DEFAULT false NOT NULL,
	'enabled' integer DEFAULT true NOT NULL,
	'stickySession' integer DEFAULT false NOT NULL,
	'tlsServerName' text,
	'setHostHeader' text,
	'enableProxy' integer DEFAULT true,
	'skipToIdpId' integer,
	FOREIGN KEY ('orgId') REFERENCES 'orgs'('orgId') ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ('domainId') REFERENCES 'domains'('domainId') ON UPDATE no action ON DELETE set null,
	FOREIGN KEY ('skipToIdpId') REFERENCES 'idp'('idpId') ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO '__new_resources'("resourceId", "orgId", "name", "subdomain", "fullDomain", "domainId", "ssl", "blockAccess", "sso", "http", "protocol", "proxyPort", "emailWhitelistEnabled", "applyRules", "enabled", "stickySession", "tlsServerName", "setHostHeader", "enableProxy", "skipToIdpId") SELECT "resourceId", "orgId", "name", "subdomain", "fullDomain", "domainId", "ssl", "blockAccess", "sso", "http", "protocol", "proxyPort", "emailWhitelistEnabled", "applyRules", "enabled", "stickySession", "tlsServerName", "setHostHeader", "enableProxy", null FROM 'resources';--> statement-breakpoint
DROP TABLE 'resources';--> statement-breakpoint
ALTER TABLE '__new_resources' RENAME TO 'resources';--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE '__new_clients' (
	'id' integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	'orgId' text NOT NULL,
	'exitNode' integer,
	'name' text NOT NULL,
	'pubKey' text,
	'subnet' text NOT NULL,
	'bytesIn' integer,
	'bytesOut' integer,
	'lastBandwidthUpdate' text,
	'lastPing' integer,
	'type' text NOT NULL,
	'online' integer DEFAULT false NOT NULL,
	'lastHolePunch' integer,
	FOREIGN KEY ('orgId') REFERENCES 'orgs'('orgId') ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ('exitNode') REFERENCES 'exitNodes'('exitNodeId') ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO '__new_clients'("id", "orgId", "exitNode", "name", "pubKey", "subnet", "bytesIn", "bytesOut", "lastBandwidthUpdate", "lastPing", "type", "online", "lastHolePunch") SELECT "id", "orgId", "exitNode", "name", "pubKey", "subnet", "bytesIn", "bytesOut", "lastBandwidthUpdate", NULL, "type", "online", "lastHolePunch" FROM 'clients';--> statement-breakpoint
DROP TABLE 'clients';--> statement-breakpoint
ALTER TABLE '__new_clients' RENAME TO 'clients';--> statement-breakpoint
ALTER TABLE 'clientSites' ADD 'endpoint' text;--> statement-breakpoint
ALTER TABLE 'exitNodes' ADD 'online' integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE 'exitNodes' ADD 'lastPing' integer;--> statement-breakpoint
ALTER TABLE 'exitNodes' ADD 'type' text DEFAULT 'gerbil';--> statement-breakpoint
ALTER TABLE 'olms' ADD 'version' text;--> statement-breakpoint
ALTER TABLE 'orgs' ADD 'createdAt' text;--> statement-breakpoint
ALTER TABLE 'targets' ADD 'siteId' integer NOT NULL DEFAULT ${firstSiteId || 1} REFERENCES sites(siteId);`);

            // for each resource, get all of its targets, and update the siteId to be the previously stored siteId
            for (const [resourceId, siteId] of resourceSiteMap) {
                const targets = db
                    .prepare(
                        "SELECT targetId FROM targets WHERE resourceId = ?"
                    )
                    .all(resourceId) as Array<{ targetId: number }>;
                for (const target of targets) {
                    db.prepare(
                        "UPDATE targets SET siteId = ? WHERE targetId = ?"
                    ).run(siteId, target.targetId);
                }
            }

            // list resources that have enableProxy false
            // move them to the siteResources table
            // remove them from the resources table
            const proxyFalseResources = db
                .prepare("SELECT * FROM resources WHERE enableProxy = 0")
                .all() as Array<any>;

            for (const resource of proxyFalseResources) {
                // Get the first target to derive destination IP and port
                const firstTarget = db
                    .prepare(
                        "SELECT ip, port FROM targets WHERE resourceId = ? LIMIT 1"
                    )
                    .get(resource.resourceId) as
                    | { ip: string; port: number }
                    | undefined;

                if (!firstTarget) {
                    continue;
                }

                // Insert into siteResources table
                const stmt = db.prepare(`
					INSERT INTO siteResources (siteId, orgId, name, protocol, proxyPort, destinationPort, destinationIp, enabled)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`);
                stmt.run(
                    resourceSiteMap.get(resource.resourceId),
                    resource.orgId,
                    resource.name,
                    resource.protocol,
                    resource.proxyPort,
                    firstTarget.port,
                    firstTarget.ip,
                    resource.enabled
                );

                // Delete from resources table
                db.prepare("DELETE FROM resources WHERE resourceId = ?").run(
                    resource.resourceId
                );

                // Delete the targets for this resource
                db.prepare("DELETE FROM targets WHERE resourceId = ?").run(
                    resource.resourceId
                );
            }
        })();

        db.pragma("foreign_keys = ON");

        console.log(`Migrated database`);
    } catch (e) {
        console.log("Failed to migrate db:", e);
        throw e;
    }
}
