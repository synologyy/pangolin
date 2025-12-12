"use client";

import SetResourceHeaderAuthForm from "@app/components/SetResourceHeaderAuthForm";
import SetResourcePincodeForm from "@app/components/SetResourcePincodeForm";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionBody,
    SettingsSectionDescription,
    SettingsSectionFooter,
    SettingsSectionForm,
    SettingsSectionHeader,
    SettingsSectionTitle
} from "@app/components/Settings";
import { SwitchInput } from "@app/components/SwitchInput";
import { Tag, TagInput } from "@app/components/tags/tag-input";
import { Alert, AlertDescription, AlertTitle } from "@app/components/ui/alert";
import { Button } from "@app/components/ui/button";
import { CheckboxWithLabel } from "@app/components/ui/checkbox";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@app/components/ui/form";
import { InfoPopup } from "@app/components/ui/info-popup";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@app/components/ui/select";
import type { ResourceContextType } from "@app/contexts/resourceContext";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useOrgContext } from "@app/hooks/useOrgContext";
import { useResourceContext } from "@app/hooks/useResourceContext";
import { useSubscriptionStatusContext } from "@app/hooks/useSubscriptionStatusContext";
import { toast } from "@app/hooks/useToast";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { orgQueries, resourceQueries } from "@app/lib/queries";
import { zodResolver } from "@hookform/resolvers/zod";
import { build } from "@server/build";
import {
    GetResourceWhitelistResponse,
    ListResourceRolesResponse,
    ListResourceUsersResponse
} from "@server/routers/resource";
import { ListRolesResponse } from "@server/routers/role";
import { ListUsersResponse } from "@server/routers/user";
import { UserType } from "@server/types/UserTypes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import SetResourcePasswordForm from "components/SetResourcePasswordForm";
import type { text } from "express";
import { Binary, Bot, InfoIcon, Key } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
    useActionState,
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition
} from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const UsersRolesFormSchema = z.object({
    roles: z.array(
        z.object({
            id: z.string(),
            text: z.string()
        })
    ),
    users: z.array(
        z.object({
            id: z.string(),
            text: z.string()
        })
    )
});

const whitelistSchema = z.object({
    emails: z.array(
        z.object({
            id: z.string(),
            text: z.string()
        })
    )
});

export default function ResourceAuthenticationPage() {
    const { org } = useOrgContext();
    const { resource, updateResource, authInfo, updateAuthInfo } =
        useResourceContext();

    const { env } = useEnvContext();

    const api = createApiClient({ env });
    const router = useRouter();
    const t = useTranslations();

    const subscription = useSubscriptionStatusContext();

    const queryClient = useQueryClient();
    const { data: resourceRoles = [], isLoading: isLoadingResourceRoles } =
        useQuery(
            resourceQueries.resourceRoles({
                resourceId: resource.resourceId
            })
        );
    const { data: resourceUsers = [], isLoading: isLoadingResourceUsers } =
        useQuery(
            resourceQueries.resourceUsers({
                resourceId: resource.resourceId
            })
        );

    const { data: whitelist = [], isLoading: isLoadingWhiteList } = useQuery(
        resourceQueries.resourceWhitelist({
            resourceId: resource.resourceId
        })
    );

    const { data: orgRoles = [], isLoading: isLoadingOrgRoles } = useQuery(
        orgQueries.roles({
            orgId: org.org.orgId
        })
    );
    const { data: orgUsers = [], isLoading: isLoadingOrgUsers } = useQuery(
        orgQueries.users({
            orgId: org.org.orgId
        })
    );
    const { data: orgIdps = [], isLoading: isLoadingOrgIdps } = useQuery(
        orgQueries.identityProviders({
            orgId: org.org.orgId
        })
    );

    const pageLoading =
        isLoadingOrgRoles ||
        isLoadingOrgUsers ||
        isLoadingResourceRoles ||
        isLoadingResourceUsers ||
        isLoadingWhiteList ||
        isLoadingOrgIdps;

    const allRoles = useMemo(() => {
        return orgRoles
            .map((role) => ({
                id: role.roleId.toString(),
                text: role.name
            }))
            .filter((role) => role.text !== "Admin");
    }, [orgRoles]);

    const allUsers = useMemo(() => {
        return orgUsers.map((user) => ({
            id: user.id.toString(),
            text: `${user.email || user.username}${user.type !== UserType.Internal ? ` (${user.idpName})` : ""}`
        }));
    }, [orgUsers]);

    const allIdps = useMemo(() => {
        if (build === "saas") {
            if (subscription?.subscribed) {
                return orgIdps.map((idp) => ({
                    id: idp.idpId,
                    text: idp.name
                }));
            }
        } else {
            return orgIdps.map((idp) => ({
                id: idp.idpId,
                text: idp.name
            }));
        }
        return [];
    }, [orgIdps]);

    const [activeRolesTagIndex, setActiveRolesTagIndex] = useState<
        number | null
    >(null);
    const [activeUsersTagIndex, setActiveUsersTagIndex] = useState<
        number | null
    >(null);

    const [activeEmailTagIndex, setActiveEmailTagIndex] = useState<
        number | null
    >(null);

    const [ssoEnabled, setSsoEnabled] = useState(resource.sso);
    // const [blockAccess, setBlockAccess] = useState(resource.blockAccess);
    const [whitelistEnabled, setWhitelistEnabled] = useState(
        resource.emailWhitelistEnabled
    );

    const [autoLoginEnabled, setAutoLoginEnabled] = useState(
        resource.skipToIdpId !== null && resource.skipToIdpId !== undefined
    );
    const [selectedIdpId, setSelectedIdpId] = useState<number | null>(
        resource.skipToIdpId || null
    );

    const [loadingRemoveResourcePassword, setLoadingRemoveResourcePassword] =
        useState(false);
    const [loadingRemoveResourcePincode, setLoadingRemoveResourcePincode] =
        useState(false);
    const [
        loadingRemoveResourceHeaderAuth,
        setLoadingRemoveResourceHeaderAuth
    ] = useState(false);

    const [isSetPasswordOpen, setIsSetPasswordOpen] = useState(false);
    const [isSetPincodeOpen, setIsSetPincodeOpen] = useState(false);
    const [isSetHeaderAuthOpen, setIsSetHeaderAuthOpen] = useState(false);

    const usersRolesForm = useForm({
        resolver: zodResolver(UsersRolesFormSchema),
        defaultValues: { roles: [], users: [] }
    });

    const whitelistForm = useForm({
        resolver: zodResolver(whitelistSchema),
        defaultValues: { emails: [] }
    });

    const hasInitializedRef = useRef(false);

    useEffect(() => {
        if (!pageLoading || hasInitializedRef.current) return;

        usersRolesForm.setValue(
            "roles",
            resourceRoles
                .map((i) => ({
                    id: i.roleId.toString(),
                    text: i.name
                }))
                .filter((role) => role.text !== "Admin")
        );
        usersRolesForm.setValue(
            "users",
            resourceUsers.map((i) => ({
                id: i.userId.toString(),
                text: `${i.email || i.username}${i.type !== UserType.Internal ? ` (${i.idpName})` : ""}`
            }))
        );

        whitelistForm.setValue(
            "emails",
            whitelist.map((w) => ({
                id: w.email,
                text: w.email
            }))
        );
        if (autoLoginEnabled && !selectedIdpId && orgIdps.length > 0) {
            setSelectedIdpId(orgIdps[0].idpId);
        }
        hasInitializedRef.current = true;
    }, [
        pageLoading,
        resourceRoles,
        resourceUsers,
        whitelist,
        autoLoginEnabled,
        selectedIdpId,
        orgIdps
    ]);

    async function saveWhitelist() {
        try {
            await api.post(`/resource/${resource.resourceId}`, {
                emailWhitelistEnabled: whitelistEnabled
            });

            if (whitelistEnabled) {
                await api.post(`/resource/${resource.resourceId}/whitelist`, {
                    emails: whitelistForm.getValues().emails.map((i) => i.text)
                });
            }

            updateResource({
                emailWhitelistEnabled: whitelistEnabled
            });

            toast({
                title: t("resourceWhitelistSave"),
                description: t("resourceWhitelistSaveDescription")
            });
            router.refresh();
            await queryClient.invalidateQueries(
                resourceQueries.resourceWhitelist({
                    resourceId: resource.resourceId
                })
            );
        } catch (e) {
            console.error(e);
            toast({
                variant: "destructive",
                title: t("resourceErrorWhitelistSave"),
                description: formatAxiosError(
                    e,
                    t("resourceErrorWhitelistSaveDescription")
                )
            });
        }
    }

    const [, submitUserRolesForm, loadingSaveUsersRoles] = useActionState(
        onSubmitUsersRoles,
        null
    );

    async function onSubmitUsersRoles() {
        const isValid = usersRolesForm.trigger();
        if (!isValid) return;

        const data = usersRolesForm.getValues();

        try {
            // Validate that an IDP is selected if auto login is enabled
            if (autoLoginEnabled && !selectedIdpId) {
                toast({
                    variant: "destructive",
                    title: t("error"),
                    description: t("selectIdpRequired")
                });
                return;
            }

            const jobs = [
                api.post(`/resource/${resource.resourceId}/roles`, {
                    roleIds: data.roles.map((i) => parseInt(i.id))
                }),
                api.post(`/resource/${resource.resourceId}/users`, {
                    userIds: data.users.map((i) => i.id)
                }),
                api.post(`/resource/${resource.resourceId}`, {
                    sso: ssoEnabled,
                    skipToIdpId: autoLoginEnabled ? selectedIdpId : null
                })
            ];

            await Promise.all(jobs);

            updateResource({
                sso: ssoEnabled,
                skipToIdpId: autoLoginEnabled ? selectedIdpId : null
            });

            updateAuthInfo({
                sso: ssoEnabled
            });

            toast({
                title: t("resourceAuthSettingsSave"),
                description: t("resourceAuthSettingsSaveDescription")
            });
            router.refresh();
        } catch (e) {
            console.error(e);
            toast({
                variant: "destructive",
                title: t("resourceErrorUsersRolesSave"),
                description: formatAxiosError(
                    e,
                    t("resourceErrorUsersRolesSaveDescription")
                )
            });
        }
    }

    function removeResourcePassword() {
        setLoadingRemoveResourcePassword(true);

        api.post(`/resource/${resource.resourceId}/password`, {
            password: null
        })
            .then(() => {
                toast({
                    title: t("resourcePasswordRemove"),
                    description: t("resourcePasswordRemoveDescription")
                });

                updateAuthInfo({
                    password: false
                });
                router.refresh();
            })
            .catch((e) => {
                toast({
                    variant: "destructive",
                    title: t("resourceErrorPasswordRemove"),
                    description: formatAxiosError(
                        e,
                        t("resourceErrorPasswordRemoveDescription")
                    )
                });
            })
            .finally(() => setLoadingRemoveResourcePassword(false));
    }

    function removeResourcePincode() {
        setLoadingRemoveResourcePincode(true);

        api.post(`/resource/${resource.resourceId}/pincode`, {
            pincode: null
        })
            .then(() => {
                toast({
                    title: t("resourcePincodeRemove"),
                    description: t("resourcePincodeRemoveDescription")
                });

                updateAuthInfo({
                    pincode: false
                });
                router.refresh();
            })
            .catch((e) => {
                toast({
                    variant: "destructive",
                    title: t("resourceErrorPincodeRemove"),
                    description: formatAxiosError(
                        e,
                        t("resourceErrorPincodeRemoveDescription")
                    )
                });
            })
            .finally(() => setLoadingRemoveResourcePincode(false));
    }

    function removeResourceHeaderAuth() {
        setLoadingRemoveResourceHeaderAuth(true);

        api.post(`/resource/${resource.resourceId}/header-auth`, {
            user: null,
            password: null
        })
            .then(() => {
                toast({
                    title: t("resourceHeaderAuthRemove"),
                    description: t("resourceHeaderAuthRemoveDescription")
                });

                updateAuthInfo({
                    headerAuth: false
                });
                router.refresh();
            })
            .catch((e) => {
                toast({
                    variant: "destructive",
                    title: t("resourceErrorHeaderAuthRemove"),
                    description: formatAxiosError(
                        e,
                        t("resourceErrorHeaderAuthRemoveDescription")
                    )
                });
            })
            .finally(() => setLoadingRemoveResourceHeaderAuth(false));
    }

    if (pageLoading) {
        return <></>;
    }

    return (
        <>
            {isSetPasswordOpen && (
                <SetResourcePasswordForm
                    open={isSetPasswordOpen}
                    setOpen={setIsSetPasswordOpen}
                    resourceId={resource.resourceId}
                    onSetPassword={() => {
                        setIsSetPasswordOpen(false);
                        updateAuthInfo({
                            password: true
                        });
                    }}
                />
            )}

            {isSetPincodeOpen && (
                <SetResourcePincodeForm
                    open={isSetPincodeOpen}
                    setOpen={setIsSetPincodeOpen}
                    resourceId={resource.resourceId}
                    onSetPincode={() => {
                        setIsSetPincodeOpen(false);
                        updateAuthInfo({
                            pincode: true
                        });
                    }}
                />
            )}

            {isSetHeaderAuthOpen && (
                <SetResourceHeaderAuthForm
                    open={isSetHeaderAuthOpen}
                    setOpen={setIsSetHeaderAuthOpen}
                    resourceId={resource.resourceId}
                    onSetHeaderAuth={() => {
                        setIsSetHeaderAuthOpen(false);
                        updateAuthInfo({
                            headerAuth: true
                        });
                    }}
                />
            )}

            <SettingsContainer>
                <SettingsSection>
                    <SettingsSectionHeader>
                        <SettingsSectionTitle>
                            {t("resourceUsersRoles")}
                        </SettingsSectionTitle>
                        <SettingsSectionDescription>
                            {t("resourceUsersRolesDescription")}
                        </SettingsSectionDescription>
                    </SettingsSectionHeader>
                    <SettingsSectionBody>
                        <SettingsSectionForm>
                            <SwitchInput
                                id="sso-toggle"
                                label={t("ssoUse")}
                                defaultChecked={resource.sso}
                                onCheckedChange={(val) => setSsoEnabled(val)}
                            />

                            <Form {...usersRolesForm}>
                                <form
                                    action={submitUserRolesForm}
                                    id="users-roles-form"
                                    className="space-y-4"
                                >
                                    {ssoEnabled && (
                                        <>
                                            <FormField
                                                control={usersRolesForm.control}
                                                name="roles"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col items-start">
                                                        <FormLabel>
                                                            {t("roles")}
                                                        </FormLabel>
                                                        <FormControl>
                                                            <TagInput
                                                                {...field}
                                                                activeTagIndex={
                                                                    activeRolesTagIndex
                                                                }
                                                                setActiveTagIndex={
                                                                    setActiveRolesTagIndex
                                                                }
                                                                placeholder={t(
                                                                    "accessRoleSelect2"
                                                                )}
                                                                size="sm"
                                                                tags={
                                                                    usersRolesForm.getValues()
                                                                        .roles
                                                                }
                                                                setTags={(
                                                                    newRoles
                                                                ) => {
                                                                    usersRolesForm.setValue(
                                                                        "roles",
                                                                        newRoles as [
                                                                            Tag,
                                                                            ...Tag[]
                                                                        ]
                                                                    );
                                                                }}
                                                                enableAutocomplete={
                                                                    true
                                                                }
                                                                autocompleteOptions={
                                                                    allRoles
                                                                }
                                                                allowDuplicates={
                                                                    false
                                                                }
                                                                restrictTagsToAutocompleteOptions={
                                                                    true
                                                                }
                                                                sortTags={true}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                        <FormDescription>
                                                            {t(
                                                                "resourceRoleDescription"
                                                            )}
                                                        </FormDescription>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={usersRolesForm.control}
                                                name="users"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col items-start">
                                                        <FormLabel>
                                                            {t("users")}
                                                        </FormLabel>
                                                        <FormControl>
                                                            <TagInput
                                                                {...field}
                                                                activeTagIndex={
                                                                    activeUsersTagIndex
                                                                }
                                                                setActiveTagIndex={
                                                                    setActiveUsersTagIndex
                                                                }
                                                                placeholder={t(
                                                                    "accessUserSelect"
                                                                )}
                                                                tags={
                                                                    usersRolesForm.getValues()
                                                                        .users
                                                                }
                                                                size="sm"
                                                                setTags={(
                                                                    newUsers
                                                                ) => {
                                                                    usersRolesForm.setValue(
                                                                        "users",
                                                                        newUsers as [
                                                                            Tag,
                                                                            ...Tag[]
                                                                        ]
                                                                    );
                                                                }}
                                                                enableAutocomplete={
                                                                    true
                                                                }
                                                                autocompleteOptions={
                                                                    allUsers
                                                                }
                                                                allowDuplicates={
                                                                    false
                                                                }
                                                                restrictTagsToAutocompleteOptions={
                                                                    true
                                                                }
                                                                sortTags={true}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </>
                                    )}

                                    {ssoEnabled && allIdps.length > 0 && (
                                        <div className="mt-8">
                                            <div className="space-y-2 mb-3">
                                                <CheckboxWithLabel
                                                    label={t(
                                                        "autoLoginExternalIdp"
                                                    )}
                                                    checked={autoLoginEnabled}
                                                    onCheckedChange={(
                                                        checked
                                                    ) => {
                                                        setAutoLoginEnabled(
                                                            checked as boolean
                                                        );
                                                        if (
                                                            checked &&
                                                            allIdps.length > 0
                                                        ) {
                                                            setSelectedIdpId(
                                                                allIdps[0].id
                                                            );
                                                        } else {
                                                            setSelectedIdpId(
                                                                null
                                                            );
                                                        }
                                                    }}
                                                />
                                                <p className="text-sm text-muted-foreground">
                                                    {t(
                                                        "autoLoginExternalIdpDescription"
                                                    )}
                                                </p>
                                            </div>

                                            {autoLoginEnabled && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">
                                                        {t("selectIdp")}
                                                    </label>
                                                    <Select
                                                        onValueChange={(
                                                            value
                                                        ) =>
                                                            setSelectedIdpId(
                                                                parseInt(value)
                                                            )
                                                        }
                                                        value={
                                                            selectedIdpId
                                                                ? selectedIdpId.toString()
                                                                : undefined
                                                        }
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue
                                                                placeholder={t(
                                                                    "selectIdpPlaceholder"
                                                                )}
                                                            />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {allIdps.map(
                                                                (idp) => (
                                                                    <SelectItem
                                                                        key={
                                                                            idp.id
                                                                        }
                                                                        value={idp.id.toString()}
                                                                    >
                                                                        {
                                                                            idp.text
                                                                        }
                                                                    </SelectItem>
                                                                )
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </form>
                            </Form>
                        </SettingsSectionForm>
                    </SettingsSectionBody>
                    <SettingsSectionFooter>
                        <Button
                            type="submit"
                            loading={loadingSaveUsersRoles}
                            disabled={loadingSaveUsersRoles}
                            form="users-roles-form"
                        >
                            {t("resourceUsersRolesSubmit")}
                        </Button>
                    </SettingsSectionFooter>
                </SettingsSection>

                <SettingsSection>
                    <SettingsSectionHeader>
                        <SettingsSectionTitle>
                            {t("resourceAuthMethods")}
                        </SettingsSectionTitle>
                        <SettingsSectionDescription>
                            {t("resourceAuthMethodsDescriptions")}
                        </SettingsSectionDescription>
                    </SettingsSectionHeader>
                    <SettingsSectionBody>
                        <SettingsSectionForm>
                            {/* Password Protection */}
                            <div className="flex items-center justify-between border rounded-md p-2 mb-4">
                                <div
                                    className={`flex items-center ${!authInfo.password ? "text-muted-foreground" : "text-green-500"} text-sm space-x-2`}
                                >
                                    <Key size="14" />
                                    <span>
                                        {t("resourcePasswordProtection", {
                                            status: authInfo.password
                                                ? t("enabled")
                                                : t("disabled")
                                        })}
                                    </span>
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={
                                        authInfo.password
                                            ? removeResourcePassword
                                            : () => setIsSetPasswordOpen(true)
                                    }
                                    loading={loadingRemoveResourcePassword}
                                >
                                    {authInfo.password
                                        ? t("passwordRemove")
                                        : t("passwordAdd")}
                                </Button>
                            </div>

                            {/* PIN Code Protection */}
                            <div className="flex items-center justify-between border rounded-md p-2">
                                <div
                                    className={`flex items-center ${!authInfo.pincode ? "text-muted-foreground" : "text-green-500"} space-x-2 text-sm`}
                                >
                                    <Binary size="14" />
                                    <span>
                                        {t("resourcePincodeProtection", {
                                            status: authInfo.pincode
                                                ? t("enabled")
                                                : t("disabled")
                                        })}
                                    </span>
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={
                                        authInfo.pincode
                                            ? removeResourcePincode
                                            : () => setIsSetPincodeOpen(true)
                                    }
                                    loading={loadingRemoveResourcePincode}
                                >
                                    {authInfo.pincode
                                        ? t("pincodeRemove")
                                        : t("pincodeAdd")}
                                </Button>
                            </div>

                            {/* Header Authentication Protection */}
                            <div className="flex items-center justify-between border rounded-md p-2">
                                <div
                                    className={`flex items-center ${!authInfo.headerAuth ? "text-muted-foreground" : "text-green-500"} space-x-2 text-sm`}
                                >
                                    <Bot size="14" />
                                    <span>
                                        {authInfo.headerAuth
                                            ? t(
                                                  "resourceHeaderAuthProtectionEnabled"
                                              )
                                            : t(
                                                  "resourceHeaderAuthProtectionDisabled"
                                              )}
                                    </span>
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={
                                        authInfo.headerAuth
                                            ? removeResourceHeaderAuth
                                            : () => setIsSetHeaderAuthOpen(true)
                                    }
                                    loading={loadingRemoveResourceHeaderAuth}
                                >
                                    {authInfo.headerAuth
                                        ? t("headerAuthRemove")
                                        : t("headerAuthAdd")}
                                </Button>
                            </div>
                        </SettingsSectionForm>
                    </SettingsSectionBody>
                </SettingsSection>

                <OneTimePasswordFormSection
                    resource={resource}
                    updateResource={updateResource}
                />
            </SettingsContainer>
        </>
    );
}

type OneTimePasswordFormSectionProps = Pick<
    ResourceContextType,
    "resource" | "updateResource"
>;

function OneTimePasswordFormSection({
    resource,
    updateResource
}: OneTimePasswordFormSectionProps) {
    const { env } = useEnvContext();
    const [whitelistEnabled, setWhitelistEnabled] = useState(
        resource.emailWhitelistEnabled
    );
    const queryClient = useQueryClient();

    const [loadingSaveWhitelist, startTransition] = useTransition();
    const whitelistForm = useForm({
        resolver: zodResolver(whitelistSchema),
        defaultValues: { emails: [] }
    });
    const api = createApiClient({ env });
    const router = useRouter();
    const t = useTranslations();

    const [activeEmailTagIndex, setActiveEmailTagIndex] = useState<
        number | null
    >(null);

    async function saveWhitelist() {
        try {
            await api.post(`/resource/${resource.resourceId}`, {
                emailWhitelistEnabled: whitelistEnabled
            });

            if (whitelistEnabled) {
                await api.post(`/resource/${resource.resourceId}/whitelist`, {
                    emails: whitelistForm.getValues().emails.map((i) => i.text)
                });
            }

            updateResource({
                emailWhitelistEnabled: whitelistEnabled
            });

            toast({
                title: t("resourceWhitelistSave"),
                description: t("resourceWhitelistSaveDescription")
            });
            router.refresh();
            await queryClient.invalidateQueries(
                resourceQueries.resourceWhitelist({
                    resourceId: resource.resourceId
                })
            );
        } catch (e) {
            console.error(e);
            toast({
                variant: "destructive",
                title: t("resourceErrorWhitelistSave"),
                description: formatAxiosError(
                    e,
                    t("resourceErrorWhitelistSaveDescription")
                )
            });
        }
    }

    return (
        <SettingsSection>
            <SettingsSectionHeader>
                <SettingsSectionTitle>
                    {t("otpEmailTitle")}
                </SettingsSectionTitle>
                <SettingsSectionDescription>
                    {t("otpEmailTitleDescription")}
                </SettingsSectionDescription>
            </SettingsSectionHeader>
            <SettingsSectionBody>
                <SettingsSectionForm>
                    {!env.email.emailEnabled && (
                        <Alert variant="neutral" className="mb-4">
                            <InfoIcon className="h-4 w-4" />
                            <AlertTitle className="font-semibold">
                                {t("otpEmailSmtpRequired")}
                            </AlertTitle>
                            <AlertDescription>
                                {t("otpEmailSmtpRequiredDescription")}
                            </AlertDescription>
                        </Alert>
                    )}
                    <SwitchInput
                        id="whitelist-toggle"
                        label={t("otpEmailWhitelist")}
                        defaultChecked={resource.emailWhitelistEnabled}
                        onCheckedChange={setWhitelistEnabled}
                        disabled={!env.email.emailEnabled}
                    />

                    {whitelistEnabled && env.email.emailEnabled && (
                        <Form {...whitelistForm}>
                            <form id="whitelist-form">
                                <FormField
                                    control={whitelistForm.control}
                                    name="emails"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                <InfoPopup
                                                    text={t(
                                                        "otpEmailWhitelistList"
                                                    )}
                                                    info={t(
                                                        "otpEmailWhitelistListDescription"
                                                    )}
                                                />
                                            </FormLabel>
                                            <FormControl>
                                                {/* @ts-ignore */}
                                                <TagInput
                                                    {...field}
                                                    activeTagIndex={
                                                        activeEmailTagIndex
                                                    }
                                                    size={"sm"}
                                                    validateTag={(tag) => {
                                                        return z
                                                            .email()
                                                            .or(
                                                                z
                                                                    .string()
                                                                    .regex(
                                                                        /^\*@[\w.-]+\.[a-zA-Z]{2,}$/,
                                                                        {
                                                                            message:
                                                                                t(
                                                                                    "otpEmailErrorInvalid"
                                                                                )
                                                                        }
                                                                    )
                                                            )
                                                            .safeParse(tag)
                                                            .success;
                                                    }}
                                                    setActiveTagIndex={
                                                        setActiveEmailTagIndex
                                                    }
                                                    placeholder={t(
                                                        "otpEmailEnter"
                                                    )}
                                                    tags={
                                                        whitelistForm.getValues()
                                                            .emails
                                                    }
                                                    setTags={(newRoles) => {
                                                        whitelistForm.setValue(
                                                            "emails",
                                                            newRoles as [
                                                                Tag,
                                                                ...Tag[]
                                                            ]
                                                        );
                                                    }}
                                                    allowDuplicates={false}
                                                    sortTags={true}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                {t("otpEmailEnterDescription")}
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                            </form>
                        </Form>
                    )}
                </SettingsSectionForm>
            </SettingsSectionBody>
            <SettingsSectionFooter>
                <Button
                    onClick={() => startTransition(saveWhitelist)}
                    form="whitelist-form"
                    loading={loadingSaveWhitelist}
                    disabled={loadingSaveWhitelist}
                >
                    {t("otpEmailWhitelistSave")}
                </Button>
            </SettingsSectionFooter>
        </SettingsSection>
    );
}
