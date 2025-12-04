import ClientInfoCard from "@app/components/ClientInfoCard";
import { HorizontalTabs } from "@app/components/HorizontalTabs";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import ClientProvider from "@app/providers/ClientProvider";
import { build } from "@server/build";
import { GetClientResponse } from "@server/routers/client";
import { AxiosResponse } from "axios";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

type SettingsLayoutProps = {
    children: React.ReactNode;
    params: Promise<{ clientId: number | string; orgId: string }>;
};

export default async function SettingsLayout(props: SettingsLayoutProps) {
    const params = await props.params;

    const { children } = props;

    let client = null;
    try {
        const res = await internal.get<AxiosResponse<GetClientResponse>>(
            `/client/${params.clientId}`,
            await authCookieHeader()
        );
        client = res.data.data;
    } catch (error) {
        console.error("Error fetching client data:", error);
        redirect(`/${params.orgId}/settings/clients`);
    }

    const t = await getTranslations();

    const navItems = [
        {
            title: t("general"),
            href: `/{orgId}/settings/clients/machine/{clientId}/general`
        },
        ...(build === "enterprise"
            ? [
                  {
                      title: t("credentials"),
                      href: `/{orgId}/settings/clients/machine/{clientId}/credentials`
                  }
              ]
            : [])
    ];

    return (
        <>
            <SettingsSectionTitle
                title={`${client?.name} Settings`}
                description="Configure the settings on your site"
            />

            <ClientProvider client={client}>
                <div className="space-y-6">
                    <ClientInfoCard />
                    <HorizontalTabs items={navItems}>{children}</HorizontalTabs>
                </div>
            </ClientProvider>
        </>
    );
}
