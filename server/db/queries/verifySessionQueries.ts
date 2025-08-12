import { db } from "@server/db";
import {
    Resource,
    ResourcePassword,
    ResourcePincode,
    ResourceRule,
    resourcePassword,
    resourcePincode,
    resourceRules,
    resources,
    roleResources,
    sessions,
    userOrgs,
    userResources,
    users
} from "@server/db";
import { and, eq } from "drizzle-orm";
import axios from "axios";
import config from "@server/lib/config";

export type ResourceWithAuth = {
    resource: Resource | null;
    pincode: ResourcePincode | null;
    password: ResourcePassword | null;
};

export type UserSessionWithUser = {
    session: any;
    user: any;
};

/**
 * Get resource by domain with pincode and password information
 */
export async function getResourceByDomain(
    domain: string
): Promise<ResourceWithAuth | null> {
    if (config.isHybridMode()) {
        try {
            const response = await axios.get(`${config.getRawConfig().hybrid?.endpoint}/resource/domain/${domain}`);
            return response.data;
        } catch (error) {
            console.error("Error fetching resource by domain:", error);
            return null;
        }
    }

    const [result] = await db
        .select()
        .from(resources)
        .leftJoin(
            resourcePincode,
            eq(resourcePincode.resourceId, resources.resourceId)
        )
        .leftJoin(
            resourcePassword,
            eq(resourcePassword.resourceId, resources.resourceId)
        )
        .where(eq(resources.fullDomain, domain))
        .limit(1);

    if (!result) {
        return null;
    }

    return {
        resource: result.resources,
        pincode: result.resourcePincode,
        password: result.resourcePassword
    };
}

/**
 * Get user session with user information
 */
export async function getUserSessionWithUser(
    userSessionId: string
): Promise<UserSessionWithUser | null> {
    if (config.isHybridMode()) {
        try {
            const response = await axios.get(`${config.getRawConfig().hybrid?.endpoint}/session/${userSessionId}`);
            return response.data;
        } catch (error) {
            console.error("Error fetching user session:", error);
            return null;
        }
    }

    const [res] = await db
        .select()
        .from(sessions)
        .leftJoin(users, eq(users.userId, sessions.userId))
        .where(eq(sessions.sessionId, userSessionId));

    if (!res) {
        return null;
    }

    return {
        session: res.session,
        user: res.user
    };
}

/**
 * Get user organization role
 */
export async function getUserOrgRole(userId: string, orgId: string) {
    if (config.isHybridMode()) {
        try {
            const response = await axios.get(`${config.getRawConfig().hybrid?.endpoint}/user/${userId}/org/${orgId}/role`);
            return response.data;
        } catch (error) {
            console.error("Error fetching user org role:", error);
            return null;
        }
    }

    const userOrgRole = await db
        .select()
        .from(userOrgs)
        .where(
            and(
                eq(userOrgs.userId, userId),
                eq(userOrgs.orgId, orgId)
            )
        )
        .limit(1);

    return userOrgRole.length > 0 ? userOrgRole[0] : null;
}

/**
 * Check if role has access to resource
 */
export async function getRoleResourceAccess(resourceId: number, roleId: number) {
    if (config.isHybridMode()) {
        try {
            const response = await axios.get(`${config.getRawConfig().hybrid?.endpoint}/role/${roleId}/resource/${resourceId}/access`);
            return response.data;
        } catch (error) {
            console.error("Error fetching role resource access:", error);
            return null;
        }
    }

    const roleResourceAccess = await db
        .select()
        .from(roleResources)
        .where(
            and(
                eq(roleResources.resourceId, resourceId),
                eq(roleResources.roleId, roleId)
            )
        )
        .limit(1);

    return roleResourceAccess.length > 0 ? roleResourceAccess[0] : null;
}

/**
 * Check if user has direct access to resource
 */
export async function getUserResourceAccess(userId: string, resourceId: number) {
    if (config.isHybridMode()) {
        try {
            const response = await axios.get(`${config.getRawConfig().hybrid?.endpoint}/user/${userId}/resource/${resourceId}/access`);
            return response.data;
        } catch (error) {
            console.error("Error fetching user resource access:", error);
            return null;
        }
    }

    const userResourceAccess = await db
        .select()
        .from(userResources)
        .where(
            and(
                eq(userResources.userId, userId),
                eq(userResources.resourceId, resourceId)
            )
        )
        .limit(1);

    return userResourceAccess.length > 0 ? userResourceAccess[0] : null;
}

/**
 * Get resource rules for a given resource
 */
export async function getResourceRules(resourceId: number): Promise<ResourceRule[]> {
    if (config.isHybridMode()) {
        try {
            const response = await axios.get(`${config.getRawConfig().hybrid?.endpoint}/resource/${resourceId}/rules`);
            return response.data;
        } catch (error) {
            console.error("Error fetching resource rules:", error);
            return [];
        }
    }

    const rules = await db
        .select()
        .from(resourceRules)
        .where(eq(resourceRules.resourceId, resourceId));

    return rules;
}
