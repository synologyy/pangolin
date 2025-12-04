import { redirect } from "next/navigation";

export default async function ClientPage(props: {
    params: Promise<{ orgId: string; clientId: number | string }>;
}) {
    const params = await props.params;
    redirect(
        `/${params.orgId}/settings/clients/machine/${params.clientId}/general`
    );
}
