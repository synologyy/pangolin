import { redirect } from "next/navigation";

export default async function ApiKeysPage(props: {
    params: Promise<{ orgId: string; apiKeyId: string }>;
}) {
    const params = await props.params;
    redirect(
        `/${params.orgId}/settings/api-keys/${params.apiKeyId}/permissions`
    );
}
