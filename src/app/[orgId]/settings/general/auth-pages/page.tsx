import AuthPageCustomizationForm from "@app/components/AuthPagesCustomizationForm";
import { SettingsContainer } from "@app/components/Settings";
import { getCachedSubscription } from "@app/lib/api/getCachedSubscription";
import { pullEnv } from "@app/lib/pullEnv";
import { build } from "@server/build";
import { TierId } from "@server/lib/billing/tiers";
import type { GetOrgTierResponse } from "@server/routers/billing/types";
import { redirect } from "next/navigation";

export interface AuthPageProps {
    params: Promise<{ orgId: string }>;
}

export default async function AuthPage(props: AuthPageProps) {
    const orgId = (await props.params).orgId;
    const env = pullEnv();
    let subscriptionStatus: GetOrgTierResponse | null = null;
    try {
        const subRes = await getCachedSubscription(orgId);
        subscriptionStatus = subRes.data.data;
    } catch {}
    const subscribed =
        build === "enterprise"
            ? true
            : subscriptionStatus?.tier === TierId.STANDARD;

    if (!subscribed) {
        redirect(env.app.dashboardUrl);
    }

    return (
        <SettingsContainer>
            <AuthPageCustomizationForm orgId={orgId} />
        </SettingsContainer>
    );
}
