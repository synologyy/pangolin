import { redirect } from "next/navigation";

export default async function ClientPage(props: {
    params: Promise<{ orgId: string; clientId: number }>;
}) {
    const params = await props.params;
    redirect(`/${params.orgId}/settings/clients/${params.clientId}/general`);
}
