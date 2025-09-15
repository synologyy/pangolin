"use client";

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
import { Checkbox } from "@app/components/ui/checkbox";
import { toast } from "@app/hooks/useToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { InviteUserResponse } from "@server/routers/user";
import { AxiosResponse } from "axios";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ListRolesResponse } from "@server/routers/role";
import { userOrgUserContext } from "@app/hooks/useOrgUserContext";
import { useParams } from "next/navigation";
import { Button } from "@app/components/ui/button";
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
import { formatAxiosError } from "@app/lib/api";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useTranslations } from "next-intl";
import IdpTypeBadge from "@app/components/IdpTypeBadge";
import { UserType } from "@server/types/UserTypes";

export default function AccessControlsPage() {
    const { orgUser: user } = userOrgUserContext();

    const api = createApiClient(useEnvContext());

    const { orgId } = useParams();

    const [loading, setLoading] = useState(false);
    const [roles, setRoles] = useState<{ roleId: number; name: string }[]>([]);

    const t = useTranslations();

    const formSchema = z.object({
        username: z.string(),
        roleId: z.string().min(1, { message: t("accessRoleSelectPlease") }),
        autoProvisioned: z.boolean()
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: user.username!,
            roleId: user.roleId?.toString(),
            autoProvisioned: user.autoProvisioned || false
        }
    });

    useEffect(() => {
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

        fetchRoles();

        form.setValue("roleId", user.roleId.toString());
        form.setValue("autoProvisioned", user.autoProvisioned || false);
    }, []);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true);

        try {
            // Execute both API calls simultaneously
            const [roleRes, userRes] = await Promise.all([
                api.post<AxiosResponse<InviteUserResponse>>(
                    `/role/${values.roleId}/add/${user.userId}`
                ),
                api.post(`/org/${orgId}/user/${user.userId}`, {
                    autoProvisioned: values.autoProvisioned
                })
            ]);

            if (roleRes.status === 200 && userRes.status === 200) {
                toast({
                    variant: "default",
                    title: t("userSaved"),
                    description: t("userSavedDescription")
                });
            }
        } catch (e) {
            toast({
                variant: "destructive",
                title: t("accessRoleErrorAdd"),
                description: formatAxiosError(
                    e,
                    t("accessRoleErrorAddDescription")
                )
            });
        }

        setLoading(false);
    }

    return (
        <SettingsContainer>
            <SettingsSection>
                <SettingsSectionHeader>
                    <SettingsSectionTitle>
                        {t("accessControls")}
                    </SettingsSectionTitle>
                    <SettingsSectionDescription>
                        {t("accessControlsDescription")}
                    </SettingsSectionDescription>
                </SettingsSectionHeader>

                <SettingsSectionBody>
                    <SettingsSectionForm>
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit)}
                                className="space-y-4"
                                id="access-controls-form"
                            >
                                {/* IDP Type Display */}
                                {user.type !== UserType.Internal &&
                                    user.idpType && (
                                        <div className="flex items-center space-x-2 mb-4">
                                            <span className="text-sm font-medium text-muted-foreground">
                                                {t("idp")}:
                                            </span>
                                            <IdpTypeBadge
                                                type={user.idpType}
                                                variant={
                                                    user.idpVariant || undefined
                                                }
                                                name={user.idpName || undefined}
                                            />
                                        </div>
                                    )}

                                <FormField
                                    control={form.control}
                                    name="roleId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("role")}</FormLabel>
                                            <Select
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                    // If auto provision is enabled, set it to false when role changes
                                                    if (user.idpAutoProvision) {
                                                        form.setValue(
                                                            "autoProvisioned",
                                                            false
                                                        );
                                                    }
                                                }}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue
                                                            placeholder={t(
                                                                "accessRoleSelect"
                                                            )}
                                                        />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {roles.map((role) => (
                                                        <SelectItem
                                                            key={role.roleId}
                                                            value={role.roleId.toString()}
                                                        >
                                                            {role.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {user.idpAutoProvision && (
                                    <FormField
                                        control={form.control}
                                        name="autoProvisioned"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={
                                                            field.onChange
                                                        }
                                                    />
                                                </FormControl>
                                                <div className="space-y-1 leading-none">
                                                    <FormLabel>
                                                        {t("autoProvisioned")}
                                                    </FormLabel>
                                                    <p className="text-sm text-muted-foreground">
                                                        {t(
                                                            "autoProvisionedDescription"
                                                        )}
                                                    </p>
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </form>
                        </Form>
                    </SettingsSectionForm>
                </SettingsSectionBody>

                <SettingsSectionFooter>
                    <Button
                        type="submit"
                        loading={loading}
                        disabled={loading}
                        form="access-controls-form"
                    >
                        {t("accessControlsSubmit")}
                    </Button>
                </SettingsSectionFooter>
            </SettingsSection>
        </SettingsContainer>
    );
}
