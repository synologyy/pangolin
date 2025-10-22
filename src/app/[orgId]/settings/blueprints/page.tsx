import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import OrgProvider from "@app/providers/OrgProvider";
import { ListBlueprintsResponse } from "@server/routers/blueprints";
import { GetOrgResponse } from "@server/routers/org";
import { AxiosResponse } from "axios";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { cache } from "react";


type BluePrintsPageProps = {
    params: Promise<{ orgId: string }>;
    searchParams: Promise<{ view?: string }>;
};


export default async function BluePrintsPage(props: BluePrintsPageProps) {
    const params = await props.params;

    let blueprints: any[] = [];
    try {
        const res = await internal.get<
            AxiosResponse<ListBlueprintsResponse>
        >(`/org/${params.orgId}/domains`, await authCookieHeader());

        blueprints = res.data.data.domains as any[];
    } catch (e) {
        console.error(e);
    }

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
        redirect(`/${params.orgId}`);
    }

    if (!org) {
    }

    const t = await getTranslations();
    return (
           <>
               <OrgProvider org={org}>
                   <SettingsSectionTitle
                       title={t("blueprints")}
                       description={t("blueprintsDescription")}
                   />
                   {/* <DomainsTable domains={domains} /> */}
               </OrgProvider>
           </>
       );
}