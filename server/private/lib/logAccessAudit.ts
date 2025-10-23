import { accessAuditLog, db } from "@server/db";
import { getCountryCodeForIp } from "@server/lib/geoip";
import logger from "@server/logger";
import NodeCache from "node-cache";

const cache = new NodeCache({
    stdTTL: 5 // seconds
});

export async function logAccessAudit(data: {
    action: boolean;
    type: string;
    orgId: string;
    resourceId?: number;
    user?: { username: string; userId: string };
    apiKey?: { name: string | null; apiKeyId: string };
    metadata?: any;
    userAgent?: string;
    requestIp?: string;
}) {
    try {
        let actorType: string | undefined;
        let actor: string | undefined;
        let actorId: string | undefined;

        const user = data.user;
        if (user) {
            actorType = "user";
            actor = user.username;
            actorId = user.userId;
        }
        const apiKey = data.apiKey;
        if (apiKey) {
            actorType = "apiKey";
            actor = apiKey.name || apiKey.apiKeyId;
            actorId = apiKey.apiKeyId;
        }

        // if (!actorType || !actor || !actorId) {
        //     logger.warn("logRequestAudit: Incomplete actor information");
        //     return;
        // }

        const timestamp = Math.floor(Date.now() / 1000);

        let metadata = null;
        if (metadata) {
            metadata = JSON.stringify(metadata);
        }

        const clientIp = data.requestIp
            ? (() => {
                  if (
                      data.requestIp.startsWith("[") &&
                      data.requestIp.includes("]")
                  ) {
                      // if brackets are found, extract the IPv6 address from between the brackets
                      const ipv6Match = data.requestIp.match(/\[(.*?)\]/);
                      if (ipv6Match) {
                          return ipv6Match[1];
                      }
                  }
                  return data.requestIp;
              })()
            : undefined;

        const countryCode = data.requestIp
            ? await getCountryCodeFromIp(data.requestIp)
            : undefined;

        await db.insert(accessAuditLog).values({
            timestamp: timestamp,
            orgId: data.orgId,
            actorType,
            actor,
            actorId,
            action: data.action,
            type: data.type,
            metadata,
            resourceId: data.resourceId,
            userAgent: data.userAgent,
            ip: clientIp,
            location: countryCode
        });
    } catch (error) {
        logger.error(error);
    }
}

async function getCountryCodeFromIp(ip: string): Promise<string | undefined> {
    const geoIpCacheKey = `geoip_access:${ip}`;

    let cachedCountryCode: string | undefined = cache.get(geoIpCacheKey);

    if (!cachedCountryCode) {
        cachedCountryCode = await getCountryCodeForIp(ip); // do it locally
        // Cache for longer since IP geolocation doesn't change frequently
        cache.set(geoIpCacheKey, cachedCountryCode, 300); // 5 minutes
    }

    return cachedCountryCode;
}
