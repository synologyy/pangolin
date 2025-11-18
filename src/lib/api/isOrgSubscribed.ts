import { build } from "@server/build";
import { TierId } from "@server/lib/billing/tiers";
import { cache } from "react";
import { getCachedSubscription } from "./getCachedSubscription";
import type { GetOrgTierResponse } from "@server/routers/billing/types";

export const isOrgSubscribed = cache(async (orgId: string) => {
    let subscriptionStatus: GetOrgTierResponse | null = null;
    try {
        const subRes = await getCachedSubscription(orgId);
        subscriptionStatus = subRes.data.data;
    } catch {}

    const subscribed =
        build === "enterprise"
            ? true
            : subscriptionStatus?.tier === TierId.STANDARD &&
              subscriptionStatus.active;

    return subscribed;
});
