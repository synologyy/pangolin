import ClientResourcesTable from "@app/components/ClientResourcesTable";
import type { InternalResourceRow } from "@app/components/ProxyResourcesTable";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import { pullEnv } from "@app/lib/pullEnv";
import OrgProvider from "@app/providers/OrgProvider";
import type { GetOrgResponse } from "@server/routers/org";
import type { ListResourcesResponse } from "@server/routers/resource";
import type { ListAllSiteResourcesByOrgResponse } from "@server/routers/siteResource";
import type { AxiosResponse } from "axios";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { cache } from "react";

export interface ClientResourcesPageProps {
    params: Promise<{ orgId: string }>;
    searchParams: Promise<{ view?: string }>;
}

export default async function ClientResourcesPage(
    props: ClientResourcesPageProps
) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    const t = await getTranslations();

    const env = pullEnv();

    // Default to 'proxy' view, or use the query param if provided
    let defaultView: "proxy" | "internal" = "proxy";
    if (env.flags.enableClients) {
        defaultView = searchParams.view === "internal" ? "internal" : "proxy";
    }

    let resources: ListResourcesResponse["resources"] = [];
    try {
        const res = await internal.get<AxiosResponse<ListResourcesResponse>>(
            `/org/${params.orgId}/resources`,
            await authCookieHeader()
        );
        resources = res.data.data.resources;
    } catch (e) {}

    let siteResources: ListAllSiteResourcesByOrgResponse["siteResources"] = [];
    try {
        const res = await internal.get<
            AxiosResponse<ListAllSiteResourcesByOrgResponse>
        >(`/org/${params.orgId}/site-resources`, await authCookieHeader());
        siteResources = res.data.data.siteResources;
    } catch (e) {}

    let org = null;
    try {
        const getOrg = cache(async () =>
            internal.get<AxiosResponse<GetOrgResponse>>(
                `/org/${params.orgId}`,
                await authCookieHeader()
            )
        );
        const res = await getOrg();
        org = res.data.data;
    } catch {
        redirect(`/${params.orgId}/settings/resources`);
    }

    if (!org) {
        redirect(`/${params.orgId}/settings/resources`);
    }

    const internalResourceRows: InternalResourceRow[] = siteResources.map(
        (siteResource) => {
            return {
                id: siteResource.siteResourceId,
                name: siteResource.name,
                orgId: params.orgId,
                siteName: siteResource.siteName,
                siteAddress: siteResource.siteAddress || null,
                mode: siteResource.mode || ("port" as any),
                // protocol: siteResource.protocol,
                // proxyPort: siteResource.proxyPort,
                siteId: siteResource.siteId,
                destination: siteResource.destination,
                // destinationPort: siteResource.destinationPort,
                alias: siteResource.alias || null,
                siteNiceId: siteResource.siteNiceId
            };
        }
    );
    return (
        <>
            <SettingsSectionTitle
                title={t("resourceTitle")}
                description={t("resourceDescription")}
            />

            <OrgProvider org={org}>
                <ClientResourcesTable
                    resources={[]}
                    internalResources={internalResourceRows}
                    orgId={params.orgId}
                    defaultView={
                        env.flags.enableClients ? defaultView : "proxy"
                    }
                    defaultSort={{
                        id: "name",
                        desc: false
                    }}
                />
            </OrgProvider>
        </>
    );
}
