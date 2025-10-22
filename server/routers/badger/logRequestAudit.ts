import { db, requestAuditLog } from "@server/db";
import logger from "@server/logger";

/** 

Reasons:
100 - Allowed by Rule
101 - Allowed No Auth
102 - Valid Access Token
103 - Valid header auth
104 - Valid Pincode
105 - Valid Password
106 - Valid email
107 - Valid SSO

201 - Resource Not Found
202 - Resource Blocked
203 - Dropped by Rule
204 - No Sessions
205 - Temporary Request Token
299 - No More Auth Methods

 */

export async function logRequestAudit(
    data: {
        action: boolean;
        reason: number;
        resourceId?: number;
        user?: { username: string; userId: string; orgId: string };
        apiKey?: { name: string; apiKeyId: string; orgId: string };
        metadata?: any;
        location?: string;
        // userAgent?: string;
    },
    body: {
        path: string;
        originalRequestURL: string;
        scheme: string;
        host: string;
        method: string;
        tls: boolean;
        sessions?: Record<string, string>;
        headers?: Record<string, string>;
        query?: Record<string, string>; 
        requestIp?: string;
    }
) {
    try {
        let orgId: string | undefined;
        let actorType: string | undefined;
        let actor: string | undefined;
        let actorId: string | undefined;

        const user = data.user;
        if (user) {
            orgId = user.orgId;
            actorType = "user";
            actor = user.username;
            actorId = user.userId;
        }
        const apiKey = data.apiKey;
        if (apiKey) {
            orgId = apiKey.orgId;
            actorType = "apiKey";
            actor = apiKey.name;
            actorId = apiKey.apiKeyId;
        }

        if (!orgId) {
            logger.warn("logRequestAudit: No organization context found");
            return;
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

        await db.insert(requestAuditLog).values({
            timestamp,
            orgId,
            actorType,
            actor,
            actorId,
            metadata,
            action: data.action,
            resourceId: data.resourceId,
            reason: data.reason,
            location: data.location,
            // userAgent: data.userAgent, // TODO: add this
            // headers: data.body.headers,
            // query: data.body.query,
            originalRequestURL: body.originalRequestURL,
            scheme: body.scheme,
            host: body.host,
            path: body.path,
            method: body.method,
            ip: body.requestIp,
            tls: body.tls
        });
    } catch (error) {
        logger.error(error);
    }
}
