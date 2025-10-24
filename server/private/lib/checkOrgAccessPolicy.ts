/*
 * This file is part of a proprietary work.
 *
 * Copyright (c) 2025 Fossorial, Inc.
 * All rights reserved.
 *
 * This file is licensed under the Fossorial Commercial License.
 * You may not use this file except in compliance with the License.
 * Unauthorized use, copying, modification, or distribution is strictly prohibited.
 *
 * This file is not licensed under the AGPLv3.
 */

import { build } from "@server/build";
import { db, Org, orgs, User, users } from "@server/db";
import { getOrgTierData } from "#private/lib/billing";
import { TierId } from "@server/lib/billing/tiers";
import license from "#private/license/license";
import { eq } from "drizzle-orm";

type CheckOrgAccessPolicyProps = {
    orgId?: string;
    org?: Org;
    userId?: string;
    user?: User;
};

export async function checkOrgAccessPolicy(
    props: CheckOrgAccessPolicyProps
): Promise<{
    success: boolean;
    error?: string;
}> {
    const userId = props.userId || props.user?.userId;
    const orgId = props.orgId || props.org?.orgId;

    if (!orgId) {
        return { success: false, error: "Organization ID is required" };
    }
    if (!userId) {
        return { success: false, error: "User ID is required" };
    }

    if (build === "saas") {
        const { tier } = await getOrgTierData(orgId);
        const subscribed = tier === TierId.STANDARD;
        // if not subscribed, don't check the policies
        if (!subscribed) {
            return { success: true };
        }
    }

    if (build === "enterprise") {
        const isUnlocked = await license.isUnlocked();
        // if not licensed, don't check the policies
        if (!isUnlocked) {
            return { success: true };
        }
    }

    // get the needed data

    if (!props.org) {
        const [orgQuery] = await db
            .select()
            .from(orgs)
            .where(eq(orgs.orgId, orgId));
        props.org = orgQuery;
        if (!props.org) {
            return { success: false, error: "Organization not found" };
        }
    }

    if (!props.user) {
        const [userQuery] = await db
            .select()
            .from(users)
            .where(eq(users.userId, userId));
        props.user = userQuery;
        if (!props.user) {
            return { success: false, error: "User not found" };
        }
    }

    // now check the policies

    if (!props.org.requireTwoFactor && !props.user.twoFactorEnabled) {
        return {
            success: false,
            error: "Two-factor authentication is required"
        };
    }

    return { success: true };
}
