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
import { useTranslations } from "next-intl";
import { PickClientDefaultsResponse } from "@server/routers/client";
import { useClientContext } from "@app/hooks/useClientContext";
import RegenerateCredentialsModal from "@app/components/RegenerateCredentialsModal";
import { build } from "@server/build";
import { useLicenseStatusContext } from "@app/hooks/useLicenseStatusContext";
import { useSubscriptionStatusContext } from "@app/hooks/useSubscriptionStatusContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@app/components/ui/tooltip";

export default function CredentialsPage() {
    const { env } = useEnvContext();
    const api = createApiClient({ env });
    const { orgId } = useParams();
    const router = useRouter();
    const t = useTranslations();
    const { client } = useClientContext();

    const [modalOpen, setModalOpen] = useState(false);
    const [clientDefaults, setClientDefaults] = useState<PickClientDefaultsResponse | null>(null);

    const { licenseStatus, isUnlocked } = useLicenseStatusContext();
    const subscription = useSubscriptionStatusContext();

    const isSecurityFeatureDisabled = () => {
        const isEnterpriseNotLicensed = build === "enterprise" && !isUnlocked();
        const isSaasNotSubscribed =
            build === "saas" && !subscription?.isSubscribed();
        return isEnterpriseNotLicensed || isSaasNotSubscribed;
    };


    const handleConfirmRegenerate = async () => {

        const res = await api.get(`/org/${orgId}/pick-client-defaults`);
        if (res && res.status === 200) {
            const data = res.data.data;
            setClientDefaults(data);

            await api.post(`/re-key/${client?.clientId}/regenerate-client-secret`, {
                olmId: data.olmId,
                secret: data.olmSecret,
            });

            toast({
                title: t("credentialsSaved"),
                description: t("credentialsSavedDescription")
            });

            router.refresh();
        }
    };

    const getCredentials = () => {
        if (clientDefaults) {
            return {
                Id: clientDefaults.olmId,
                Secret: clientDefaults.olmSecret
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
                                        disabled={isSecurityFeatureDisabled()}>
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
                type="client-olm"
                onConfirmRegenerate={handleConfirmRegenerate}
                dashboardUrl={env.app.dashboardUrl}
                credentials={getCredentials()}
            />
        </SettingsContainer>
    );
}