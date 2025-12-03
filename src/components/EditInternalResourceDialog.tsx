"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@app/components/ui/button";
import { Input } from "@app/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@app/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@app/components/ui/form";
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
import { toast } from "@app/hooks/useToast";
import { useTranslations } from "next-intl";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { ListRolesResponse } from "@server/routers/role";
import { ListUsersResponse } from "@server/routers/user";
import { ListSiteResourceRolesResponse } from "@server/routers/siteResource/listSiteResourceRoles";
import { ListSiteResourceUsersResponse } from "@server/routers/siteResource/listSiteResourceUsers";
import { ListSiteResourceClientsResponse } from "@server/routers/siteResource/listSiteResourceClients";
import { ListClientsResponse } from "@server/routers/client/listClients";
import { Tag, TagInput } from "@app/components/tags/tag-input";
import { AxiosResponse } from "axios";
import { UserType } from "@server/types/UserTypes";
import { useQueries, useQuery } from "@tanstack/react-query";
import { orgQueries, resourceQueries } from "@app/lib/queries";

type InternalResourceData = {
    id: number;
    name: string;
    orgId: string;
    siteName: string;
    // mode: "host" | "cidr" | "port";
    mode: "host" | "cidr";
    // protocol: string | null;
    // proxyPort: number | null;
    siteId: number;
    destination: string;
    // destinationPort?: number | null;
    alias?: string | null;
};

type EditInternalResourceDialogProps = {
    open: boolean;
    setOpen: (val: boolean) => void;
    resource: InternalResourceData;
    orgId: string;
    onSuccess?: () => void;
};

export default function EditInternalResourceDialog({
    open,
    setOpen,
    resource,
    orgId,
    onSuccess
}: EditInternalResourceDialogProps) {
    const t = useTranslations();
    const api = createApiClient(useEnvContext());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const formSchema = z.object({
        name: z
            .string()
            .min(1, t("editInternalResourceDialogNameRequired"))
            .max(255, t("editInternalResourceDialogNameMaxLength")),
        mode: z.enum(["host", "cidr", "port"]),
        // protocol: z.enum(["tcp", "udp"]).nullish(),
        // proxyPort: z.int().positive().min(1, t("editInternalResourceDialogProxyPortMin")).max(65535, t("editInternalResourceDialogProxyPortMax")).nullish(),
        destination: z.string().min(1),
        // destinationPort: z.int().positive().min(1, t("editInternalResourceDialogDestinationPortMin")).max(65535, t("editInternalResourceDialogDestinationPortMax")).nullish(),
        alias: z.string().nullish(),
        roles: z
            .array(
                z.object({
                    id: z.string(),
                    text: z.string()
                })
            )
            .optional(),
        users: z
            .array(
                z.object({
                    id: z.string(),
                    text: z.string()
                })
            )
            .optional(),
        clients: z
            .array(
                z.object({
                    id: z.string(),
                    text: z.string()
                })
            )
            .optional()
    });
    // .refine(
    //     (data) => {
    //         if (data.mode === "port") {
    //             return data.protocol !== undefined && data.protocol !== null;
    //         }
    //         return true;
    //     },
    //     {
    //         message: t("editInternalResourceDialogProtocol") + " is required for port mode",
    //         path: ["protocol"]
    //     }
    // )
    // .refine(
    //     (data) => {
    //         if (data.mode === "port") {
    //             return data.proxyPort !== undefined && data.proxyPort !== null;
    //         }
    //         return true;
    //     },
    //     {
    //         message: t("editInternalResourceDialogSitePort") + " is required for port mode",
    //         path: ["proxyPort"]
    //     }
    // )
    // .refine(
    //     (data) => {
    //         if (data.mode === "port") {
    //             return data.destinationPort !== undefined && data.destinationPort !== null;
    //         }
    //         return true;
    //     },
    //     {
    //         message: t("targetPort") + " is required for port mode",
    //         path: ["destinationPort"]
    //     }
    // );

    type FormData = z.infer<typeof formSchema>;

    const queries = useQueries({
        queries: [
            orgQueries.roles({ orgId }),
            orgQueries.users({ orgId }),
            orgQueries.clients({
                orgId,
                filters: {
                    filter: "machine"
                }
            }),
            resourceQueries.resourceUsers({ resourceId: resource.id }),
            resourceQueries.resourceRoles({ resourceId: resource.id }),
            resourceQueries.resourceClients({ resourceId: resource.id })
        ]
    });

    const [
        rolesQuery,
        usersQuery,
        clientsQuery,
        resourceUsersQuery,
        resourceRolesQuery,
        resourceClientsQuery
    ] = queries;

    const allRoles = (rolesQuery.data ?? [])
        .map((role) => ({
            id: role.roleId.toString(),
            text: role.name
        }))
        .filter((role) => role.text !== "Admin");

    const allUsers = (usersQuery.data ?? []).map((user) => ({
        id: user.id.toString(),
        text: `${user.email || user.username}${user.type !== UserType.Internal ? ` (${user.idpName})` : ""}`
    }));

    const machineClients = (clientsQuery.data ?? [])
        .filter((client) => !client.userId)
        .map((client) => ({
            id: client.clientId.toString(),
            text: client.name
        }));

    const existingClients = (resourceClientsQuery.data ?? []).map(
        (c: { clientId: number; name: string }) => ({
            id: c.clientId.toString(),
            text: c.name
        })
    );

    const hasMachineClients =
        machineClients.length > 0 || existingClients.length > 0;

    const loadingRolesUsers = queries.some((query) => query.isLoading);

    const [activeRolesTagIndex, setActiveRolesTagIndex] = useState<
        number | null
    >(null);
    const [activeUsersTagIndex, setActiveUsersTagIndex] = useState<
        number | null
    >(null);
    const [activeClientsTagIndex, setActiveClientsTagIndex] = useState<
        number | null
    >(null);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: resource.name,
            mode: resource.mode || "host",
            // protocol: (resource.protocol as "tcp" | "udp" | null | undefined) ?? undefined,
            // proxyPort: resource.proxyPort ?? undefined,
            destination: resource.destination || "",
            // destinationPort: resource.destinationPort ?? undefined,
            alias: resource.alias ?? null,
            roles: [],
            users: [],
            clients: []
        }
    });

    const mode = form.watch("mode");

    const handleSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            // Update the site resource
            await api.post(
                `/org/${orgId}/site/${resource.siteId}/resource/${resource.id}`,
                {
                    name: data.name,
                    mode: data.mode,
                    // protocol: data.mode === "port" ? data.protocol : null,
                    // proxyPort: data.mode === "port" ? data.proxyPort : null,
                    // destinationPort: data.mode === "port" ? data.destinationPort : null,
                    destination: data.destination,
                    alias:
                        data.alias &&
                        typeof data.alias === "string" &&
                        data.alias.trim()
                            ? data.alias
                            : null,
                    roleIds: (data.roles || []).map((r) => parseInt(r.id)),
                    userIds: (data.users || []).map((u) => u.id),
                    clientIds: (data.clients || []).map((c) => parseInt(c.id))
                }
            );

            // Update roles, users, and clients
            // await Promise.all([
            //     api.post(`/site-resource/${resource.id}/roles`, {
            //         roleIds: (data.roles || []).map((r) => parseInt(r.id))
            //     }),
            //     api.post(`/site-resource/${resource.id}/users`, {
            //         userIds: (data.users || []).map((u) => u.id)
            //     }),
            //     api.post(`/site-resource/${resource.id}/clients`, {
            //         clientIds: (data.clients || []).map((c) => parseInt(c.id))
            //     })
            // ]);

            toast({
                title: t("editInternalResourceDialogSuccess"),
                description: t(
                    "editInternalResourceDialogInternalResourceUpdatedSuccessfully"
                ),
                variant: "default"
            });

            onSuccess?.();
            setOpen(false);
        } catch (error) {
            console.error("Error updating internal resource:", error);
            toast({
                title: t("editInternalResourceDialogError"),
                description: formatAxiosError(
                    error,
                    t(
                        "editInternalResourceDialogFailedToUpdateInternalResource"
                    )
                ),
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Set form values when data is loaded
    useEffect(() => {
        if (resourceRolesQuery.data) {
            form.setValue(
                "roles",
                resourceRolesQuery.data
                    .map((i) => ({
                        id: i.roleId.toString(),
                        text: i.name
                    }))
                    .filter((role) => role.text !== "Admin")
            );
        }
    }, [resourceRolesQuery.data, form]);

    useEffect(() => {
        if (resourceUsersQuery.data) {
            form.setValue(
                "users",
                resourceUsersQuery.data.map((i) => ({
                    id: i.userId.toString(),
                    text: `${i.email || i.username}${i.type !== UserType.Internal ? ` (${i.idpName})` : ""}`
                }))
            );
        }
    }, [resourceUsersQuery.data, form]);

    useEffect(() => {
        if (clientsQuery.data) {
            form.setValue("clients", existingClients);
        }
    }, [clientsQuery.data, existingClients, form]);

    return (
        <Credenza
            open={open}
            onOpenChange={(open) => {
                if (!open) {
                    // reset only on close
                    form.reset({
                        name: resource.name,
                        mode: resource.mode || "host",
                        // protocol: (resource.protocol as "tcp" | "udp" | null | undefined) ?? undefined,
                        // proxyPort: resource.proxyPort ?? undefined,
                        destination: resource.destination || "",
                        // destinationPort: resource.destinationPort ?? undefined,
                        alias: resource.alias ?? null,
                        roles: [],
                        users: [],
                        clients: []
                    });
                }
                setOpen(open);
            }}
        >
            <CredenzaContent className="max-w-2xl">
                <CredenzaHeader>
                    <CredenzaTitle>
                        {t("editInternalResourceDialogEditClientResource")}
                    </CredenzaTitle>
                    <CredenzaDescription>
                        {t(
                            "editInternalResourceDialogUpdateResourceProperties",
                            { resourceName: resource.name }
                        )}
                    </CredenzaDescription>
                </CredenzaHeader>
                <CredenzaBody>
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(handleSubmit)}
                            className="space-y-6"
                            id="edit-internal-resource-form"
                        >
                            {/* Resource Properties Form */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">
                                    {t(
                                        "editInternalResourceDialogResourceProperties"
                                    )}
                                </h3>
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "editInternalResourceDialogName"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="mode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "editInternalResourceDialogMode"
                                                    )}
                                                </FormLabel>
                                                <Select
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {/* <SelectItem value="port">{t("editInternalResourceDialogModePort")}</SelectItem> */}
                                                        <SelectItem value="host">
                                                            {t(
                                                                "editInternalResourceDialogModeHost"
                                                            )}
                                                        </SelectItem>
                                                        <SelectItem value="cidr">
                                                            {t(
                                                                "editInternalResourceDialogModeCidr"
                                                            )}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* {mode === "port" && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="protocol"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{t("editInternalResourceDialogProtocol")}</FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value ?? undefined}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="tcp">TCP</SelectItem>
                                                                <SelectItem value="udp">UDP</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="proxyPort"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{t("editInternalResourceDialogSitePort")}</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                value={field.value || ""}
                                                                onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value) || 0)}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )} */}
                                </div>
                            </div>

                            {/* Target Configuration Form */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">
                                    {t(
                                        "editInternalResourceDialogTargetConfiguration"
                                    )}
                                </h3>
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="destination"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "editInternalResourceDialogDestination"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    {mode === "host" &&
                                                        t(
                                                            "editInternalResourceDialogDestinationHostDescription"
                                                        )}
                                                    {mode === "cidr" &&
                                                        t(
                                                            "editInternalResourceDialogDestinationCidrDescription"
                                                        )}
                                                    {/* {mode === "port" && t("editInternalResourceDialogDestinationIPDescription")} */}
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* {mode === "port" && (
                                        <FormField
                                            control={form.control}
                                            name="destinationPort"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t("targetPort")}</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            value={field.value || ""}
                                                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value) || 0)}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )} */}
                                </div>
                            </div>

                            {/* Alias */}
                            {mode !== "cidr" && (
                                <div>
                                    <FormField
                                        control={form.control}
                                        name="alias"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        "editInternalResourceDialogAlias"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={
                                                            field.value ?? ""
                                                        }
                                                    />
                                                </FormControl>
                                                <FormDescription>
                                                    {t(
                                                        "editInternalResourceDialogAliasDescription"
                                                    )}
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}

                            {/* Access Control Section */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">
                                    {t("resourceUsersRoles")}
                                </h3>
                                {loadingRolesUsers ? (
                                    <div className="text-sm text-muted-foreground">
                                        {t("loading")}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
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
                                                                form.getValues()
                                                                    .roles || []
                                                            }
                                                            setTags={(
                                                                newRoles
                                                            ) => {
                                                                form.setValue(
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
                                            control={form.control}
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
                                                                form.getValues()
                                                                    .users || []
                                                            }
                                                            size="sm"
                                                            setTags={(
                                                                newUsers
                                                            ) => {
                                                                form.setValue(
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
                                        {hasMachineClients && (
                                            <FormField
                                                control={form.control}
                                                name="clients"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col items-start">
                                                        <FormLabel>
                                                            {t("clients")}
                                                        </FormLabel>
                                                        <FormControl>
                                                            <TagInput
                                                                {...field}
                                                                activeTagIndex={
                                                                    activeClientsTagIndex
                                                                }
                                                                setActiveTagIndex={
                                                                    setActiveClientsTagIndex
                                                                }
                                                                placeholder={
                                                                    t(
                                                                        "accessClientSelect"
                                                                    ) ||
                                                                    "Select machine clients"
                                                                }
                                                                size="sm"
                                                                tags={
                                                                    form.getValues()
                                                                        .clients ||
                                                                    []
                                                                }
                                                                setTags={(
                                                                    newClients
                                                                ) => {
                                                                    form.setValue(
                                                                        "clients",
                                                                        newClients as [
                                                                            Tag,
                                                                            ...Tag[]
                                                                        ]
                                                                    );
                                                                }}
                                                                enableAutocomplete={
                                                                    true
                                                                }
                                                                autocompleteOptions={
                                                                    machineClients
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
                                                                "resourceClientDescription"
                                                            ) ||
                                                                "Machine clients that can access this resource"}
                                                        </FormDescription>
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </form>
                    </Form>
                </CredenzaBody>
                <CredenzaFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={isSubmitting}
                    >
                        {t("editInternalResourceDialogCancel")}
                    </Button>
                    <Button
                        type="submit"
                        form="edit-internal-resource-form"
                        disabled={isSubmitting}
                        loading={isSubmitting}
                    >
                        {t("editInternalResourceDialogSaveResource")}
                    </Button>
                </CredenzaFooter>
            </CredenzaContent>
        </Credenza>
    );
}
