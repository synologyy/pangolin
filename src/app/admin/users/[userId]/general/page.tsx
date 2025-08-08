"use client";

import { useEffect, useState } from "react";
import { SwitchInput } from "@app/components/SwitchInput";
import { Button } from "@app/components/ui/button";
import { toast } from "@app/hooks/useToast";
import { formatAxiosError } from "@app/lib/api";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionHeader,
    SettingsSectionTitle,
    SettingsSectionDescription,
    SettingsSectionBody,
    SettingsSectionForm
} from "@app/components/Settings";
import { UserType } from "@server/types/UserTypes";

export default function GeneralPage() {
    const { userId } = useParams();
    const api = createApiClient(useEnvContext());
    const t = useTranslations();

    const [loadingData, setLoadingData] = useState(true);
    const [loading, setLoading] = useState(false);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [userType, setUserType] = useState<UserType | null>(null);

    useEffect(() => {
        // Fetch current user 2FA status
        const fetchUserData = async () => {
            setLoadingData(true);
            try {
                const response = await api.get(`/user/${userId}`);
                if (response.status === 200) {
                    const userData = response.data.data;
                    setTwoFactorEnabled(
                        userData.twoFactorEnabled ||
                            userData.twoFactorSetupRequested
                    );
                    setUserType(userData.type);
                }
            } catch (error) {
                console.error("Failed to fetch user data:", error);
                toast({
                    variant: "destructive",
                    title: t("userErrorDelete"),
                    description: formatAxiosError(error, t("userErrorDelete"))
                });
            }
            setLoadingData(false);
        };

        fetchUserData();
    }, [userId]);

    const handleTwoFactorToggle = (enabled: boolean) => {
        setTwoFactorEnabled(enabled);
    };

    const handleSaveSettings = async () => {
        setLoading(true);

        try {
            console.log("twoFactorEnabled", twoFactorEnabled);
            await api.post(`/user/${userId}/2fa`, {
                twoFactorSetupRequested: twoFactorEnabled
            });

            setTwoFactorEnabled(twoFactorEnabled);
        } catch (error) {
            toast({
                variant: "destructive",
                title: t("otpErrorEnable"),
                description: formatAxiosError(
                    error,
                    t("otpErrorEnableDescription")
                )
            });
        } finally {
            setLoading(false);
        }
    };

    if (loadingData) {
        return null;
    }

    return (
        <>
            <SettingsContainer>
                <SettingsSection>
                    <SettingsSectionHeader>
                        <SettingsSectionTitle>
                            {t("general")}
                        </SettingsSectionTitle>
                        <SettingsSectionDescription>
                            {t("userDescription2")}
                        </SettingsSectionDescription>
                    </SettingsSectionHeader>

                    <SettingsSectionBody>
                        <SettingsSectionForm>
                            <div className="space-y-6">
                                <SwitchInput
                                    id="two-factor-auth"
                                    label={t("otpAuth")}
                                    checked={twoFactorEnabled}
                                    disabled={userType !== UserType.Internal}
                                    onCheckedChange={handleTwoFactorToggle}
                                />
                            </div>
                        </SettingsSectionForm>
                    </SettingsSectionBody>
                </SettingsSection>
            </SettingsContainer>

            <div className="flex justify-end mt-6">
                <Button
                    type="button"
                    loading={loading}
                    disabled={loading}
                    onClick={handleSaveSettings}
                >
                    {t("targetTlsSubmit")}
                </Button>
            </div>
        </>
    );
}
