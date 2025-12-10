"use client";

import OrgUserContext from "@app/contexts/orgUserContext";
import { GetOrgUserResponse } from "@server/routers/user";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface OrgUserProviderProps {
    children: React.ReactNode;
    orgUser: GetOrgUserResponse;
}

export function OrgUserProvider({
    children,
    orgUser: serverOrgUser
}: OrgUserProviderProps) {
    const [orgUser, setOrgUser] = useState<GetOrgUserResponse>(serverOrgUser);

    const t = useTranslations();

    const updateOrgUser = (updateOrgUser: Partial<GetOrgUserResponse>) => {
        if (!orgUser) {
            throw new Error(t("orgErrorNoUpdate"));
        }

        setOrgUser((prev) => {
            if (!prev) {
                return prev;
            }

            return {
                ...prev,
                ...updateOrgUser
            };
        });
    };

    return (
        <OrgUserContext.Provider value={{ orgUser, updateOrgUser }}>
            {children}
        </OrgUserContext.Provider>
    );
}

export default OrgUserProvider;
