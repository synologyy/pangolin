import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { HorizontalTabs } from "@app/components/HorizontalTabs";
import { verifySession } from "@app/lib/auth/verifySession";
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
            title: t("request"),
            href: `/{orgId}/settings/logs/request`
        },
        {
            title: t("access"),
            href: `/{orgId}/settings/logs/access`
        },
        {
            title: t("action"),
            href: `/{orgId}/settings/logs/action`
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
