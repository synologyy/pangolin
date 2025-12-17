import SiteContext from "@app/contexts/siteContext";
import { useContext } from "react";

export function useSiteContext() {
    const context = useContext(SiteContext);
    if (context === undefined) {
        throw new Error("useSiteContext must be used within a SiteProvider");
    }
    return context;
}
