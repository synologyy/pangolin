"use client";

import { useState } from "react";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionBody,
    SettingsSectionDescription,
    SettingsSectionHeader,
    SettingsSectionTitle
} from "@app/components/Settings";
import { Button } from "@app/components/ui/button";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { toast } from "@app/hooks/useToast";
import { useParams, useRouter } from "next/navigation";
import { AxiosResponse } from "axios";
import { useTranslations } from "next-intl";
import {
    PickRemoteExitNodeDefaultsResponse,
    QuickStartRemoteExitNodeResponse
} from "@server/routers/remoteExitNode/types";
import { useRemoteExitNodeContext } from "@app/hooks/useRemoteExitNodeContext";
import RegenerateCredentialsModal from "@app/components/RegenerateCredentialsModal";
import { useSubscriptionStatusContext } from "@app/hooks/useSubscriptionStatusContext";
import { useLicenseStatusContext } from "@app/hooks/useLicenseStatusContext";
import { build } from "@server/build";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@app/components/ui/tooltip";

export default function CredentialsPage() {
    const { env } = useEnvContext();
    const api = createApiClient({ env });
    const { orgId } = useParams();
    const router = useRouter();
    const t = useTranslations();
    const { remoteExitNode } = useRemoteExitNodeContext();

    const [modalOpen, setModalOpen] = useState(false);
    const [credentials, setCredentials] = useState<PickRemoteExitNodeDefaultsResponse | null>(null);

    const { licenseStatus, isUnlocked } = useLicenseStatusContext();
    const subscription = useSubscriptionStatusContext();

    const isSecurityFeatureDisabled = () => {
        const isEnterpriseNotLicensed = build === "enterprise" && !isUnlocked();
        const isSaasNotSubscribed =
            build === "saas" && !subscription?.isSubscribed();
        return isEnterpriseNotLicensed || isSaasNotSubscribed;
    };


    const handleConfirmRegenerate = async () => {

        const response = await api.get<AxiosResponse<PickRemoteExitNodeDefaultsResponse>>(
            `/org/${orgId}/pick-remote-exit-node-defaults`
        );

        const data = response.data.data;
        setCredentials(data);

        await api.put<AxiosResponse<QuickStartRemoteExitNodeResponse>>(
            `/org/${orgId}/reGenerate-remote-exit-node-secret`,
            {
                remoteExitNodeId: remoteExitNode.remoteExitNodeId,
                secret: data.secret,
            }
        );

        toast({
            title: t("credentialsSaved"),
            description: t("credentialsSavedDescription")
        });

        router.refresh();
    };

    const getCredentials = () => {
        if (credentials) {
            return {
                Id: remoteExitNode.remoteExitNodeId,
                Secret: credentials.secret
            };
        }
        return undefined;
    };

    return (
        <SettingsContainer>
            <SettingsSection>
                <SettingsSectionHeader>
                    <SettingsSectionTitle>
                        {t("generatedcredentials")}
                    </SettingsSectionTitle>
                    <SettingsSectionDescription>
                        {t("regenerateCredentials")}
                    </SettingsSectionDescription>
                </SettingsSectionHeader>

                <SettingsSectionBody>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="inline-block">
                                    <Button
                                        onClick={() => setModalOpen(true)}
                                        disabled={isSecurityFeatureDisabled()}
                                    >
                                        {t("regeneratecredentials")}
                                    </Button>
                                </div>
                            </TooltipTrigger>

                            {isSecurityFeatureDisabled() && (
                                <TooltipContent side="top">
                                    {t("featureDisabledTooltip")}
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                </SettingsSectionBody>
            </SettingsSection>

            <RegenerateCredentialsModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                type="remote-exit-node"
                onConfirmRegenerate={handleConfirmRegenerate}
                dashboardUrl={env.app.dashboardUrl}
                credentials={getCredentials()}
            />
        </SettingsContainer>
    );
}