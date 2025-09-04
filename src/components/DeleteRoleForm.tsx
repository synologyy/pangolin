"use client";

import { Button } from "@app/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@app/components/ui/form";
import { toast } from "@app/hooks/useToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosResponse } from "axios";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
    Credenza,
    CredenzaBody,
    CredenzaClose,
    CredenzaContent,
    CredenzaDescription,
    CredenzaFooter,
    CredenzaHeader,
    CredenzaTitle
} from "@app/components/Credenza";
import { useOrgContext } from "@app/hooks/useOrgContext";
import { ListRolesResponse } from "@server/routers/role";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@app/components/ui/select";
import { RoleRow } from "@app/components/RolesTable";
import { formatAxiosError } from "@app/lib/api";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useTranslations } from "next-intl";

type CreateRoleFormProps = {
    open: boolean;
    roleToDelete: RoleRow;
    setOpen: (open: boolean) => void;
    afterDelete?: () => void;
};

export default function DeleteRoleForm({
    open,
    roleToDelete,
    setOpen,
    afterDelete
}: CreateRoleFormProps) {
    const { org } = useOrgContext();
    const t = useTranslations();

    const [loading, setLoading] = useState(false);
    const [roles, setRoles] = useState<ListRolesResponse["roles"]>([]);

    const api = createApiClient(useEnvContext());

    const formSchema = z.object({
        newRoleId: z.string({ message: t('accessRoleErrorNewRequired') })
    });

    useEffect(() => {
        async function fetchRoles() {
            const res = await api
                .get<
                    AxiosResponse<ListRolesResponse>
                >(`/org/${org?.org.orgId}/roles`)
                .catch((e) => {
                    console.error(e);
                    toast({
                        variant: "destructive",
                        title: t('accessRoleErrorFetch'),
                        description: formatAxiosError(
                            e,
                            t('accessRoleErrorFetchDescription')
                        )
                    });
                });

            if (res?.status === 200) {
                setRoles(
                    res.data.data.roles.filter(
                        (r) => r.roleId !== roleToDelete.roleId
                    )
                );
            }
        }

        fetchRoles();
    }, []);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            newRoleId: ""
        }
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true);

        const res = await api
            .delete(`/role/${roleToDelete.roleId}`, {
                data: {
                    roleId: values.newRoleId
                }
            })
            .catch((e) => {
                toast({
                    variant: "destructive",
                    title: t('accessRoleErrorRemove'),
                    description: formatAxiosError(
                        e,
                        t('accessRoleErrorRemoveDescription')
                    )
                });
            });

        if (res && res.status === 200) {
            toast({
                variant: "default",
                title: t('accessRoleRemoved'),
                description: t('accessRoleRemovedDescription')
            });

            if (open) {
                setOpen(false);
            }

            if (afterDelete) {
                afterDelete();
            }
        }

        setLoading(false);
    }

    return (
        <>
            <Credenza
                open={open}
                onOpenChange={(val) => {
                    setOpen(val);
                    setLoading(false);
                    form.reset();
                }}
            >
                <CredenzaContent>
                    <CredenzaHeader>
                        <CredenzaTitle>{t('accessRoleRemove')}</CredenzaTitle>
                        <CredenzaDescription>
                            {t('accessRoleRemoveDescription')}
                        </CredenzaDescription>
                    </CredenzaHeader>
                    <CredenzaBody>
                            <div className="space-y-4">
                                <p>
                                    {t('accessRoleQuestionRemove', {name: roleToDelete.name})}
                                </p>
                                <p>
                                    {t('accessRoleRequiredRemove')}
                                </p>
                            </div>
                            <Form {...form}>
                                <form
                                    onSubmit={form.handleSubmit(onSubmit)}
                                    className="space-y-4"
                                    id="remove-role-form"
                                >
                                    <FormField
                                        control={form.control}
                                        name="newRoleId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('role')}</FormLabel>
                                                <Select
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t('accessRoleSelect')} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {roles.map((role) => (
                                                            <SelectItem
                                                                key={
                                                                    role.roleId
                                                                }
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
                                </form>
                            </Form>
                    </CredenzaBody>
                    <CredenzaFooter>
                        <CredenzaClose asChild>
                            <Button variant="outline">{t('close')}</Button>
                        </CredenzaClose>
                        <Button
                            variant="destructive"
                            type="submit"
                            form="remove-role-form"
                            loading={loading}
                            disabled={loading}
                        >
                            {t('accessRoleRemoveSubmit')}
                        </Button>
                    </CredenzaFooter>
                </CredenzaContent>
            </Credenza>
        </>
    );
}
