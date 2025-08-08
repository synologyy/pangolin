"use client";

import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionBody,
    SettingsSectionDescription,
    SettingsSectionForm,
    SettingsSectionHeader,
    SettingsSectionTitle
} from "@app/components/Settings";
import { StrategyOption, StrategySelect } from "@app/components/StrategySelect";
import HeaderTitle from "@app/components/SettingsSectionTitle";
import { Button } from "@app/components/ui/button";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@app/components/ui/form";
import { Input } from "@app/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@app/components/ui/select";
import { toast } from "@app/hooks/useToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { InviteUserBody, InviteUserResponse } from "@server/routers/user";
import { AxiosResponse } from "axios";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import CopyTextBox from "@app/components/CopyTextBox";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { ListRolesResponse } from "@server/routers/role";
import { formatAxiosError } from "@app/lib/api";
import { createApiClient } from "@app/lib/api";
import { Checkbox } from "@app/components/ui/checkbox";
import { ListIdpsResponse } from "@server/routers/idp";
import { useTranslations } from "next-intl";
import { build } from "@server/build";

type UserType = "internal" | "oidc";

interface IdpOption {
    idpId: number;
    name: string;
    type: string;
}

export default function Page() {
    const { orgId } = useParams();
    const router = useRouter();
    const { env } = useEnvContext();
    const api = createApiClient({ env });
    const t = useTranslations();

    const [userType, setUserType] = useState<UserType | null>("internal");
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [expiresInDays, setExpiresInDays] = useState(1);
    const [roles, setRoles] = useState<{ roleId: number; name: string }[]>([]);
    const [idps, setIdps] = useState<IdpOption[]>([]);
    const [sendEmail, setSendEmail] = useState(env.email.emailEnabled);
    const [selectedIdp, setSelectedIdp] = useState<IdpOption | null>(null);
    const [dataLoaded, setDataLoaded] = useState(false);

    const internalFormSchema = z.object({
        email: z.string().email({ message: t("emailInvalid") }),
        validForHours: z
            .string()
            .min(1, { message: t("inviteValidityDuration") }),
        roleId: z.string().min(1, { message: t("accessRoleSelectPlease") })
    });

    const externalFormSchema = z.object({
        username: z.string().min(1, { message: t("usernameRequired") }),
        email: z
            .string()
            .email({ message: t("emailInvalid") })
            .optional()
            .or(z.literal("")),
        name: z.string().optional(),
        roleId: z.string().min(1, { message: t("accessRoleSelectPlease") }),
        idpId: z.string().min(1, { message: t("idpSelectPlease") })
    });

    const formatIdpType = (type: string) => {
        switch (type.toLowerCase()) {
            case "oidc":
                return t("idpGenericOidc");
            default:
                return type;
        }
    };

    const validFor = [
        { hours: 24, name: t("day", { count: 1 }) },
        { hours: 48, name: t("day", { count: 2 }) },
        { hours: 72, name: t("day", { count: 3 }) },
        { hours: 96, name: t("day", { count: 4 }) },
        { hours: 120, name: t("day", { count: 5 }) },
        { hours: 144, name: t("day", { count: 6 }) },
        { hours: 168, name: t("day", { count: 7 }) }
    ];

    const internalForm = useForm<z.infer<typeof internalFormSchema>>({
        resolver: zodResolver(internalFormSchema),
        defaultValues: {
            email: "",
            validForHours: "72",
            roleId: ""
        }
    });

    const externalForm = useForm<z.infer<typeof externalFormSchema>>({
        resolver: zodResolver(externalFormSchema),
        defaultValues: {
            username: "",
            email: "",
            name: "",
            roleId: "",
            idpId: ""
        }
    });

    useEffect(() => {
        if (userType === "internal") {
            setSendEmail(env.email.emailEnabled);
            internalForm.reset();
            setInviteLink(null);
            setExpiresInDays(1);
        } else if (userType === "oidc") {
            externalForm.reset();
        }
    }, [userType, env.email.emailEnabled, internalForm, externalForm]);

    const [userTypes, setUserTypes] = useState<StrategyOption<string>[]>([
        {
            id: "internal",
            title: t("userTypeInternal"),
            description: t("userTypeInternalDescription"),
            disabled: false
        },
        {
            id: "oidc",
            title: t("userTypeExternal"),
            description: t("userTypeExternalDescription"),
            disabled: true
        }
    ]);

    useEffect(() => {
        if (!userType) {
            return;
        }

        async function fetchRoles() {
            const res = await api
                .get<AxiosResponse<ListRolesResponse>>(`/org/${orgId}/roles`)
                .catch((e) => {
                    console.error(e);
                    toast({
                        variant: "destructive",
                        title: t("accessRoleErrorFetch"),
                        description: formatAxiosError(
                            e,
                            t("accessRoleErrorFetchDescription")
                        )
                    });
                });

            if (res?.status === 200) {
                setRoles(res.data.data.roles);
            }
        }

        async function fetchIdps() {
            const res = await api
                .get<AxiosResponse<ListIdpsResponse>>("/idp")
                .catch((e) => {
                    console.error(e);
                    toast({
                        variant: "destructive",
                        title: t("idpErrorFetch"),
                        description: formatAxiosError(
                            e,
                            t("idpErrorFetchDescription")
                        )
                    });
                });

            if (res?.status === 200) {
                setIdps(res.data.data.idps);

                if (res.data.data.idps.length) {
                    setUserTypes((prev) =>
                        prev.map((type) => {
                            if (type.id === "oidc") {
                                return {
                                    ...type,
                                    disabled: false
                                };
                            }
                            return type;
                        })
                    );
                }
            }
        }

        async function fetchInitialData() {
            setDataLoaded(false);
            await fetchRoles();
            await fetchIdps();
            setDataLoaded(true);
        }

        fetchInitialData();
    }, []);

    async function onSubmitInternal(
        values: z.infer<typeof internalFormSchema>
    ) {
        setLoading(true);

        const res = await api
            .post<AxiosResponse<InviteUserResponse>>(
                `/org/${orgId}/create-invite`,
                {
                    email: values.email,
                    roleId: parseInt(values.roleId),
                    validHours: parseInt(values.validForHours),
                    sendEmail: sendEmail
                } as InviteUserBody
            )
            .catch((e) => {
                if (e.response?.status === 409) {
                    toast({
                        variant: "destructive",
                        title: t("userErrorExists"),
                        description: t("userErrorExistsDescription")
                    });
                } else {
                    toast({
                        variant: "destructive",
                        title: t("inviteError"),
                        description: formatAxiosError(
                            e,
                            t("inviteErrorDescription")
                        )
                    });
                }
            });

        if (res && res.status === 200) {
            setInviteLink(res.data.data.inviteLink);
            toast({
                variant: "default",
                title: t("userInvited"),
                description: t("userInvitedDescription")
            });

            setExpiresInDays(parseInt(values.validForHours) / 24);
        }

        setLoading(false);
    }

    async function onSubmitExternal(
        values: z.infer<typeof externalFormSchema>
    ) {
        setLoading(true);

        const res = await api
            .put(`/org/${orgId}/user`, {
                username: values.username,
                email: values.email,
                name: values.name,
                type: "oidc",
                idpId: parseInt(values.idpId),
                roleId: parseInt(values.roleId)
            })
            .catch((e) => {
                toast({
                    variant: "destructive",
                    title: t("userErrorCreate"),
                    description: formatAxiosError(
                        e,
                        t("userErrorCreateDescription")
                    )
                });
            });

        if (res && res.status === 201) {
            toast({
                variant: "default",
                title: t("userCreated"),
                description: t("userCreatedDescription")
            });
            router.push(`/${orgId}/settings/access/users`);
        }

        setLoading(false);
    }

    return (
        <>
            <div className="flex justify-between">
                <HeaderTitle
                    title={t("accessUserCreate")}
                    description={t("accessUserCreateDescription")}
                />
                <Button
                    variant="outline"
                    onClick={() => {
                        router.push(`/${orgId}/settings/access/users`);
                    }}
                >
                    {t("userSeeAll")}
                </Button>
            </div>

            <div>
                <SettingsContainer>
                    {!inviteLink && build !== "saas" ? (
                        <SettingsSection>
                            <SettingsSectionHeader>
                                <SettingsSectionTitle>
                                    {t("userTypeTitle")}
                                </SettingsSectionTitle>
                                <SettingsSectionDescription>
                                    {t("userTypeDescription")}
                                </SettingsSectionDescription>
                            </SettingsSectionHeader>
                            <SettingsSectionBody>
                                <StrategySelect
                                    options={userTypes}
                                    defaultValue={userType || undefined}
                                    onChange={(value) => {
                                        setUserType(value as UserType);
                                        if (value === "internal") {
                                            internalForm.reset();
                                        } else if (value === "oidc") {
                                            externalForm.reset();
                                            setSelectedIdp(null);
                                        }
                                    }}
                                    cols={2}
                                />
                            </SettingsSectionBody>
                        </SettingsSection>
                    ) : null}

                    {userType === "internal" && dataLoaded && (
                        <>
                            {!inviteLink ? (
                                <SettingsSection>
                                    <SettingsSectionHeader>
                                        <SettingsSectionTitle>
                                            {t("userSettings")}
                                        </SettingsSectionTitle>
                                        <SettingsSectionDescription>
                                            {t("userSettingsDescription")}
                                        </SettingsSectionDescription>
                                    </SettingsSectionHeader>
                                    <SettingsSectionBody>
                                        <SettingsSectionForm>
                                            <Form {...internalForm}>
                                                <form
                                                    onSubmit={internalForm.handleSubmit(
                                                        onSubmitInternal
                                                    )}
                                                    className="space-y-4"
                                                    id="create-user-form"
                                                >
                                                    <FormField
                                                        control={
                                                            internalForm.control
                                                        }
                                                        name="email"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    {t("email")}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={
                                                            internalForm.control
                                                        }
                                                        name="validForHours"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    {t(
                                                                        "inviteValid"
                                                                    )}
                                                                </FormLabel>
                                                                <Select
                                                                    onValueChange={
                                                                        field.onChange
                                                                    }
                                                                    defaultValue={
                                                                        field.value
                                                                    }
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger className="w-full">
                                                                            <SelectValue
                                                                                placeholder={t(
                                                                                    "selectDuration"
                                                                                )}
                                                                            />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {validFor.map(
                                                                            (
                                                                                option
                                                                            ) => (
                                                                                <SelectItem
                                                                                    key={
                                                                                        option.hours
                                                                                    }
                                                                                    value={option.hours.toString()}
                                                                                >
                                                                                    {
                                                                                        option.name
                                                                                    }
                                                                                </SelectItem>
                                                                            )
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={
                                                            internalForm.control
                                                        }
                                                        name="roleId"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    {t("role")}
                                                                </FormLabel>
                                                                <Select
                                                                    onValueChange={
                                                                        field.onChange
                                                                    }
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger className="w-full">
                                                                            <SelectValue
                                                                                placeholder={t(
                                                                                    "accessRoleSelect"
                                                                                )}
                                                                            />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {roles.map(
                                                                            (
                                                                                role
                                                                            ) => (
                                                                                <SelectItem
                                                                                    key={
                                                                                        role.roleId
                                                                                    }
                                                                                    value={role.roleId.toString()}
                                                                                >
                                                                                    {
                                                                                        role.name
                                                                                    }
                                                                                </SelectItem>
                                                                            )
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    {env.email.emailEnabled && (
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id="send-email"
                                                                checked={
                                                                    sendEmail
                                                                }
                                                                onCheckedChange={(
                                                                    e
                                                                ) =>
                                                                    setSendEmail(
                                                                        e as boolean
                                                                    )
                                                                }
                                                            />
                                                            <label
                                                                htmlFor="send-email"
                                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                            >
                                                                {t(
                                                                    "inviteEmailSent"
                                                                )}
                                                            </label>
                                                        </div>
                                                    )}
                                                </form>
                                            </Form>
                                        </SettingsSectionForm>
                                    </SettingsSectionBody>
                                </SettingsSection>
                            ) : (
                                <SettingsSection>
                                    <SettingsSectionHeader>
                                        <SettingsSectionTitle>
                                            {t("userInvited")}
                                        </SettingsSectionTitle>
                                        <SettingsSectionDescription>
                                            {sendEmail
                                                ? t(
                                                      "inviteEmailSentDescription"
                                                  )
                                                : t("inviteSentDescription")}
                                        </SettingsSectionDescription>
                                    </SettingsSectionHeader>
                                    <SettingsSectionBody>
                                        <div className="space-y-4">
                                            <p>
                                                {t("inviteExpiresIn", {
                                                    days: expiresInDays
                                                })}
                                            </p>
                                            <CopyTextBox
                                                text={inviteLink}
                                                wrapText={false}
                                            />
                                        </div>
                                    </SettingsSectionBody>
                                </SettingsSection>
                            )}
                        </>
                    )}

                    {userType !== "internal" && dataLoaded && (
                        <>
                            <SettingsSection>
                                <SettingsSectionHeader>
                                    <SettingsSectionTitle>
                                        {t("idpTitle")}
                                    </SettingsSectionTitle>
                                    <SettingsSectionDescription>
                                        {t("idpSelect")}
                                    </SettingsSectionDescription>
                                </SettingsSectionHeader>
                                <SettingsSectionBody>
                                    {idps.length === 0 ? (
                                        <p className="text-muted-foreground">
                                            {t("idpNotConfigured")}
                                        </p>
                                    ) : (
                                        <Form {...externalForm}>
                                            <FormField
                                                control={externalForm.control}
                                                name="idpId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <StrategySelect
                                                            options={idps.map(
                                                                (idp) => ({
                                                                    id: idp.idpId.toString(),
                                                                    title: idp.name,
                                                                    description:
                                                                        formatIdpType(
                                                                            idp.type
                                                                        )
                                                                })
                                                            )}
                                                            defaultValue={
                                                                field.value
                                                            }
                                                            onChange={(
                                                                value
                                                            ) => {
                                                                field.onChange(
                                                                    value
                                                                );
                                                                const idp =
                                                                    idps.find(
                                                                        (idp) =>
                                                                            idp.idpId.toString() ===
                                                                            value
                                                                    );
                                                                setSelectedIdp(
                                                                    idp || null
                                                                );
                                                            }}
                                                            cols={2}
                                                        />
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </Form>
                                    )}
                                </SettingsSectionBody>
                            </SettingsSection>

                            {idps.length > 0 && (
                                <SettingsSection>
                                    <SettingsSectionHeader>
                                        <SettingsSectionTitle>
                                            {t("userSettings")}
                                        </SettingsSectionTitle>
                                        <SettingsSectionDescription>
                                            {t("userSettingsDescription")}
                                        </SettingsSectionDescription>
                                    </SettingsSectionHeader>
                                    <SettingsSectionBody>
                                        <SettingsSectionForm>
                                            <Form {...externalForm}>
                                                <form
                                                    onSubmit={externalForm.handleSubmit(
                                                        onSubmitExternal
                                                    )}
                                                    className="space-y-4"
                                                    id="create-user-form"
                                                >
                                                    <FormField
                                                        control={
                                                            externalForm.control
                                                        }
                                                        name="username"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    {t(
                                                                        "username"
                                                                    )}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                                <p className="text-sm text-muted-foreground mt-1">
                                                                    {t(
                                                                        "usernameUniq"
                                                                    )}
                                                                </p>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={
                                                            externalForm.control
                                                        }
                                                        name="email"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    {t(
                                                                        "emailOptional"
                                                                    )}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={
                                                            externalForm.control
                                                        }
                                                        name="name"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    {t(
                                                                        "nameOptional"
                                                                    )}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={
                                                            externalForm.control
                                                        }
                                                        name="roleId"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    {t("role")}
                                                                </FormLabel>
                                                                <Select
                                                                    onValueChange={
                                                                        field.onChange
                                                                    }
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger className="w-full">
                                                                            <SelectValue
                                                                                placeholder={t(
                                                                                    "accessRoleSelect"
                                                                                )}
                                                                            />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {roles.map(
                                                                            (
                                                                                role
                                                                            ) => (
                                                                                <SelectItem
                                                                                    key={
                                                                                        role.roleId
                                                                                    }
                                                                                    value={role.roleId.toString()}
                                                                                >
                                                                                    {
                                                                                        role.name
                                                                                    }
                                                                                </SelectItem>
                                                                            )
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </form>
                                            </Form>
                                        </SettingsSectionForm>
                                    </SettingsSectionBody>
                                </SettingsSection>
                            )}
                        </>
                    )}
                </SettingsContainer>

                <div className="flex justify-end space-x-2 mt-8">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            router.push(`/${orgId}/settings/access/users`);
                        }}
                    >
                        {t("cancel")}
                    </Button>
                    {userType && dataLoaded && (
                        <Button
                            type={inviteLink ? "button" : "submit"}
                            form={inviteLink ? undefined : "create-user-form"}
                            loading={loading}
                            disabled={loading}
                            onClick={
                                inviteLink
                                    ? () =>
                                          router.push(
                                              `/${orgId}/settings/access/users`
                                          )
                                    : undefined
                            }
                        >
                            {inviteLink ? t("done") : t("accessUserCreate")}
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
}
