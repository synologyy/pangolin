"use client";

import PermissionsSelectBox from "@app/components/PermissionsSelectBox";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionBody,
    SettingsSectionDescription,
    SettingsSectionFooter,
    SettingsSectionHeader,
    SettingsSectionTitle
} from "@app/components/Settings";
import { Button } from "@app/components/ui/button";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { toast } from "@app/hooks/useToast";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { ListApiKeyActionsResponse } from "@server/routers/apiKeys";
import { AxiosResponse } from "axios";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function Page() {
    const { env } = useEnvContext();
    const api = createApiClient({ env });
    const { orgId, apiKeyId } = useParams();

    const t = useTranslations();

    const [loadingPage, setLoadingPage] = useState<boolean>(true);
    const [selectedPermissions, setSelectedPermissions] = useState<
        Record<string, boolean>
    >({});
    const [loadingSavePermissions, setLoadingSavePermissions] =
        useState<boolean>(false);

    useEffect(() => {
        async function load() {
            setLoadingPage(true);

            const res = await api
                .get<
                    AxiosResponse<ListApiKeyActionsResponse>
                >(`/org/${orgId}/api-key/${apiKeyId}/actions`)
                .catch((e) => {
                    toast({
                        variant: "destructive",
                        title: t("apiKeysPermissionsErrorLoadingActions"),
                        description: formatAxiosError(
                            e,
                            t("apiKeysPermissionsErrorLoadingActions")
                        )
                    });
                });

            if (res && res.status === 200) {
                const data = res.data.data;
                for (const action of data.actions) {
                    setSelectedPermissions((prev) => ({
                        ...prev,
                        [action.actionId]: true
                    }));
                }
            }

            setLoadingPage(false);
        }

        load();
    }, []);

    async function savePermissions() {
        setLoadingSavePermissions(true);

        const actionsRes = await api
            .post(`/org/${orgId}/api-key/${apiKeyId}/actions`, {
                actionIds: Object.keys(selectedPermissions).filter(
                    (key) => selectedPermissions[key]
                )
            })
            .catch((e) => {
                console.error(t("apiKeysErrorSetPermission"), e);
                toast({
                    variant: "destructive",
                    title: t("apiKeysErrorSetPermission"),
                    description: formatAxiosError(e)
                });
            });

        if (actionsRes && actionsRes.status === 200) {
            toast({
                title: t("apiKeysPermissionsUpdated"),
                description: t("apiKeysPermissionsUpdatedDescription")
            });
        }

        setLoadingSavePermissions(false);
    }

    return (
        <>
            {!loadingPage && (
                <SettingsContainer>
                    <SettingsSection>
                        <SettingsSectionHeader>
                            <SettingsSectionTitle>
                                {t("apiKeysPermissionsGeneralSettings")}
                            </SettingsSectionTitle>
                            <SettingsSectionDescription>
                                {t(
                                    "apiKeysPermissionsGeneralSettingsDescription"
                                )}
                            </SettingsSectionDescription>
                        </SettingsSectionHeader>
                        <SettingsSectionBody>
                            <PermissionsSelectBox
                                selectedPermissions={selectedPermissions}
                                onChange={setSelectedPermissions}
                            />

                            <SettingsSectionFooter>
                                <Button
                                    onClick={async () => {
                                        await savePermissions();
                                    }}
                                    loading={loadingSavePermissions}
                                    disabled={loadingSavePermissions}
                                >
                                    {t("apiKeysPermissionsSave")}
                                </Button>
                            </SettingsSectionFooter>
                        </SettingsSectionBody>
                    </SettingsSection>
                </SettingsContainer>
            )}
        </>
    );
}
