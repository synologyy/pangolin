import { redirect } from "next/navigation";

export interface ResourcesPageProps {
    params: Promise<{ orgId: string }>;
}

export default async function ResourcesPage(props: ResourcesPageProps) {
    const params = await props.params;
    redirect(`/${params.orgId}/settings/resources/proxy`);
}
