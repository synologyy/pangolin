import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import { AxiosResponse } from "axios";
import { ClientRow } from "./ClientsTable";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { ListClientsResponse } from "@server/routers/client";
import ClientsTable from "./ClientsTable";

type ClientsPageProps = {
    params: Promise<{ orgId: string }>;
};

export const dynamic = "force-dynamic";

export default async function ClientsPage(props: ClientsPageProps) {
    const params = await props.params;
    let clients: ListClientsResponse["clients"] = [];
    try {
        const res = await internal.get<AxiosResponse<ListClientsResponse>>(
            `/org/${params.orgId}/clients`,
            await authCookieHeader()
        );
        clients = res.data.data.clients;
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

    const clientRows: ClientRow[] = clients.map((client) => {
        return {
            name: client.name,
            id: client.clientId,
            subnet: client.subnet.split("/")[0],
            mbIn: formatSize(client.megabytesIn || 0),
            mbOut: formatSize(client.megabytesOut || 0),
            orgId: params.orgId,
            online: client.online
        };
    });

    return (
        <>
            <SettingsSectionTitle
                title="Manage Clients (beta)"
                description="Clients are devices that can connect to your sites"
            />

            <ClientsTable clients={clientRows} orgId={params.orgId} />
        </>
    );
}
