import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import ProfileIcon from "@app/components/ProfileIcon";
import { verifySession } from "@app/lib/auth/verifySession";
import UserProvider from "@app/providers/UserProvider";
import { GetOrgResponse } from "@server/routers/org";
import { GetOrgUserResponse } from "@server/routers/user";
import { AxiosResponse } from "axios";
import { redirect } from "next/navigation";
import { cache } from "react";
import SetLastOrgCookie from "@app/components/SetLastOrgCookie";

export default async function OrgLayout(props: {
    children: React.ReactNode;
    params: Promise<{ orgId: string }>;
}) {
    const cookie = await authCookieHeader();
    const params = await props.params;
    const orgId = params.orgId;

    if (!orgId) {
        redirect(`/`);
    }

    const getUser = cache(verifySession);
    const user = await getUser();

    if (!user) {
        redirect(`/`);
    }

    try {
        const getOrgUser = cache(() =>
            internal.get<AxiosResponse<GetOrgUserResponse>>(
                `/org/${orgId}/user/${user.userId}`,
                cookie
            )
        );
        const orgUser = await getOrgUser();
    } catch {
        redirect(`/`);
    }

    try {
        const getOrg = cache(() =>
            internal.get<AxiosResponse<GetOrgResponse>>(`/org/${orgId}`, cookie)
        );
        await getOrg();
    } catch {
        redirect(`/`);
    }

    return (
        <>
            {props.children}
            <SetLastOrgCookie orgId={orgId} />
        </>
    );
}
