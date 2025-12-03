"use client";

import {
    Credenza,
    CredenzaBody,
    CredenzaContent,
    CredenzaDescription,
    CredenzaFooter,
    CredenzaHeader,
    CredenzaTitle
} from "@app/components/Credenza";
import { Tag, TagInput } from "@app/components/tags/tag-input";
import { Button } from "@app/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@app/components/ui/command";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@app/components/ui/form";
import { Input } from "@app/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@app/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@app/components/ui/select";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { toast } from "@app/hooks/useToast";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { cn } from "@app/lib/cn";
import { orgQueries } from "@app/lib/queries";
import { zodResolver } from "@hookform/resolvers/zod";
import { ListClientsResponse } from "@server/routers/client/listClients";
import { ListSitesResponse } from "@server/routers/site";
import { ListUsersResponse } from "@server/routers/user";
import { UserType } from "@server/types/UserTypes";
import { useQuery } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type Site = ListSitesResponse["sites"][0];

type CreateInternalResourceDialogProps = {
    open: boolean;
    setOpen: (val: boolean) => void;
    orgId: string;
    sites: Site[];
    onSuccess?: () => void;
};

export default function CreateInternalResourceDialog({
    open,
    setOpen,
    orgId,
    sites,
    onSuccess
}: CreateInternalResourceDialogProps) {
    const t = useTranslations();
    const api = createApiClient(useEnvContext());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const formSchema = z.object({
        name: z
            .string()
            .min(1, t("createInternalResourceDialogNameRequired"))
            .max(255, t("createInternalResourceDialogNameMaxLength")),
        // mode: z.enum(["host", "cidr", "port"]),
        mode: z.enum(["host", "cidr"]),
        destination: z.string().min(1),
        siteId: z
            .int()
            .positive(t("createInternalResourceDialogPleaseSelectSite")),
        // protocol: z.enum(["tcp", "udp"]),
        // proxyPort: z.int()
        //     .positive()
        //     .min(1, t("createInternalResourceDialogProxyPortMin"))
        //     .max(65535, t("createInternalResourceDialogProxyPortMax")),
        // destinationPort: z.int()
        //     .positive()
        //     .min(1, t("createInternalResourceDialogDestinationPortMin"))
        //     .max(65535, t("createInternalResourceDialogDestinationPortMax"))
        //     .nullish(),
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
    //         error: t("createInternalResourceDialogProtocol") + " is required for port mode",
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
    //         error: t("createInternalResourceDialogSitePort") + " is required for port mode",
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
    //         error: t("targetPort") + " is required for port mode",
    //         path: ["destinationPort"]
    //     }
    // );

    type FormData = z.infer<typeof formSchema>;

    const { data: rolesResponse = [] } = useQuery(orgQueries.roles({ orgId }));
    const { data: usersResponse = [] } = useQuery(orgQueries.users({ orgId }));
    const { data: clientsResponse = [] } = useQuery(
        orgQueries.clients({
            orgId,
            filters: {
                filter: "machine"
            }
        })
    );

    const allRoles = rolesResponse
        .map((role) => ({
            id: role.roleId.toString(),
            text: role.name
        }))
        .filter((role) => role.text !== "Admin");

    const allUsers = usersResponse.map((user) => ({
        id: user.id.toString(),
        text: `${user.email || user.username}${user.type !== UserType.Internal ? ` (${user.idpName})` : ""}`
    }));

    const allClients = clientsResponse
        .filter((client) => !client.userId)
        .map((client) => ({
            id: client.clientId.toString(),
            text: client.name
        }));

    const hasMachineClients = allClients.length > 0;

    const [activeRolesTagIndex, setActiveRolesTagIndex] = useState<
        number | null
    >(null);
    const [activeUsersTagIndex, setActiveUsersTagIndex] = useState<
        number | null
    >(null);
    const [activeClientsTagIndex, setActiveClientsTagIndex] = useState<
        number | null
    >(null);

    const availableSites = sites.filter(
        (site) => site.type === "newt" && site.subnet
    );

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            siteId: availableSites[0]?.siteId || 0,
            mode: "host",
            // protocol: "tcp",
            // proxyPort: undefined,
            destination: "",
            // destinationPort: undefined,
            alias: "",
            roles: [],
            users: [],
            clients: []
        }
    });

    const mode = form.watch("mode");

    useEffect(() => {
        if (open && availableSites.length > 0) {
            form.reset({
                name: "",
                siteId: availableSites[0].siteId,
                mode: "host",
                // protocol: "tcp",
                // proxyPort: undefined,
                destination: "",
                // destinationPort: undefined,
                alias: "",
                roles: [],
                users: [],
                clients: []
            });
        }
    }, [open]);

    const handleSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            const response = await api.put<AxiosResponse<any>>(
                `/org/${orgId}/site/${data.siteId}/resource`,
                {
                    name: data.name,
                    mode: data.mode,
                    // protocol: data.protocol,
                    // proxyPort: data.mode === "port" ? data.proxyPort : undefined,
                    // destinationPort: data.mode === "port" ? data.destinationPort : undefined,
                    destination: data.destination,
                    enabled: true,
                    alias:
                        data.alias &&
                        typeof data.alias === "string" &&
                        data.alias.trim()
                            ? data.alias
                            : undefined,
                    roleIds: data.roles
                        ? data.roles.map((r) => parseInt(r.id))
                        : [],
                    userIds: data.users ? data.users.map((u) => u.id) : [],
                    clientIds: data.clients
                        ? data.clients.map((c) => parseInt(c.id))
                        : []
                }
            );

            const siteResourceId = response.data.data.siteResourceId;

            // // Set roles and users if provided
            // if (data.roles && data.roles.length > 0) {
            //     await api.post(`/site-resource/${siteResourceId}/roles`, {
            //         roleIds: data.roles.map((r) => parseInt(r.id))
            //     });
            // }

            // if (data.users && data.users.length > 0) {
            //     await api.post(`/site-resource/${siteResourceId}/users`, {
            //         userIds: data.users.map((u) => u.id)
            //     });
            // }

            // if (data.clients && data.clients.length > 0) {
            //     await api.post(`/site-resource/${siteResourceId}/clients`, {
            //         clientIds: data.clients.map((c) => parseInt(c.id))
            //     });
            // }

            toast({
                title: t("createInternalResourceDialogSuccess"),
                description: t(
                    "createInternalResourceDialogInternalResourceCreatedSuccessfully"
                ),
                variant: "default"
            });

            onSuccess?.();
            setOpen(false);
        } catch (error) {
            console.error("Error creating internal resource:", error);
            toast({
                title: t("createInternalResourceDialogError"),
                description: formatAxiosError(
                    error,
                    t(
                        "createInternalResourceDialogFailedToCreateInternalResource"
                    )
                ),
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (availableSites.length === 0) {
        return (
            <Credenza open={open} onOpenChange={setOpen}>
                <CredenzaContent className="max-w-md">
                    <CredenzaHeader>
                        <CredenzaTitle>
                            {t("createInternalResourceDialogNoSitesAvailable")}
                        </CredenzaTitle>
                        <CredenzaDescription>
                            {t(
                                "createInternalResourceDialogNoSitesAvailableDescription"
                            )}
                        </CredenzaDescription>
                    </CredenzaHeader>
                    <CredenzaFooter>
                        <Button onClick={() => setOpen(false)}>
                            {t("createInternalResourceDialogClose")}
                        </Button>
                    </CredenzaFooter>
                </CredenzaContent>
            </Credenza>
        );
    }

    return (
        <Credenza open={open} onOpenChange={setOpen}>
            <CredenzaContent className="max-w-2xl">
                <CredenzaHeader>
                    <CredenzaTitle>
                        {t("createInternalResourceDialogCreateClientResource")}
                    </CredenzaTitle>
                    <CredenzaDescription>
                        {t(
                            "createInternalResourceDialogCreateClientResourceDescription"
                        )}
                    </CredenzaDescription>
                </CredenzaHeader>
                <CredenzaBody>
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(handleSubmit)}
                            className="space-y-6"
                            id="create-internal-resource-form"
                        >
                            {/* Resource Properties Form */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">
                                    {t(
                                        "createInternalResourceDialogResourceProperties"
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
                                                        "createInternalResourceDialogName"
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
                                        name="siteId"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>
                                                    {t(
                                                        "createInternalResourceDialogSite"
                                                    )}
                                                </FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                className={cn(
                                                                    "w-full justify-between",
                                                                    !field.value &&
                                                                        "text-muted-foreground"
                                                                )}
                                                            >
                                                                {field.value
                                                                    ? availableSites.find(
                                                                          (
                                                                              site
                                                                          ) =>
                                                                              site.siteId ===
                                                                              field.value
                                                                      )?.name
                                                                    : t(
                                                                          "createInternalResourceDialogSelectSite"
                                                                      )}
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-full p-0">
                                                        <Command>
                                                            <CommandInput
                                                                placeholder={t(
                                                                    "createInternalResourceDialogSearchSites"
                                                                )}
                                                            />
                                                            <CommandList>
                                                                <CommandEmpty>
                                                                    {t(
                                                                        "createInternalResourceDialogNoSitesFound"
                                                                    )}
                                                                </CommandEmpty>
                                                                <CommandGroup>
                                                                    {availableSites.map(
                                                                        (
                                                                            site
                                                                        ) => (
                                                                            <CommandItem
                                                                                key={
                                                                                    site.siteId
                                                                                }
                                                                                value={
                                                                                    site.name
                                                                                }
                                                                                onSelect={() => {
                                                                                    field.onChange(
                                                                                        site.siteId
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-4 w-4",
                                                                                        field.value ===
                                                                                            site.siteId
                                                                                            ? "opacity-100"
                                                                                            : "opacity-0"
                                                                                    )}
                                                                                />
                                                                                {
                                                                                    site.name
                                                                                }
                                                                            </CommandItem>
                                                                        )
                                                                    )}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
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
                                                        "createInternalResourceDialogMode"
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
                                                        {/* <SelectItem value="port">{t("createInternalResourceDialogModePort")}</SelectItem> */}
                                                        <SelectItem value="host">
                                                            {t(
                                                                "createInternalResourceDialogModeHost"
                                                            )}
                                                        </SelectItem>
                                                        <SelectItem value="cidr">
                                                            {t(
                                                                "createInternalResourceDialogModeCidr"
                                                            )}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {/* 
                                    {mode === "port" && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="protocol"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                {t("createInternalResourceDialogProtocol")}
                                                            </FormLabel>
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
                                                                    <SelectItem value="tcp">
                                                                        {t("createInternalResourceDialogTcp")}
                                                                    </SelectItem>
                                                                    <SelectItem value="udp">
                                                                        {t("createInternalResourceDialogUdp")}
                                                                    </SelectItem>
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
                                                            <FormLabel>{t("createInternalResourceDialogSitePort")}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    value={field.value || ""}
                                                                    onChange={(e) =>
                                                                        field.onChange(
                                                                            e.target.value === "" ? undefined : parseInt(e.target.value)
                                                                        )
                                                                    }
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </>
                                    )} */}
                                </div>
                            </div>

                            {/* Target Configuration Form */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">
                                    {t(
                                        "createInternalResourceDialogTargetConfiguration"
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
                                                        "createInternalResourceDialogDestination"
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    {mode === "host" &&
                                                        t(
                                                            "createInternalResourceDialogDestinationHostDescription"
                                                        )}
                                                    {mode === "cidr" &&
                                                        t(
                                                            "createInternalResourceDialogDestinationCidrDescription"
                                                        )}
                                                    {/* {mode === "port" && t("createInternalResourceDialogDestinationIPDescription")} */}
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
                                                    <FormLabel>
                                                        {t("targetPort")}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            value={field.value || ""}
                                                            onChange={(e) =>
                                                                field.onChange(
                                                                    e.target.value === "" ? undefined : parseInt(e.target.value)
                                                                )
                                                            }
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t("createInternalResourceDialogDestinationPortDescription")}
                                                    </FormDescription>
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
                                                        "createInternalResourceDialogAlias"
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
                                                        "createInternalResourceDialogAliasDescription"
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
                                                        setTags={(newRoles) => {
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
                                                        allowDuplicates={false}
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
                                                        setTags={(newUsers) => {
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
                                                        allowDuplicates={false}
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
                                                                allClients
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
                        {t("createInternalResourceDialogCancel")}
                    </Button>
                    <Button
                        type="submit"
                        form="create-internal-resource-form"
                        disabled={isSubmitting}
                        loading={isSubmitting}
                    >
                        {t("createInternalResourceDialogCreateResource")}
                    </Button>
                </CredenzaFooter>
            </CredenzaContent>
        </Credenza>
    );
}
