"use client";

import OrgContext from "@app/contexts/orgContext";
import { GetOrgResponse } from "@server/routers/org";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface OrgProviderProps {
    children: React.ReactNode;
    org: GetOrgResponse | null;
}

export function OrgProvider({ children, org }: OrgProviderProps) {
    const t = useTranslations();

    if (!org) {
        throw new Error(t("orgErrorNoProvided"));
    }

    return (
        <OrgContext.Provider value={{ org }}>{children}</OrgContext.Provider>
    );
}

export default OrgProvider;
