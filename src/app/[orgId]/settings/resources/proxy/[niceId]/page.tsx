import { redirect } from "next/navigation";

export default async function ResourcePage(props: {
    params: Promise<{ niceId: string; orgId: string }>;
}) {
    const params = await props.params;
    redirect(
        `/${params.orgId}/settings/resources/proxy/${params.niceId}/proxy`
    );
}
