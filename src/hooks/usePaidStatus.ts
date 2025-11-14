import { build } from "@server/build";
import { useLicenseStatusContext } from "./useLicenseStatusContext";
import { useSubscriptionStatusContext } from "./useSubscriptionStatusContext";

export function usePaidStatus() {
    const { isUnlocked } = useLicenseStatusContext();
    const subscription = useSubscriptionStatusContext();

    // Check if features are disabled due to licensing/subscription
    const isEnterpriseLicensed = build === "enterprise" && isUnlocked();
    const isSaasSubscribed = build === "saas" && subscription?.isSubscribed();

    return {
        isEnterpriseLicensed,
        isSaasSubscribed,
        isPaidUser: isEnterpriseLicensed || isSaasSubscribed
    };
}
