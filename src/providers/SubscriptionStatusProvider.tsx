"use client";

import SubscriptionStatusContext from "@app/contexts/subscriptionStatusContext";
import { getTierPriceSet } from "@server/lib/billing/tiers";
import { GetOrgSubscriptionResponse } from "#private/routers/billing";
import { useState } from "react";

interface ProviderProps {
    children: React.ReactNode;
    subscriptionStatus: GetOrgSubscriptionResponse | null;
    env: string;
    sandbox_mode: boolean;
}

export function PrivateSubscriptionStatusProvider({
    children,
    subscriptionStatus,
    env,
    sandbox_mode
}: ProviderProps) {
    const [subscriptionStatusState, setSubscriptionStatusState] =
        useState<GetOrgSubscriptionResponse | null>(subscriptionStatus);

    const updateSubscriptionStatus = (updatedSubscriptionStatus: GetOrgSubscriptionResponse) => {
        setSubscriptionStatusState((prev) => {
            return {
                ...updatedSubscriptionStatus
            };
        });
    };

    const isActive = () => {
        if (subscriptionStatus?.subscription?.status === "active") {
            return true;
        }
        return false;
    };

    const getTier = () => {
        const tierPriceSet = getTierPriceSet(env, sandbox_mode);

        if (subscriptionStatus?.items && subscriptionStatus.items.length > 0) {
            // Iterate through tiers in order (earlier keys are higher tiers)
            for (const [tierId, priceId] of Object.entries(tierPriceSet)) {
                // Check if any subscription item matches this tier's price ID
                const matchingItem = subscriptionStatus.items.find(item => item.priceId === priceId);
                if (matchingItem) {
                    return tierId;
                }
            }
        }

        console.log("No matching tier found");
        return null;
    };

    return (
        <SubscriptionStatusContext.Provider
            value={{
                subscriptionStatus: subscriptionStatusState,
                updateSubscriptionStatus,
                isActive,
                getTier
            }}
        >
            {children}
        </SubscriptionStatusContext.Provider>
    );
}

export default PrivateSubscriptionStatusProvider;
