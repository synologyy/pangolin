import ClientContext from "@app/contexts/clientContext";
import { useContext } from "react";

export function useClientContext() {
    const context = useContext(ClientContext);
    if (context === undefined) {
        throw new Error('useSiteContext must be used within a SiteProvider');
    }
    return context;
}