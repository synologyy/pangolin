import { Org, Session, User } from "@server/db";

export type CheckOrgAccessPolicyProps = {
    orgId?: string;
    org?: Org;
    userId?: string;
    user?: User;
    sessionId?: string;
    session?: Session;
};

export type CheckOrgAccessPolicyResult = {
    allowed: boolean;
    error?: string;
    policies?: {
        requiredTwoFactor?: boolean;
        maxSessionLength?: {
            compliant: boolean;
            maxSessionLengthHours: number;
            sessionAgeHours: number;
        }
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
