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

export default function CredentialsPage() {
    const { env } = useEnvContext();
    const api = createApiClient({ env });
    const { orgId } = useParams();
    const router = useRouter();
    const t = useTranslations();
    const { client } = useClientContext();
    
    const [modalOpen, setModalOpen] = useState(false);
    const [clientDefaults, setClientDefaults] = useState<PickClientDefaultsResponse | null>(null);

    const handleConfirmRegenerate = async () => {
    
        const res = await api.get(`/org/${orgId}/pick-client-defaults`);
        if (res && res.status === 200) {
            const data = res.data.data;
            setClientDefaults(data);

            await api.post(`/client/${client?.clientId}/regenerate-secret`, {
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
                    <Button onClick={() => setModalOpen(true)}>
                        {t("regeneratecredentials")}
                    </Button>
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