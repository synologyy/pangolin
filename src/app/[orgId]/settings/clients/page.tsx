import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import { AxiosResponse } from "axios";
import { ClientRow } from "../../../../components/ClientsTable";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { ListClientsResponse } from "@server/routers/client";
import ClientsTable from "../../../../components/ClientsTable";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

type ClientsPageProps = {
    params: Promise<{ orgId: string }>;
    searchParams: Promise<{ view?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ClientsPage(props: ClientsPageProps) {
    const t = await getTranslations();

    const params = await props.params;

    redirect(`/${params.orgId}/settings/clients/user`);
}
