"use client";
import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";
import AuthPageSettings, {
    AuthPageSettingsRef
} from "@app/components/private/AuthPageSettings";

import { Button } from "@app/components/ui/button";
import { useOrgContext } from "@app/hooks/useOrgContext";
import { userOrgUserContext } from "@app/hooks/useOrgUserContext";
import { toast } from "@app/hooks/useToast";
import { useState, useRef } from "react";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { formatAxiosError } from "@app/lib/api";
import { AxiosResponse } from "axios";
import { DeleteOrgResponse, ListUserOrgsResponse } from "@server/routers/org";
import { useRouter } from "next/navigation";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionHeader,
    SettingsSectionTitle,
    SettingsSectionDescription,
    SettingsSectionBody,
    SettingsSectionForm,
    SettingsSectionFooter
} from "@app/components/Settings";
import { useUserContext } from "@app/hooks/useUserContext";
import { useTranslations } from "next-intl";
import { build } from "@server/build";
import { SwitchInput } from "@app/components/SwitchInput";
import { useLicenseStatusContext } from "@app/hooks/useLicenseStatusContext";
import { useSubscriptionStatusContext } from "@app/hooks/useSubscriptionStatusContext";
import { Badge } from "@app/components/ui/badge";

// Session length options in hours
const SESSION_LENGTH_OPTIONS = [
    { value: null, label: "Unenforced" },
    { value: 72, label: "3 days" }, // 3 * 24 = 72 hours
    { value: 168, label: "7 days" }, // 7 * 24 = 168 hours
    { value: 336, label: "14 days" }, // 14 * 24 = 336 hours
    { value: 720, label: "30 days" }, // 30 * 24 = 720 hours
    { value: 2160, label: "90 days" }, // 90 * 24 = 2160 hours
    { value: 4320, label: "180 days" } // 180 * 24 = 4320 hours
];

// Schema for general organization settings
const GeneralFormSchema = z.object({
    name: z.string(),
    subnet: z.string().optional(),
    requireTwoFactor: z.boolean().optional(),
    maxSessionLengthHours: z.number().nullable().optional()
});

type GeneralFormValues = z.infer<typeof GeneralFormSchema>;

export default function GeneralPage() {
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const { orgUser } = userOrgUserContext();
    const router = useRouter();
    const { org } = useOrgContext();
    const api = createApiClient(useEnvContext());
    const { user } = useUserContext();
    const t = useTranslations();
    const { env } = useEnvContext();
    const { licenseStatus, isUnlocked } = useLicenseStatusContext();
    const subscriptionStatus = useSubscriptionStatusContext();

    const [loadingDelete, setLoadingDelete] = useState(false);
    const [loadingSave, setLoadingSave] = useState(false);
    const authPageSettingsRef = useRef<AuthPageSettingsRef>(null);

    const form = useForm({
        resolver: zodResolver(GeneralFormSchema),
        defaultValues: {
            name: org?.org.name,
            subnet: org?.org.subnet || "", // Add default value for subnet
            requireTwoFactor: org?.org.requireTwoFactor || false,
            maxSessionLengthHours: org?.org.maxSessionLengthHours || null
        },
        mode: "onChange"
    });

    async function deleteOrg() {
        setLoadingDelete(true);
        try {
            const res = await api.delete<AxiosResponse<DeleteOrgResponse>>(
                `/org/${org?.org.orgId}`
            );
            toast({
                title: t("orgDeleted"),
                description: t("orgDeletedMessage")
            });
            if (res.status === 200) {
                pickNewOrgAndNavigate();
            }
        } catch (err) {
            console.error(err);
            toast({
                variant: "destructive",
                title: t("orgErrorDelete"),
                description: formatAxiosError(err, t("orgErrorDeleteMessage"))
            });
        } finally {
            setLoadingDelete(false);
        }
    }

    async function pickNewOrgAndNavigate() {
        try {
            const res = await api.get<AxiosResponse<ListUserOrgsResponse>>(
                `/user/${user.userId}/orgs`
            );

            if (res.status === 200) {
                if (res.data.data.orgs.length > 0) {
                    const orgId = res.data.data.orgs[0].orgId;
                    // go to `/${orgId}/settings`);
                    router.push(`/${orgId}/settings`);
                } else {
                    // go to `/setup`
                    router.push("/setup");
                }
            }
        } catch (err) {
            console.error(err);
            toast({
                variant: "destructive",
                title: t("orgErrorFetch"),
                description: formatAxiosError(err, t("orgErrorFetchMessage"))
            });
        }
    }

    async function onSubmit(data: GeneralFormValues) {
        setLoadingSave(true);

        try {
            const reqData = {
                name: data.name
            } as any;
            if (build !== "oss") {
                reqData.requireTwoFactor = data.requireTwoFactor || false;
                reqData.maxSessionLengthHours = data.maxSessionLengthHours;
            }

            // Update organization
            await api.post(`/org/${org?.org.orgId}`, reqData);

            // Also save auth page settings if they have unsaved changes
            if (
                build === "saas" &&
                authPageSettingsRef.current?.hasUnsavedChanges()
            ) {
                await authPageSettingsRef.current.saveAuthSettings();
            }

            toast({
                title: t("orgUpdated"),
                description: t("orgUpdatedDescription")
            });
            router.refresh();
        } catch (e) {
            toast({
                variant: "destructive",
                title: t("orgErrorUpdate"),
                description: formatAxiosError(e, t("orgErrorUpdateMessage"))
            });
        } finally {
            setLoadingSave(false);
        }
    }

    return (
        <SettingsContainer>
            <ConfirmDeleteDialog
                open={isDeleteModalOpen}
                setOpen={(val) => {
                    setIsDeleteModalOpen(val);
                }}
                dialog={
                    <div>
                        <p>{t("orgQuestionRemove")}</p>
                        <p>{t("orgMessageRemove")}</p>
                    </div>
                }
                buttonText={t("orgDeleteConfirm")}
                onConfirm={deleteOrg}
                string={org?.org.name || ""}
                title={t("orgDelete")}
            />
            <SettingsSection>
                <SettingsSectionHeader>
                    <SettingsSectionTitle>
                        {t("orgGeneralSettings")}
                    </SettingsSectionTitle>
                    <SettingsSectionDescription>
                        {t("orgGeneralSettingsDescription")}
                    </SettingsSectionDescription>
                </SettingsSectionHeader>
                <SettingsSectionBody>
                    <SettingsSectionForm>
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit)}
                                className="space-y-4"
                                id="org-settings-form"
                            >
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("name")}</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                            <FormDescription>
                                                {t("orgDisplayName")}
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                                {env.flags.enableClients && (
                                    <FormField
                                        control={form.control}
                                        name="subnet"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t("subnet")}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        disabled={true}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                                <FormDescription>
                                                    {t("subnetDescription")}
                                                </FormDescription>
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </form>
                        </Form>
                    </SettingsSectionForm>
                </SettingsSectionBody>
            </SettingsSection>

            {/* Security Settings Section */}
            <SettingsSection>
                <SettingsSectionHeader>
                    <div className="flex items-center gap-2">
                        <SettingsSectionTitle>
                            {t("securitySettings")}
                        </SettingsSectionTitle>
                        {build === "enterprise" && !isUnlocked() ? (
                            <Badge variant="outlinePrimary">
                                {build === "enterprise"
                                    ? t("licenseBadge")
                                    : t("subscriptionBadge")}
                            </Badge>
                        ) : null}
                    </div>
                    <SettingsSectionDescription>
                        {t("securitySettingsDescription")}
                    </SettingsSectionDescription>
                </SettingsSectionHeader>
                <SettingsSectionBody>
                    <SettingsSectionForm>
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit)}
                                className="space-y-4"
                                id="security-settings-form"
                            >
                                <FormField
                                    control={form.control}
                                    name="requireTwoFactor"
                                    render={({ field }) => {
                                        const isEnterpriseNotLicensed =
                                            build === "enterprise" &&
                                            !isUnlocked();
                                        const isSaasNotSubscribed =
                                            build === "saas" &&
                                            !subscriptionStatus?.isSubscribed();
                                        const isDisabled =
                                            isEnterpriseNotLicensed ||
                                            isSaasNotSubscribed;
                                        const shouldDisableToggle = isDisabled;

                                        return (
                                            <FormItem className="col-span-2">
                                                <div className="flex items-center gap-2">
                                                    <FormControl>
                                                        <SwitchInput
                                                            id="require-two-factor"
                                                            defaultChecked={
                                                                field.value ||
                                                                false
                                                            }
                                                            label={t(
                                                                "requireTwoFactorForAllUsers"
                                                            )}
                                                            disabled={
                                                                shouldDisableToggle
                                                            }
                                                            onCheckedChange={(
                                                                val
                                                            ) => {
                                                                if (
                                                                    !shouldDisableToggle
                                                                ) {
                                                                    form.setValue(
                                                                        "requireTwoFactor",
                                                                        val
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                    </FormControl>
                                                </div>
                                                <FormMessage />
                                                <FormDescription>
                                                    {isDisabled
                                                        ? t(
                                                              "requireTwoFactorDisabledDescription"
                                                          )
                                                        : t(
                                                              "requireTwoFactorDescription"
                                                          )}
                                                </FormDescription>
                                            </FormItem>
                                        );
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="maxSessionLengthHours"
                                    render={({ field }) => {
                                        const isEnterpriseNotLicensed =
                                            build === "enterprise" &&
                                            !isUnlocked();
                                        const isSaasNotSubscribed =
                                            build === "saas" &&
                                            !subscriptionStatus?.isSubscribed();
                                        const isDisabled =
                                            isEnterpriseNotLicensed ||
                                            isSaasNotSubscribed;

                                        return (
                                            <FormItem className="col-span-2">
                                                <FormLabel>
                                                    {t("maxSessionLength")}
                                                </FormLabel>
                                                <FormControl>
                                                    <Select
                                                        value={
                                                            field.value?.toString() ||
                                                            "null"
                                                        }
                                                        onValueChange={(value) => {
                                                            if (!isDisabled) {
                                                                const numValue =
                                                                    value === "null"
                                                                        ? null
                                                                        : parseInt(
                                                                              value,
                                                                              10
                                                                          );
                                                                form.setValue(
                                                                    "maxSessionLengthHours",
                                                                    numValue
                                                                );
                                                            }
                                                        }}
                                                        disabled={isDisabled}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue
                                                                placeholder={
                                                                    t(
                                                                        "selectSessionLength"
                                                                    )
                                                                }
                                                            />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {SESSION_LENGTH_OPTIONS.map(
                                                                (option) => (
                                                                    <SelectItem
                                                                        key={
                                                                            option.value ===
                                                                            null
                                                                                ? "null"
                                                                                : option.value.toString()
                                                                        }
                                                                        value={
                                                                            option.value ===
                                                                            null
                                                                                ? "null"
                                                                                : option.value.toString()
                                                                        }
                                                                    >
                                                                        {
                                                                            option.label
                                                                        }
                                                                    </SelectItem>
                                                                )
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                                <FormMessage />
                                                <FormDescription>
                                                    {isDisabled
                                                        ? t(
                                                              "maxSessionLengthDisabledDescription"
                                                          )
                                                        : t(
                                                              "maxSessionLengthDescription"
                                                          )}
                                                </FormDescription>
                                            </FormItem>
                                        );
                                    }}
                                />
                            </form>
                        </Form>
                    </SettingsSectionForm>
                </SettingsSectionBody>
            </SettingsSection>

            {build === "saas" && <AuthPageSettings ref={authPageSettingsRef} />}

            <div className="flex justify-end gap-2">
                {build !== "saas" && (
                    <Button
                        variant="destructive"
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="flex items-center gap-2"
                        loading={loadingDelete}
                        disabled={loadingDelete}
                    >
                        {t("orgDelete")}
                    </Button>
                )}
                <Button
                    type="submit"
                    form="org-settings-form"
                    loading={loadingSave}
                    disabled={loadingSave}
                >
                    {t("saveSettings")}
                </Button>
            </div>
        </SettingsContainer>
    );
}
