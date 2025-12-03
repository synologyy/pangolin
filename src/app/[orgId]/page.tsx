import { Layout } from "@app/components/Layout";
import MemberResourcesPortal from "@app/components/MemberResourcesPortal";
import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import { verifySession } from "@app/lib/auth/verifySession";
import { pullEnv } from "@app/lib/pullEnv";
import UserProvider from "@app/providers/UserProvider";
import { ListUserOrgsResponse } from "@server/routers/org";
import { GetOrgOverviewResponse } from "@server/routers/org/getOrgOverview";
import { AxiosResponse } from "axios";
import { redirect } from "next/navigation";
import { cache } from "react";

type OrgPageProps = {
    params: Promise<{ orgId: string }>;
};

export default async function OrgPage(props: OrgPageProps) {
    const params = await props.params;
    const orgId = params.orgId;
    const env = pullEnv();

    if (!orgId) {
        redirect(`/`);
    }

    const getUser = cache(verifySession);
    const user = await getUser();

    if (!user) {
        redirect("/");
    }

    let overview: GetOrgOverviewResponse | undefined;
    try {
        const res = await internal.get<AxiosResponse<GetOrgOverviewResponse>>(
            `/org/${orgId}/overview`,
            await authCookieHeader()
        );
        overview = res.data.data;
    } catch (e) {}

    // If user is admin or owner, redirect to settings
    if (overview?.isAdmin || overview?.isOwner) {
        redirect(`/${orgId}/settings`);
    }

    // For non-admin users, show the member resources portal
    let orgs: ListUserOrgsResponse["orgs"] = [];
    try {
        const getOrgs = cache(async () =>
            internal.get<AxiosResponse<ListUserOrgsResponse>>(
                `/user/${user.userId}/orgs`,
                await authCookieHeader()
            )
        );
        const res = await getOrgs();
        if (res && res.data.data.orgs) {
            orgs = res.data.data.orgs;
        }
    } catch (e) {}

    return (
        <UserProvider user={user}>
            <Layout orgId={orgId} navItems={[]} orgs={orgs}>
                {overview && <MemberResourcesPortal orgId={orgId} />}
            </Layout>
        </UserProvider>
    );
}
