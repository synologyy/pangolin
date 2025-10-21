import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { HorizontalTabs } from "@app/components/HorizontalTabs";
import { verifySession } from "@app/lib/auth/verifySession";
import OrgProvider from "@app/providers/OrgProvider";
import OrgUserProvider from "@app/providers/OrgUserProvider";
import { GetOrgResponse } from "@server/routers/org";
import { GetOrgUserResponse } from "@server/routers/user";
import { AxiosResponse } from "axios";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getTranslations } from "next-intl/server";

type GeneralSettingsProps = {
    children: React.ReactNode;
    params: Promise<{ orgId: string }>;
};

export default async function GeneralSettingsPage({
    children,
    params
}: GeneralSettingsProps) {
    const { orgId } = await params;

    const getUser = cache(verifySession);
    const user = await getUser();

    if (!user) {
        redirect(`/`);
    }

    const t = await getTranslations();

    const navItems = [
        {
            title: t("access"),
            href: `/{orgId}/settings/logs/access`
        },
                {
            title: t("request"),
            href: `/{orgId}/settings/logs/request`
        }
    ];

    return (
        <>
            <SettingsSectionTitle
                title={t("logs")}
                description={t("logsSettingsDescription")}
            />

            <HorizontalTabs items={navItems}>{children}</HorizontalTabs>
        </>
    );
}
