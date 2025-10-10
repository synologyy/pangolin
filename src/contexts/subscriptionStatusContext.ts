import { GetOrgSubscriptionResponse } from "#private/routers/billing";
import { createContext } from "react";

type SubscriptionStatusContextType = {
    subscriptionStatus: GetOrgSubscriptionResponse | null;
    updateSubscriptionStatus: (updatedSite: GetOrgSubscriptionResponse) => void;
    isActive: () => boolean;
    getTier: () => string | null;
};

const SubscriptionStatusContext = createContext<
    SubscriptionStatusContextType | undefined
>(undefined);

export default SubscriptionStatusContext;
