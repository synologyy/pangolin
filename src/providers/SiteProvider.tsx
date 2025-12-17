"use client";

import SiteContext from "@app/contexts/siteContext";
import { GetSiteResponse } from "@server/routers/site/getSite";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface SiteProviderProps {
    children: React.ReactNode;
    site: GetSiteResponse;
}

export function SiteProvider({
    children,
    site: serverSite
}: SiteProviderProps) {
    const [site, setSite] = useState<GetSiteResponse>(serverSite);

    const t = useTranslations();

    const updateSite = (updatedSite: Partial<GetSiteResponse>) => {
        if (!site) {
            throw new Error(t("siteErrorNoUpdate"));
        }
        setSite((prev) => {
            if (!prev) {
                return prev;
            }
            return {
                ...prev,
                ...updatedSite
            };
        });
    };

    return (
        <SiteContext.Provider value={{ site, updateSite }}>
            {children}
        </SiteContext.Provider>
    );
}

export default SiteProvider;
