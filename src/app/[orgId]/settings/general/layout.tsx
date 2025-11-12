import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { HorizontalTabs, type TabItem } from "@app/components/HorizontalTabs";
import { verifySession } from "@app/lib/auth/verifySession";
import OrgProvider from "@app/providers/OrgProvider";
import OrgUserProvider from "@app/providers/OrgUserProvider";
import { GetOrgResponse } from "@server/routers/org";
import { GetOrgUserResponse } from "@server/routers/user";
import { AxiosResponse } from "axios";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";
import { getCachedOrg } from "@app/lib/api/getCachedOrg";
import { getCachedOrgUser } from "@app/lib/api/getCachedOrgUser";
import { GetOrgTierResponse } from "@server/routers/billing/types";
import { getCachedSubscription } from "@app/lib/api/getCachedSubscription";
import { build } from "@server/build";
import { TierId } from "@server/lib/billing/tiers";

type GeneralSettingsProps = {
    children: React.ReactNode;
    params: Promise<{ orgId: string }>;
};

export default async function GeneralSettingsPage({
    children,
    params
}: GeneralSettingsProps) {
    const { orgId } = await params;

    const user = await verifySession();

    if (!user) {
        redirect(`/`);
    }

    let orgUser = null;
    try {
        const res = await getCachedOrgUser(orgId, user.userId);
        orgUser = res.data.data;
    } catch {
        redirect(`/${orgId}`);
    }

    let org = null;
    try {
        const res = await getCachedOrg(orgId);
        org = res.data.data;
    } catch {
        redirect(`/${orgId}`);
    }

    let subscriptionStatus: GetOrgTierResponse | null = null;
    try {
        const subRes = await getCachedSubscription(orgId);
        subscriptionStatus = subRes.data.data;
    } catch {}
    const subscribed =
        build === "enterprise"
            ? true
            : subscriptionStatus?.tier === TierId.STANDARD;

    const t = await getTranslations();

    const navItems: TabItem[] = [
        {
            title: t("general"),
            href: `/{orgId}/settings/general`,
            exact: true
        }
    ];
    if (subscribed) {
        navItems.push({
            title: t("authPage"),
            href: `/{orgId}/settings/general/auth-page`
        });
    }

    return (
        <>
            <OrgProvider org={org}>
                <OrgUserProvider orgUser={orgUser}>
                    <SettingsSectionTitle
                        title={t("orgGeneralSettings")}
                        description={t("orgSettingsDescription")}
                    />

                    <HorizontalTabs items={navItems}>{children}</HorizontalTabs>
                </OrgUserProvider>
            </OrgProvider>
        </>
    );
}
