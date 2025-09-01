"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AxiosResponse } from "axios";
import { ListTargetsResponse } from "@server/routers/target/listTargets";
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
import { CreateTargetResponse } from "@server/routers/target";
import {
    ColumnDef,
    getFilteredRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    getCoreRowModel,
    useReactTable,
    flexRender,
    Row
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@app/components/ui/table";
import { toast } from "@app/hooks/useToast";
import { useResourceContext } from "@app/hooks/useResourceContext";
import { ArrayElement } from "@server/types/ArrayElement";
import { formatAxiosError } from "@app/lib/api/formatAxiosError";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { createApiClient } from "@app/lib/api";
import { GetSiteResponse, ListSitesResponse } from "@server/routers/site";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionHeader,
    SettingsSectionTitle,
    SettingsSectionDescription,
    SettingsSectionBody,
    SettingsSectionForm
} from "@app/components/Settings";
import { SwitchInput } from "@app/components/SwitchInput";
import { useRouter } from "next/navigation";
import { isTargetValid } from "@server/lib/validators";
import { tlsNameSchema } from "@server/lib/schemas";
import {
    CheckIcon,
    ChevronsUpDown,
    Settings,
    Heart,
    Check,
    CircleCheck,
    CircleX
} from "lucide-react";
import { ContainersSelector } from "@app/components/ContainersSelector";
import { useTranslations } from "next-intl";
import { build } from "@server/build";
import { DockerManager, DockerState } from "@app/lib/docker";
import { Container } from "@server/routers/site";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@app/components/ui/popover";
import { cn } from "@app/lib/cn";
import { CaretSortIcon } from "@radix-ui/react-icons";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@app/components/ui/command";
import { Badge } from "@app/components/ui/badge";
import { parseHostTarget } from "@app/lib/parseHostTarget";

const addTargetSchema = z.object({
    ip: z.string().refine(isTargetValid),
    method: z.string().nullable(),
    port: z.coerce.number().int().positive(),
    siteId: z.number().int().positive()
});

const targetsSettingsSchema = z.object({
    stickySession: z.boolean()
});

type LocalTarget = Omit<
    ArrayElement<ListTargetsResponse["targets"]> & {
        new?: boolean;
        updated?: boolean;
        siteType: string | null;
    },
    "protocol"
>;

export default function ReverseProxyTargets(props: {
    params: Promise<{ resourceId: number; orgId: string }>;
}) {
    const params = use(props.params);
    const t = useTranslations();

    const { resource, updateResource } = useResourceContext();

    const api = createApiClient(useEnvContext());

    const [targets, setTargets] = useState<LocalTarget[]>([]);
    const [targetsToRemove, setTargetsToRemove] = useState<number[]>([]);
    const [sites, setSites] = useState<ListSitesResponse["sites"]>([]);
    const [dockerStates, setDockerStates] = useState<Map<number, DockerState>>(new Map());

    const initializeDockerForSite = async (siteId: number) => {
        if (dockerStates.has(siteId)) {
            return; // Already initialized
        }

        const dockerManager = new DockerManager(api, siteId);
        const dockerState = await dockerManager.initializeDocker();

        setDockerStates(prev => new Map(prev.set(siteId, dockerState)));
    };

    const refreshContainersForSite = async (siteId: number) => {
        const dockerManager = new DockerManager(api, siteId);
        const containers = await dockerManager.fetchContainers();

        setDockerStates(prev => {
            const newMap = new Map(prev);
            const existingState = newMap.get(siteId);
            if (existingState) {
                newMap.set(siteId, { ...existingState, containers });
            }
            return newMap;
        });
    };

    const getDockerStateForSite = (siteId: number): DockerState => {
        return dockerStates.get(siteId) || {
            isEnabled: false,
            isAvailable: false,
            containers: []
        };
    };

    const [httpsTlsLoading, setHttpsTlsLoading] = useState(false);
    const [targetsLoading, setTargetsLoading] = useState(false);
    const [proxySettingsLoading, setProxySettingsLoading] = useState(false);

    const [pageLoading, setPageLoading] = useState(true);
    const router = useRouter();

    const proxySettingsSchema = z.object({
        setHostHeader: z
            .string()
            .optional()
            .refine(
                (data) => {
                    if (data) {
                        return tlsNameSchema.safeParse(data).success;
                    }
                    return true;
                },
                {
                    message: t("proxyErrorInvalidHeader")
                }
            )
    });

    const tlsSettingsSchema = z.object({
        ssl: z.boolean(),
        tlsServerName: z
            .string()
            .optional()
            .refine(
                (data) => {
                    if (data) {
                        return tlsNameSchema.safeParse(data).success;
                    }
                    return true;
                },
                {
                    message: t("proxyErrorTls")
                }
            )
    });

    type ProxySettingsValues = z.infer<typeof proxySettingsSchema>;
    type TlsSettingsValues = z.infer<typeof tlsSettingsSchema>;
    type TargetsSettingsValues = z.infer<typeof targetsSettingsSchema>;

    const addTargetForm = useForm({
        resolver: zodResolver(addTargetSchema),
        defaultValues: {
            ip: "",
            method: resource.http ? "http" : null,
            port: "" as any as number
        } as z.infer<typeof addTargetSchema>
    });

    const watchedIp = addTargetForm.watch("ip");
    const watchedPort = addTargetForm.watch("port");
    const watchedSiteId = addTargetForm.watch("siteId");

    const handleContainerSelect = (hostname: string, port?: number) => {
        addTargetForm.setValue("ip", hostname);
        if (port) {
            addTargetForm.setValue("port", port);
        }
    };

    const tlsSettingsForm = useForm<TlsSettingsValues>({
        resolver: zodResolver(tlsSettingsSchema),
        defaultValues: {
            ssl: resource.ssl,
            tlsServerName: resource.tlsServerName || ""
        }
    });

    const proxySettingsForm = useForm<ProxySettingsValues>({
        resolver: zodResolver(proxySettingsSchema),
        defaultValues: {
            setHostHeader: resource.setHostHeader || ""
        }
    });

    const targetsSettingsForm = useForm<TargetsSettingsValues>({
        resolver: zodResolver(targetsSettingsSchema),
        defaultValues: {
            stickySession: resource.stickySession
        }
    });

    useEffect(() => {
        const fetchTargets = async () => {
            try {
                const res = await api.get<AxiosResponse<ListTargetsResponse>>(
                    `/resource/${params.resourceId}/targets`
                );

                if (res.status === 200) {
                    setTargets(res.data.data.targets);
                }
            } catch (err) {
                console.error(err);
                toast({
                    variant: "destructive",
                    title: t("targetErrorFetch"),
                    description: formatAxiosError(
                        err,
                        t("targetErrorFetchDescription")
                    )
                });
            } finally {
                setPageLoading(false);
            }
        };
        fetchTargets();

        const fetchSites = async () => {
            const res = await api
                .get<
                    AxiosResponse<ListSitesResponse>
                >(`/org/${params.orgId}/sites`)
                .catch((e) => {
                    toast({
                        variant: "destructive",
                        title: t("sitesErrorFetch"),
                        description: formatAxiosError(
                            e,
                            t("sitesErrorFetchDescription")
                        )
                    });
                });

            if (res?.status === 200) {
                setSites(res.data.data.sites);

                // Initialize Docker for newt sites
                const newtSites = res.data.data.sites.filter(site => site.type === "newt");
                for (const site of newtSites) {
                    initializeDockerForSite(site.siteId);
                }

                // If there's only one site, set it as the default in the form
                if (res.data.data.sites.length) {
                    addTargetForm.setValue(
                        "siteId",
                        res.data.data.sites[0].siteId
                    );
                }
            }
        };
        fetchSites();

        // const fetchSite = async () => {
        //     try {
        //         const res = await api.get<AxiosResponse<GetSiteResponse>>(
        //             `/site/${resource.siteId}`
        //         );
        //
        //         if (res.status === 200) {
        //             setSite(res.data.data);
        //         }
        //     } catch (err) {
        //         console.error(err);
        //         toast({
        //             variant: "destructive",
        //             title: t("siteErrorFetch"),
        //             description: formatAxiosError(
        //                 err,
        //                 t("siteErrorFetchDescription")
        //             )
        //         });
        //     }
        // };
        // fetchSite();
    }, []);

    async function addTarget(data: z.infer<typeof addTargetSchema>) {
        // Check if target with same IP, port and method already exists
        const isDuplicate = targets.some(
            (target) =>
                target.ip === data.ip &&
                target.port === data.port &&
                target.method === data.method &&
                target.siteId === data.siteId
        );

        if (isDuplicate) {
            toast({
                variant: "destructive",
                title: t("targetErrorDuplicate"),
                description: t("targetErrorDuplicateDescription")
            });
            return;
        }

        // if (site && site.type == "wireguard" && site.subnet) {
        //     // make sure that the target IP is within the site subnet
        //     const targetIp = data.ip;
        //     const subnet = site.subnet;
        //     try {
        //         if (!isIPInSubnet(targetIp, subnet)) {
        //             toast({
        //                 variant: "destructive",
        //                 title: t("targetWireGuardErrorInvalidIp"),
        //                 description: t(
        //                     "targetWireGuardErrorInvalidIpDescription"
        //                 )
        //             });
        //             return;
        //         }
        //     } catch (error) {
        //         console.error(error);
        //         toast({
        //             variant: "destructive",
        //             title: t("targetWireGuardErrorInvalidIp"),
        //             description: t("targetWireGuardErrorInvalidIpDescription")
        //         });
        //         return;
        //     }
        // }

        const site = sites.find((site) => site.siteId === data.siteId);

        const newTarget: LocalTarget = {
            ...data,
            siteType: site?.type || null,
            enabled: true,
            targetId: new Date().getTime(),
            new: true,
            resourceId: resource.resourceId
        };

        setTargets([...targets, newTarget]);
        addTargetForm.reset({
            ip: "",
            method: resource.http ? "http" : null,
            port: "" as any as number
        });
    }

    const removeTarget = (targetId: number) => {
        setTargets([
            ...targets.filter((target) => target.targetId !== targetId)
        ]);

        if (!targets.find((target) => target.targetId === targetId)?.new) {
            setTargetsToRemove([...targetsToRemove, targetId]);
        }
    };

    async function updateTarget(targetId: number, data: Partial<LocalTarget>) {
        const site = sites.find((site) => site.siteId === data.siteId);
        setTargets(
            targets.map((target) =>
                target.targetId === targetId
                    ? {
                        ...target,
                        ...data,
                        updated: true,
                        siteType: site?.type || null
                    }
                    : target
            )
        );
    }

    async function saveAllSettings() {
        try {
            setTargetsLoading(true);
            setHttpsTlsLoading(true);
            setProxySettingsLoading(true);

            // Save targets
            for (const target of targets) {
                const data = {
                    ip: target.ip,
                    port: target.port,
                    method: target.method,
                    enabled: target.enabled,
                    siteId: target.siteId
                };

                if (target.new) {
                    const res = await api.put<
                        AxiosResponse<CreateTargetResponse>
                    >(`/resource/${params.resourceId}/target`, data);
                    target.targetId = res.data.data.targetId;
                    target.new = false;
                } else if (target.updated) {
                    await api.post(`/target/${target.targetId}`, data);
                    target.updated = false;
                }
            }

            for (const targetId of targetsToRemove) {
                await api.delete(`/target/${targetId}`);
            }

            if (resource.http) {
                // Gather all settings
                const stickySessionData = targetsSettingsForm.getValues();
                const tlsData = tlsSettingsForm.getValues();
                const proxyData = proxySettingsForm.getValues();

                // Combine into one payload
                const payload = {
                    stickySession: stickySessionData.stickySession,
                    ssl: tlsData.ssl,
                    tlsServerName: tlsData.tlsServerName || null,
                    setHostHeader: proxyData.setHostHeader || null
                };

                // Single API call to update all settings
                await api.post(`/resource/${params.resourceId}`, payload);

                // Update local resource context
                updateResource({
                    ...resource,
                    stickySession: stickySessionData.stickySession,
                    ssl: tlsData.ssl,
                    tlsServerName: tlsData.tlsServerName || null,
                    setHostHeader: proxyData.setHostHeader || null
                });
            }

            toast({
                title: t("settingsUpdated"),
                description: t("settingsUpdatedDescription")
            });

            setTargetsToRemove([]);
            router.refresh();
        } catch (err) {
            console.error(err);
            toast({
                variant: "destructive",
                title: t("settingsErrorUpdate"),
                description: formatAxiosError(
                    err,
                    t("settingsErrorUpdateDescription")
                )
            });
        } finally {
            setTargetsLoading(false);
            setHttpsTlsLoading(false);
            setProxySettingsLoading(false);
        }
    }

    const columns: ColumnDef<LocalTarget>[] = [
        {
            accessorKey: "siteId",
            header: t("site"),
            cell: ({ row }) => {
                const selectedSite = sites.find(
                    (site) => site.siteId === row.original.siteId
                );

                const handleContainerSelectForTarget = (
                    hostname: string,
                    port?: number
                ) => {
                    updateTarget(row.original.targetId, {
                        ...row.original,
                        ip: hostname
                    });
                    if (port) {
                        updateTarget(row.original.targetId, {
                            ...row.original,
                            port: port
                        });
                    }
                };

                return (
                    <div className="flex gap-2 items-center">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                        "justify-between flex-1",
                                        !row.original.siteId &&
                                        "text-muted-foreground"
                                    )}
                                >
                                    {row.original.siteId
                                        ? selectedSite?.name
                                        : t("siteSelect")}
                                    <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0">
                                <Command>
                                    <CommandInput
                                        placeholder={t("siteSearch")}
                                    />
                                    <CommandList>
                                        <CommandEmpty>
                                            {t("siteNotFound")}
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {sites.map((site) => (
                                                <CommandItem
                                                    value={`${site.siteId}:${site.name}:${site.niceId}`}
                                                    key={site.siteId}
                                                    onSelect={() => {
                                                        updateTarget(
                                                            row.original
                                                                .targetId,
                                                            {
                                                                siteId: site.siteId
                                                            }
                                                        );
                                                    }}
                                                >
                                                    <CheckIcon
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            site.siteId ===
                                                                row.original
                                                                    .siteId
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                        )}
                                                    />
                                                    {site.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {selectedSite && selectedSite.type === "newt" && (() => {
                            const dockerState = getDockerStateForSite(selectedSite.siteId);
                            return (
                                <ContainersSelector
                                    site={selectedSite}
                                    containers={dockerState.containers}
                                    isAvailable={dockerState.isAvailable}
                                    onContainerSelect={handleContainerSelectForTarget}
                                    onRefresh={() => refreshContainersForSite(selectedSite.siteId)}
                                />
                            );
                        })()}
                    </div>
                );
            }
        },
        ...(resource.http
            ? [
                {
                    accessorKey: "method",
                    header: t("method"),
                    cell: ({ row }: { row: Row<LocalTarget> }) => (
                        <Select
                            defaultValue={row.original.method ?? ""}
                            onValueChange={(value) =>
                                updateTarget(row.original.targetId, {
                                    ...row.original,
                                    method: value
                                })
                            }
                        >
                            <SelectTrigger>
                                {row.original.method}
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="http">http</SelectItem>
                                <SelectItem value="https">https</SelectItem>
                                <SelectItem value="h2c">h2c</SelectItem>
                            </SelectContent>
                        </Select>
                    )
                }
            ]
            : []),
        {
            accessorKey: "ip",
            header: t("targetAddr"),
            cell: ({ row }) => (
                <Input
                    defaultValue={row.original.ip}
                    className="min-w-[150px]"
                    onBlur={(e) => {
                        const input = e.target.value.trim();
                        const hasProtocol = /^https?:\/\//.test(input);
                        const hasPort = /:\d+/.test(input);

                        if (hasProtocol || hasPort) {
                            const parsed = parseHostTarget(input);
                            if (parsed) {
                                updateTarget(row.original.targetId, {
                                    ...row.original,
                                    method: hasProtocol ? parsed.protocol : row.original.method,
                                    ip: parsed.host,
                                    port: hasPort ? parsed.port : row.original.port
                                });
                            } else {
                                updateTarget(row.original.targetId, {
                                    ...row.original,
                                    ip: input
                                });
                            }
                        } else {
                            updateTarget(row.original.targetId, {
                                ...row.original,
                                ip: input
                            });
                        }
                    }}

                />

            )
        },
        {
            accessorKey: "port",
            header: t("targetPort"),
            cell: ({ row }) => (
                <Input
                    type="number"
                    defaultValue={row.original.port}
                    className="min-w-[100px]"
                    onBlur={(e) =>
                        updateTarget(row.original.targetId, {
                            ...row.original,
                            port: parseInt(e.target.value, 10)
                        })
                    }
                />
            )
        },
        // {
        //     accessorKey: "protocol",
        //     header: t('targetProtocol'),
        //     cell: ({ row }) => (
        //         <Select
        //             defaultValue={row.original.protocol!}
        //             onValueChange={(value) =>
        //                 updateTarget(row.original.targetId, { protocol: value })
        //             }
        //         >
        //             <SelectTrigger>{row.original.protocol}</SelectTrigger>
        //             <SelectContent>
        //                 <SelectItem value="TCP">TCP</SelectItem>
        //                 <SelectItem value="UDP">UDP</SelectItem>
        //             </SelectContent>
        //         </Select>
        //     ),
        //         },
        {
            accessorKey: "enabled",
            header: t("enabled"),
            cell: ({ row }) => (
                <Switch
                    defaultChecked={row.original.enabled}
                    onCheckedChange={(val) =>
                        updateTarget(row.original.targetId, {
                            ...row.original,
                            enabled: val
                        })
                    }
                />
            )
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <>
                    <div className="flex items-center justify-end space-x-2">
                        {/* <Dot
                            className={
                                row.original.new || row.original.updated
                                    ? "opacity-100"
                                    : "opacity-0"
                            }
                        /> */}

                        <Button
                            variant="outline"
                            onClick={() => removeTarget(row.original.targetId)}
                        >
                            {t("delete")}
                        </Button>
                    </div>
                </>
            )
        }
    ];

    const table = useReactTable({
        data: targets,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            pagination: {
                pageIndex: 0,
                pageSize: 1000
            }
        }
    });

    if (pageLoading) {
        return <></>;
    }

    return (
        <SettingsContainer>
            <SettingsSection>
                <SettingsSectionHeader>
                    <SettingsSectionTitle>{t("targets")}</SettingsSectionTitle>
                    <SettingsSectionDescription>
                        {t("targetsDescription")}
                    </SettingsSectionDescription>
                </SettingsSectionHeader>
                <SettingsSectionBody>
                    <div className="p-4 border rounded-md">
                        <Form {...addTargetForm}>
                            <form
                                onSubmit={addTargetForm.handleSubmit(addTarget)}
                                className="space-y-4"
                            >
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-start">
                                    <FormField
                                        control={addTargetForm.control}
                                        name="siteId"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>
                                                    {t("site")}
                                                </FormLabel>
                                                <div className="flex gap-2">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    className={cn(
                                                                        "justify-between flex-1",
                                                                        !field.value &&
                                                                        "text-muted-foreground"
                                                                    )}
                                                                >
                                                                    {field.value
                                                                        ? sites.find(
                                                                            (
                                                                                site
                                                                            ) =>
                                                                                site.siteId ===
                                                                                field.value
                                                                        )
                                                                            ?.name
                                                                        : t(
                                                                            "siteSelect"
                                                                        )}
                                                                    <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="p-0">
                                                            <Command>
                                                                <CommandInput
                                                                    placeholder={t(
                                                                        "siteSearch"
                                                                    )}
                                                                />
                                                                <CommandList>
                                                                    <CommandEmpty>
                                                                        {t(
                                                                            "siteNotFound"
                                                                        )}
                                                                    </CommandEmpty>
                                                                    <CommandGroup>
                                                                        {sites.map(
                                                                            (
                                                                                site
                                                                            ) => (
                                                                                <CommandItem
                                                                                    value={`${site.siteId}:${site.name}:${site.niceId}`}
                                                                                    key={
                                                                                        site.siteId
                                                                                    }
                                                                                    onSelect={() => {
                                                                                        addTargetForm.setValue(
                                                                                            "siteId",
                                                                                            site.siteId
                                                                                        );
                                                                                    }}
                                                                                >
                                                                                    <CheckIcon
                                                                                        className={cn(
                                                                                            "mr-2 h-4 w-4",
                                                                                            site.siteId ===
                                                                                                field.value
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

                                                    {field.value &&
                                                        (() => {
                                                            const selectedSite =
                                                                sites.find(
                                                                    (site) =>
                                                                        site.siteId ===
                                                                        field.value
                                                                );
                                                            return selectedSite &&
                                                                selectedSite.type ===
                                                                "newt" ? (() => {
                                                                    const dockerState = getDockerStateForSite(selectedSite.siteId);
                                                                    return (
                                                                        <ContainersSelector
                                                                            site={selectedSite}
                                                                            containers={dockerState.containers}
                                                                            isAvailable={dockerState.isAvailable}
                                                                            onContainerSelect={handleContainerSelect}
                                                                            onRefresh={() => refreshContainersForSite(selectedSite.siteId)}
                                                                        />
                                                                    );
                                                                })() : null;
                                                        })()}
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {resource.http && (
                                        <FormField
                                            control={addTargetForm.control}
                                            name="method"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t("method")}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Select
                                                            value={
                                                                field.value ||
                                                                undefined
                                                            }
                                                            onValueChange={(
                                                                value
                                                            ) => {
                                                                addTargetForm.setValue(
                                                                    "method",
                                                                    value
                                                                );
                                                            }}
                                                        >
                                                            <SelectTrigger
                                                                id="method"
                                                                className="w-full"
                                                            >
                                                                <SelectValue
                                                                    placeholder={t(
                                                                        "methodSelect"
                                                                    )}
                                                                />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="http">
                                                                    http
                                                                </SelectItem>
                                                                <SelectItem value="https">
                                                                    https
                                                                </SelectItem>
                                                                <SelectItem value="h2c">
                                                                    h2c
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}

                                    <FormField
                                        control={addTargetForm.control}
                                        name="ip"
                                        render={({ field }) => (
                                            <FormItem className="relative">
                                                <FormLabel>{t("targetAddr")}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        id="ip"
                                                        {...field}
                                                        onBlur={(e) => {
                                                            const input = e.target.value.trim();
                                                            const hasProtocol = /^https?:\/\//.test(input);
                                                            const hasPort = /:\d+/.test(input);

                                                            if (hasProtocol || hasPort) {
                                                                const parsed = parseHostTarget(input);
                                                                if (parsed) {
                                                                    if (hasProtocol || !addTargetForm.getValues("method")) {
                                                                        addTargetForm.setValue("method", parsed.protocol);
                                                                    }
                                                                    addTargetForm.setValue("ip", parsed.host);
                                                                    if (hasPort || !addTargetForm.getValues("port")) {
                                                                        addTargetForm.setValue("port", parsed.port);
                                                                    }
                                                                }
                                                            } else {
                                                                field.onBlur();
                                                            }
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={addTargetForm.control}
                                        name="port"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t("targetPort")}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        id="port"
                                                        type="number"
                                                        {...field}
                                                        required
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button
                                        type="submit"
                                        variant="secondary"
                                        className="mt-6"
                                        disabled={!(watchedIp && watchedPort)}
                                    >
                                        {t("targetSubmit")}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>

                    {targets.length > 0 ? (
                        <>
                            <h6 className="font-semibold">
                                {t("targetsList")}
                            </h6>
                            <SettingsSectionForm>
                                <Form {...targetsSettingsForm}>
                                    <form
                                        onSubmit={targetsSettingsForm.handleSubmit(
                                            saveAllSettings
                                        )}
                                        className="space-y-4"
                                        id="targets-settings-form"
                                    >
                                        <FormField
                                            control={
                                                targetsSettingsForm.control
                                            }
                                            name="stickySession"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <SwitchInput
                                                            id="sticky-toggle"
                                                            label={t(
                                                                "targetStickySessions"
                                                            )}
                                                            description={t(
                                                                "targetStickySessionsDescription"
                                                            )}
                                                            defaultChecked={
                                                                field.value
                                                            }
                                                            onCheckedChange={(
                                                                val
                                                            ) => {
                                                                field.onChange(
                                                                    val
                                                                );
                                                            }}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </form>
                                </Form>
                            </SettingsSectionForm>
                            <div className="">
                                <Table>
                                    <TableHeader>
                                        {table
                                            .getHeaderGroups()
                                            .map((headerGroup) => (
                                                <TableRow key={headerGroup.id}>
                                                    {headerGroup.headers.map(
                                                        (header) => (
                                                            <TableHead
                                                                key={header.id}
                                                            >
                                                                {header.isPlaceholder
                                                                    ? null
                                                                    : flexRender(
                                                                        header
                                                                            .column
                                                                            .columnDef
                                                                            .header,
                                                                        header.getContext()
                                                                    )}
                                                            </TableHead>
                                                        )
                                                    )}
                                                </TableRow>
                                            ))}
                                    </TableHeader>
                                    <TableBody>
                                        {table.getRowModel().rows?.length ? (
                                            table
                                                .getRowModel()
                                                .rows.map((row) => (
                                                    <TableRow key={row.id}>
                                                        {row
                                                            .getVisibleCells()
                                                            .map((cell) => (
                                                                <TableCell
                                                                    key={
                                                                        cell.id
                                                                    }
                                                                >
                                                                    {flexRender(
                                                                        cell
                                                                            .column
                                                                            .columnDef
                                                                            .cell,
                                                                        cell.getContext()
                                                                    )}
                                                                </TableCell>
                                                            ))}
                                                    </TableRow>
                                                ))
                                        ) : (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={columns.length}
                                                    className="h-24 text-center"
                                                >
                                                    {t("targetNoOne")}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                    {/* <TableCaption> */}
                                    {/*     {t('targetNoOneDescription')} */}
                                    {/* </TableCaption> */}
                                </Table>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">
                                {t("targetNoOne")}
                            </p>
                        </div>
                    )}
                </SettingsSectionBody>
            </SettingsSection>

            {resource.http && (
                <SettingsSection>
                    <SettingsSectionHeader>
                        <SettingsSectionTitle>
                            {t("proxyAdditional")}
                        </SettingsSectionTitle>
                        <SettingsSectionDescription>
                            {t("proxyAdditionalDescription")}
                        </SettingsSectionDescription>
                    </SettingsSectionHeader>
                    <SettingsSectionBody>
                        <SettingsSectionForm>
                            <Form {...tlsSettingsForm}>
                                <form
                                    onSubmit={tlsSettingsForm.handleSubmit(
                                        saveAllSettings
                                    )}
                                    className="space-y-4"
                                    id="tls-settings-form"
                                >
                                    {build == "oss" && (
                                        <FormField
                                            control={tlsSettingsForm.control}
                                            name="ssl"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <SwitchInput
                                                            id="ssl-toggle"
                                                            label={t(
                                                                "proxyEnableSSL"
                                                            )}
                                                            defaultChecked={
                                                                field.value
                                                            }
                                                            onCheckedChange={(
                                                                val
                                                            ) => {
                                                                field.onChange(
                                                                    val
                                                                );
                                                            }}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                    <FormField
                                        control={tlsSettingsForm.control}
                                        name="tlsServerName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t("targetTlsSni")}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    {t(
                                                        "targetTlsSniDescription"
                                                    )}
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </form>
                            </Form>
                        </SettingsSectionForm>

                        <SettingsSectionForm>
                            <Form {...proxySettingsForm}>
                                <form
                                    onSubmit={proxySettingsForm.handleSubmit(
                                        saveAllSettings
                                    )}
                                    className="space-y-4"
                                    id="proxy-settings-form"
                                >
                                    <FormField
                                        control={proxySettingsForm.control}
                                        name="setHostHeader"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t("proxyCustomHeader")}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    {t(
                                                        "proxyCustomHeaderDescription"
                                                    )}
                                                </FormDescription>
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

            <div className="flex justify-end mt-6">
                <Button
                    onClick={saveAllSettings}
                    loading={
                        targetsLoading ||
                        httpsTlsLoading ||
                        proxySettingsLoading
                    }
                    disabled={
                        targetsLoading ||
                        httpsTlsLoading ||
                        proxySettingsLoading
                    }
                >
                    {t("saveSettings")}
                </Button>
            </div>
        </SettingsContainer>
    );
}

function isIPInSubnet(subnet: string, ip: string): boolean {
    // Split subnet into IP and mask parts
    const [subnetIP, maskBits] = subnet.split("/");
    const mask = parseInt(maskBits);

    if (mask < 0 || mask > 32) {
        throw new Error("subnetMaskErrorInvalid");
    }

    // Convert IP addresses to binary numbers
    const subnetNum = ipToNumber(subnetIP);
    const ipNum = ipToNumber(ip);

    // Calculate subnet mask
    const maskNum = mask === 32 ? -1 : ~((1 << (32 - mask)) - 1);

    // Check if the IP is in the subnet
    return (subnetNum & maskNum) === (ipNum & maskNum);
}

function ipToNumber(ip: string): number {
    // Validate IP address format
    const parts = ip.split(".");

    if (parts.length !== 4) {
        throw new Error("ipAddressErrorInvalidFormat");
    }

    // Convert IP octets to 32-bit number
    return parts.reduce((num, octet) => {
        const oct = parseInt(octet);
        if (isNaN(oct) || oct < 0 || oct > 255) {
            throw new Error("ipAddressErrorInvalidOctet");
        }
        return (num << 8) + oct;
    }, 0);
}
