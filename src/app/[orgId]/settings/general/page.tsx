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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@app/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useLicenseStatusContext } from "@app/hooks/useLicenseStatusContext";
import { useSubscriptionStatusContext } from "@app/hooks/useSubscriptionStatusContext";

// Schema for general organization settings
const GeneralFormSchema = z.object({
    name: z.string(),
    subnet: z.string().optional(),
    settingsLogRetentionDaysRequest: z.number(),
    settingsLogRetentionDaysAccess: z.number(),
    settingsLogRetentionDaysAction: z.number()
});

type GeneralFormValues = z.infer<typeof GeneralFormSchema>;

const LOG_RETENTION_OPTIONS = [
    { label: "logRetentionDisabled", value: 0 },
    { label: "logRetention3Days", value: 3 },
    { label: "logRetention7Days", value: 7 },
    { label: "logRetention14Days", value: 14 },
    { label: "logRetention30Days", value: 30 },
    { label: "logRetentionForever", value: -1 }
];

export default function GeneralPage() {
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const { orgUser } = userOrgUserContext();
    const router = useRouter();
    const { org } = useOrgContext();
    const api = createApiClient(useEnvContext());
    const { user } = useUserContext();
    const t = useTranslations();
    const { env } = useEnvContext();
    const { isUnlocked } = useLicenseStatusContext();
    const subscription = useSubscriptionStatusContext();

    const [loadingDelete, setLoadingDelete] = useState(false);
    const [loadingSave, setLoadingSave] = useState(false);
    const authPageSettingsRef = useRef<AuthPageSettingsRef>(null);

    const form = useForm({
        resolver: zodResolver(GeneralFormSchema),
        defaultValues: {
            name: org?.org.name,
            subnet: org?.org.subnet || "", // Add default value for subnet
            settingsLogRetentionDaysRequest:
                org.org.settingsLogRetentionDaysRequest ?? 15,
            settingsLogRetentionDaysAccess:
                org.org.settingsLogRetentionDaysAccess ?? 15,
            settingsLogRetentionDaysAction:
                org.org.settingsLogRetentionDaysAction ?? 15
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
            // Update organization
            await api.post(`/org/${org?.org.orgId}`, {
                name: data.name,
                // subnet: data.subnet // Include subnet in the API request
                settingsLogRetentionDaysRequest:
                    data.settingsLogRetentionDaysRequest,
                settingsLogRetentionDaysAccess:
                    data.settingsLogRetentionDaysAccess,
                settingsLogRetentionDaysAction:
                    data.settingsLogRetentionDaysAction
            });

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

    const getLabelForValue = (value: number) => {
        const option = LOG_RETENTION_OPTIONS.find((opt) => opt.value === value);
        return option ? t(option.label) : `${value} days`;
    };

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

            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                    id="org-settings-form"
                >
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
                            </SettingsSectionForm>
                        </SettingsSectionBody>
                    </SettingsSection>

                    <SettingsSection>
                        <SettingsSectionHeader>
                            <SettingsSectionTitle>
                                {t("logRetention")}
                            </SettingsSectionTitle>
                            <SettingsSectionDescription>
                                {t("logRetentionDescription")}
                            </SettingsSectionDescription>
                        </SettingsSectionHeader>
                        <SettingsSectionBody>
                            {/* {build === "saas" && !subscription?.subscribed ? (
                        <Alert variant="info" className="mb-6">
                            <AlertDescription>
                                {t("orgAuthPageDisabled")}{" "}
                                {t("subscriptionRequiredToUse")}
                            </AlertDescription>
                        </Alert>
                    ) : null} */}

                            <SettingsSectionForm>
                                <FormField
                                    control={form.control}
                                    name="settingsLogRetentionDaysRequest"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                {t("logRetentionRequestLabel")}
                                            </FormLabel>
                                            <FormControl>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            variant="outline"
                                                            className="w-full justify-between"
                                                        >
                                                            {getLabelForValue(
                                                                field.value
                                                            )}
                                                            <ChevronDown className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent className="w-full">
                                                        {LOG_RETENTION_OPTIONS.map(
                                                            (option) => (
                                                                <DropdownMenuItem
                                                                    key={
                                                                        option.value
                                                                    }
                                                                    onClick={() =>
                                                                        field.onChange(
                                                                            option.value
                                                                        )
                                                                    }
                                                                >
                                                                    {t(
                                                                        option.label
                                                                    )}
                                                                </DropdownMenuItem>
                                                            )
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </FormControl>
                                            <FormDescription>
                                                {t(
                                                    "logRetentionRequestDescription"
                                                )}
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {build != "oss" && (
                                    <>
                                        <FormField
                                            control={form.control}
                                            name="settingsLogRetentionDaysAccess"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t(
                                                            "logRetentionAccessLabel"
                                                        )}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                asChild
                                                            >
                                                                <Button
                                                                    variant="outline"
                                                                    className="w-full justify-between"
                                                                    disabled={
                                                                        (build ==
                                                                            "saas" &&
                                                                            !subscription?.subscribed) ||
                                                                        (build ==
                                                                            "enterprise" &&
                                                                            !isUnlocked())
                                                                    }
                                                                >
                                                                    {getLabelForValue(
                                                                        field.value
                                                                    )}
                                                                    <ChevronDown className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent className="w-full">
                                                                {LOG_RETENTION_OPTIONS.map(
                                                                    (
                                                                        option
                                                                    ) => (
                                                                        <DropdownMenuItem
                                                                            key={
                                                                                option.value
                                                                            }
                                                                            onClick={() =>
                                                                                field.onChange(
                                                                                    option.value
                                                                                )
                                                                            }
                                                                        >
                                                                            {t(
                                                                                option.label
                                                                            )}
                                                                        </DropdownMenuItem>
                                                                    )
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t(
                                                            "logRetentionAccessDescription"
                                                        )}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="settingsLogRetentionDaysAction"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t(
                                                            "logRetentionActionLabel"
                                                        )}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                asChild
                                                            >
                                                                <Button
                                                                    variant="outline"
                                                                    className="w-full justify-between"
                                                                    disabled={
                                                                        (build ==
                                                                            "saas" &&
                                                                            !subscription?.subscribed) ||
                                                                        (build ==
                                                                            "enterprise" &&
                                                                            !isUnlocked())
                                                                    }
                                                                >
                                                                    {getLabelForValue(
                                                                        field.value
                                                                    )}
                                                                    <ChevronDown className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent className="w-full">
                                                                {LOG_RETENTION_OPTIONS.map(
                                                                    (
                                                                        option
                                                                    ) => (
                                                                        <DropdownMenuItem
                                                                            key={
                                                                                option.value
                                                                            }
                                                                            onClick={() =>
                                                                                field.onChange(
                                                                                    option.value
                                                                                )
                                                                            }
                                                                        >
                                                                            {t(
                                                                                option.label
                                                                            )}
                                                                        </DropdownMenuItem>
                                                                    )
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t(
                                                            "logRetentionActionDescription"
                                                        )}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </>
                                )}
                            </SettingsSectionForm>
                        </SettingsSectionBody>
                    </SettingsSection>
                </form>
            </Form>

            {build === "saas" && <AuthPageSettings ref={authPageSettingsRef} />}

            {/* Save Button */}
            <div className="flex justify-end">
                <Button
                    type="submit"
                    form="org-settings-form"
                    loading={loadingSave}
                    disabled={loadingSave}
                >
                    {t("saveGeneralSettings")}
                </Button>
            </div>

            {build !== "saas" && (
                <SettingsSection>
                    <SettingsSectionHeader>
                        <SettingsSectionTitle>
                            {t("orgDangerZone")}
                        </SettingsSectionTitle>
                        <SettingsSectionDescription>
                            {t("orgDangerZoneDescription")}
                        </SettingsSectionDescription>
                    </SettingsSectionHeader>
                    <SettingsSectionFooter>
                        <Button
                            variant="destructive"
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="flex items-center gap-2"
                            loading={loadingDelete}
                            disabled={loadingDelete}
                        >
                            {t("orgDelete")}
                        </Button>
                    </SettingsSectionFooter>
                </SettingsSection>
            )}
        </SettingsContainer>
    );
}
