import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import { AxiosResponse } from "axios";
import { ClientRow } from "../../../../components/ClientsTable";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { ListClientsResponse } from "@server/routers/client";
import ClientsTable from "../../../../components/ClientsTable";
import { getTranslations } from "next-intl/server";

type ClientsPageProps = {
    params: Promise<{ orgId: string }>;
    searchParams: Promise<{ view?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ClientsPage(props: ClientsPageProps) {
    const t = await getTranslations();

    const params = await props.params;
    const searchParams = await props.searchParams;

    // Default to 'user' view, or use the query param if provided
    let defaultView: "user" | "machine" = "user";
    defaultView = searchParams.view === "machine" ? "machine" : "user";

    let userClients: ListClientsResponse["clients"] = [];
    let machineClients: ListClientsResponse["clients"] = [];

    try {
        const [userRes, machineRes] = await Promise.all([
            internal.get<AxiosResponse<ListClientsResponse>>(
                `/org/${params.orgId}/clients?filter=user`,
                await authCookieHeader()
            ),
            internal.get<AxiosResponse<ListClientsResponse>>(
                `/org/${params.orgId}/clients?filter=machine`,
                await authCookieHeader()
            )
        ]);
        userClients = userRes.data.data.clients;
        machineClients = machineRes.data.data.clients;
    } catch (e) {}

    function formatSize(mb: number): string {
        if (mb >= 1024 * 1024) {
            return `${(mb / (1024 * 1024)).toFixed(2)} TB`;
        } else if (mb >= 1024) {
            return `${(mb / 1024).toFixed(2)} GB`;
        } else {
            return `${mb.toFixed(2)} MB`;
        }
    }

    const mapClientToRow = (client: ListClientsResponse["clients"][0]): ClientRow => {
        return {
            name: client.name,
            id: client.clientId,
            subnet: client.subnet.split("/")[0],
            mbIn: formatSize(client.megabytesIn || 0),
            mbOut: formatSize(client.megabytesOut || 0),
            orgId: params.orgId,
            online: client.online,
            olmVersion: client.olmVersion || undefined,
            olmUpdateAvailable: client.olmUpdateAvailable || false,
            userId: client.userId,
            username: client.username,
            userEmail: client.userEmail
        };
    };

    const userClientRows: ClientRow[] = userClients.map(mapClientToRow);
    const machineClientRows: ClientRow[] = machineClients.map(mapClientToRow);

    return (
        <>
            <SettingsSectionTitle
                title={t("manageClients")}
                description={t("manageClientsDescription")}
            />

            <ClientsTable
                userClients={userClientRows}
                machineClients={machineClientRows}
                orgId={params.orgId}
                defaultView={defaultView}
            />
        </>
    );
}
