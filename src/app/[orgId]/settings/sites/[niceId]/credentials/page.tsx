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
import { PickSiteDefaultsResponse } from "@server/routers/site";
import { useSiteContext } from "@app/hooks/useSiteContext";
import { generateKeypair } from "../wireguardConfig";
import RegenerateCredentialsModal from "@app/components/RegenerateCredentialsModal";
import { useLicenseStatusContext } from "@app/hooks/useLicenseStatusContext";
import { useSubscriptionStatusContext } from "@app/hooks/useSubscriptionStatusContext";
import { build } from "@server/build";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@app/components/ui/tooltip";

export default function CredentialsPage() {
    const { env } = useEnvContext();
    const api = createApiClient({ env });
    const { orgId } = useParams();
    const router = useRouter();
    const t = useTranslations();
    const { site } = useSiteContext();

    const [modalOpen, setModalOpen] = useState(false);
    const [siteDefaults, setSiteDefaults] = useState<PickSiteDefaultsResponse | null>(null);
    const [wgConfig, setWgConfig] = useState("");
    const [publicKey, setPublicKey] = useState("");

    const { licenseStatus, isUnlocked } = useLicenseStatusContext();
    const subscription = useSubscriptionStatusContext();

    const isSecurityFeatureDisabled = () => {
        const isEnterpriseNotLicensed = build === "enterprise" && !isUnlocked();
        const isSaasNotSubscribed =
            build === "saas" && !subscription?.isSubscribed();
        return isEnterpriseNotLicensed || isSaasNotSubscribed;
    };


    const hydrateWireGuardConfig = (
        privateKey: string,
        publicKey: string,
        subnet: string,
        address: string,
        endpoint: string,
        listenPort: string
    ) => {
        const config = `[Interface]
Address = ${subnet}
ListenPort = 51820
PrivateKey = ${privateKey}

[Peer]
PublicKey = ${publicKey}
AllowedIPs = ${address.split("/")[0]}/32
Endpoint = ${endpoint}:${listenPort}
PersistentKeepalive = 5`;
        setWgConfig(config);
        return config;
    };

    const handleConfirmRegenerate = async () => {
        let generatedPublicKey = "";
        let generatedWgConfig = "";

        if (site?.type === "wireguard") {
            const generatedKeypair = generateKeypair();
            generatedPublicKey = generatedKeypair.publicKey;
            setPublicKey(generatedPublicKey);

            const res = await api.get(`/org/${orgId}/pick-site-defaults`);
            if (res && res.status === 200) {
                const data = res.data.data;
                setSiteDefaults(data);

                // generate config with the fetched data
                generatedWgConfig = hydrateWireGuardConfig(
                    generatedKeypair.privateKey,
                    data.publicKey,
                    data.subnet,
                    data.address,
                    data.endpoint,
                    data.listenPort
                );
            }

            await api.post(`/site/${site?.siteId}/regenerate-secret`, {
                type: "wireguard",
                subnet: res.data.data.subnet,
                exitNodeId: res.data.data.exitNodeId,
                pubKey: generatedPublicKey
            });
        }

        if (site?.type === "newt") {
            const res = await api.get(`/org/${orgId}/pick-site-defaults`);
            if (res && res.status === 200) {
                const data = res.data.data;
                setSiteDefaults(data);

                await api.post(`/site/${site?.siteId}/regenerate-secret`, {
                    type: "newt",
                    newtId: data.newtId,
                    newtSecret: data.newtSecret
                });
            }
        }

        toast({
            title: t("credentialsSaved"),
            description: t("credentialsSavedDescription")
        });

        router.refresh();
    };

    const getCredentialType = () => {
        if (site?.type === "wireguard") return "site-wireguard";
        if (site?.type === "newt") return "site-newt";
        return "site-newt";
    };

    const getCredentials = () => {
        if (site?.type === "wireguard" && wgConfig) {
            return { wgConfig };
        }
        if (site?.type === "newt" && siteDefaults) {
            return {
                Id: siteDefaults.newtId,
                Secret: siteDefaults.newtSecret
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
                type={getCredentialType()}
                onConfirmRegenerate={handleConfirmRegenerate}
                dashboardUrl={env.app.dashboardUrl}
                credentials={getCredentials()}
            />
        </SettingsContainer>
    );
}