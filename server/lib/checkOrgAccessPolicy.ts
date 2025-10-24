import { Org, User } from "@server/db";

export type CheckOrgAccessPolicyProps = {
    orgId?: string;
    org?: Org;
    userId?: string;
    user?: User;
};

export type CheckOrgAccessPolicyResult = {
    allowed: boolean;
    error?: string;
    policies?: {
        requiredTwoFactor?: boolean;
    };
};

export async function checkOrgAccessPolicy(
    props: CheckOrgAccessPolicyProps
): Promise<{
    success: boolean;
    error?: string;
}> {
    return { success: true };
}
