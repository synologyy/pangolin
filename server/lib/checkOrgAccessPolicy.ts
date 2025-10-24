import { Org, User } from "@server/db";

type CheckOrgAccessPolicyProps = {
    orgId?: string;
    org?: Org;
    userId?: string;
    user?: User;
};

export async function checkOrgAccessPolicy(
    props: CheckOrgAccessPolicyProps
): Promise<{
    success: boolean;
    error?: string;
}> {
    return { success: true };
}
