"use client";

import { useState } from "react";
import { CheckOrgUserAccessResponse } from "@server/routers/org";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Shield } from "lucide-react";
import Enable2FaDialog from "./Enable2FaDialog";
import { useTranslations } from "next-intl";
import { useUserContext } from "@app/hooks/useUserContext";
import { useRouter } from "next/navigation";

type OrgPolicyResultProps = {
    orgId: string;
    userId: string;
    accessRes: CheckOrgUserAccessResponse;
};

type PolicyItem = {
    id: string;
    name: string;
    description: string;
    compliant: boolean;
    action?: () => void;
    actionText?: string;
};

export default function OrgPolicyResult({
    orgId,
    userId,
    accessRes
}: OrgPolicyResultProps) {
    const [show2FaDialog, setShow2FaDialog] = useState(false);
    const t = useTranslations();
    const { user } = useUserContext();
    const router = useRouter();

    // Determine if user is compliant with 2FA policy
    const isTwoFactorCompliant = user?.twoFactorEnabled || false;
    const policyKeys = Object.keys(accessRes.policies || {});

    const policies: PolicyItem[] = [];

    // Only add 2FA policy if the organization has it enforced
    if (policyKeys.includes("requiredTwoFactor")) {
        policies.push({
            id: "two-factor",
            name: t("twoFactorAuthentication"),
            description: t("twoFactorDescription"),
            compliant: isTwoFactorCompliant,
            action: !isTwoFactorCompliant
                ? () => setShow2FaDialog(true)
                : undefined,
            actionText: !isTwoFactorCompliant ? t("enableTwoFactor") : undefined
        });

        // policies.push({
        //     id: "reauth-required",
        //     name: "Re-authentication",
        //     description:
        //         "It's been 30 days since you last verified your identity. Please log out and log back in to continue.",
        //     compliant: false,
        //     action: () => {},
        //     actionText: "Log Out"
        // });
        //
        // policies.push({
        //     id: "password-rotation",
        //     name: "Password Rotation",
        //     description:
        //         "It's been 30 days since you last changed your password. Please update your password to continue.",
        //     compliant: false,
        //     action: () => {},
        //     actionText: "Change Password"
        // });
    }

    const nonCompliantPolicies = policies.filter((policy) => !policy.compliant);
    const allCompliant =
        policies.length === 0 || nonCompliantPolicies.length === 0;

    // Calculate progress
    const completedPolicies = policies.filter(
        (policy) => policy.compliant
    ).length;
    const totalPolicies = policies.length;
    const progressPercentage =
        totalPolicies > 0 ? (completedPolicies / totalPolicies) * 100 : 100;

    // If no policies are enforced, show a simple success message
    if (policies.length === 0) {
        return (
            <div className="text-center py-8">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    {t("accessGranted")}
                </h2>
                <p className="text-sm text-gray-600">
                    {t("noSecurityRequirements")}
                </p>
            </div>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {t("securityRequirements")}
                    </CardTitle>
                    <CardDescription>
                        {allCompliant
                            ? t("allRequirementsMet")
                            : t("completeRequirementsToContinue")}
                    </CardDescription>
                </CardHeader>

                {/* Progress Bar */}
                <div className="px-6 pb-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                        <span>
                            {completedPolicies} of {totalPolicies} steps
                            completed
                        </span>
                        <span>{Math.round(progressPercentage)}%</span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                </div>

                <CardContent className="space-y-4">
                    {policies.map((policy) => (
                        <div
                            key={policy.id}
                            className="flex items-start gap-3 p-4 border rounded-lg"
                        >
                            <div className="flex-shrink-0 mt-0.5">
                                {policy.compliant ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium">
                                    {policy.name}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {policy.description}
                                </p>
                                {policy.action && policy.actionText && (
                                    <div className="mt-3">
                                        <Button
                                            size="sm"
                                            onClick={policy.action}
                                            className="w-full sm:w-auto"
                                        >
                                            {policy.actionText}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {allCompliant && (
                <div className="text-center">
                    <p className="text-sm text-green-600 font-medium">
                        {t("allRequirementsMet")}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {t("youCanNowAccessOrganization")}
                    </p>
                </div>
            )}

            <Enable2FaDialog
                open={show2FaDialog}
                setOpen={(val) => {
                    setShow2FaDialog(val);
                    router.refresh();
                }}
            />
        </>
    );
}
