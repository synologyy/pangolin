"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    flexRender
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCaption,
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
import { GetSiteResponse } from "@server/routers/site";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionHeader,
    SettingsSectionTitle,
    SettingsSectionDescription,
    SettingsSectionBody,
    SettingsSectionFooter,
    SettingsSectionForm,
    SettingsSectionGrid
} from "@app/components/Settings";
import { SwitchInput } from "@app/components/SwitchInput";
import { useRouter } from "next/navigation";
import { isTargetValid } from "@server/lib/validators";
import { tlsNameSchema } from "@server/lib/schemas";
import { ChevronsUpDown } from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@app/components/ui/collapsible";
import { ContainersSelector } from "@app/components/ContainersSelector";
import { useTranslations } from "next-intl";
import { build } from "@server/build";

const addTargetSchema = z.object({
    ip: z.string().refine(isTargetValid),
    method: z.string().nullable(),
    port: z.coerce.number().int().positive()
});

const targetsSettingsSchema = z.object({
    stickySession: z.boolean()
});

type LocalTarget = Omit<
    ArrayElement<ListTargetsResponse["targets"]> & {
        new?: boolean;
        updated?: boolean;
    },
    "protocol"
>;

export default function ReverseProxyTargets(props: {
    params: Promise<{ resourceId: number }>;
}) {
    const params = use(props.params);
    const t = useTranslations();

    const { resource, updateResource } = useResourceContext();

    const api = createApiClient(useEnvContext());

    const [targets, setTargets] = useState<LocalTarget[]>([]);
    const [site, setSite] = useState<GetSiteResponse>();
    const [targetsToRemove, setTargetsToRemove] = useState<number[]>([]);

    const [httpsTlsLoading, setHttpsTlsLoading] = useState(false);
    const [targetsLoading, setTargetsLoading] = useState(false);
    const [proxySettingsLoading, setProxySettingsLoading] = useState(false);

    const [pageLoading, setPageLoading] = useState(true);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
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

        const fetchSite = async () => {
            try {
                const res = await api.get<AxiosResponse<GetSiteResponse>>(
                    `/site/${resource.siteId}`
                );

                if (res.status === 200) {
                    setSite(res.data.data);
                }
            } catch (err) {
                console.error(err);
                toast({
                    variant: "destructive",
                    title: t("siteErrorFetch"),
                    description: formatAxiosError(
                        err,
                        t("siteErrorFetchDescription")
                    )
                });
            }
        };
        fetchSite();
    }, []);

    async function addTarget(data: z.infer<typeof addTargetSchema>) {
        // Check if target with same IP, port and method already exists
        const isDuplicate = targets.some(
            (target) =>
                target.ip === data.ip &&
                target.port === data.port &&
                target.method === data.method
        );

        if (isDuplicate) {
            toast({
                variant: "destructive",
                title: t("targetErrorDuplicate"),
                description: t("targetErrorDuplicateDescription")
            });
            return;
        }

        if (site && site.type == "wireguard" && site.subnet) {
            // make sure that the target IP is within the site subnet
            const targetIp = data.ip;
            const subnet = site.subnet;
            try {
                if (!isIPInSubnet(targetIp, subnet)) {
                    toast({
                        variant: "destructive",
                        title: t("targetWireGuardErrorInvalidIp"),
                        description: t(
                            "targetWireGuardErrorInvalidIpDescription"
                        )
                    });
                    return;
                }
            } catch (error) {
                console.error(error);
                toast({
                    variant: "destructive",
                    title: t("targetWireGuardErrorInvalidIp"),
                    description: t("targetWireGuardErrorInvalidIpDescription")
                });
                return;
            }
        }

        const newTarget: LocalTarget = {
            ...data,
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
        setTargets(
            targets.map((target) =>
                target.targetId === targetId
                    ? { ...target, ...data, updated: true }
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
                    enabled: target.enabled
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
            accessorKey: "ip",
            header: t("targetAddr"),
            cell: ({ row }) => (
                <Input
                    defaultValue={row.original.ip}
                    className="min-w-[150px]"
                    onBlur={(e) =>
                        updateTarget(row.original.targetId, {
                            ip: e.target.value
                        })
                    }
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
        // },
        {
            accessorKey: "enabled",
            header: t("enabled"),
            cell: ({ row }) => (
                <Switch
                    defaultChecked={row.original.enabled}
                    onCheckedChange={(val) =>
                        updateTarget(row.original.targetId, { enabled: val })
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

    if (resource.http) {
        const methodCol: ColumnDef<LocalTarget> = {
            accessorKey: "method",
            header: t("method"),
            cell: ({ row }) => (
                <Select
                    defaultValue={row.original.method ?? ""}
                    onValueChange={(value) =>
                        updateTarget(row.original.targetId, { method: value })
                    }
                >
                    <SelectTrigger className="min-w-[100px]">
                        {row.original.method}
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="http">http</SelectItem>
                        <SelectItem value="https">https</SelectItem>
                        <SelectItem value="h2c">h2c</SelectItem>
                    </SelectContent>
                </Select>
            )
        };

        // add this to the first column
        columns.unshift(methodCol);
    }

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
                    <SettingsSectionForm>
                        <Form {...targetsSettingsForm}>
                            <form
                                onSubmit={targetsSettingsForm.handleSubmit(
                                    saveAllSettings
                                )}
                                className="space-y-4"
                                id="targets-settings-form"
                            >
                                {targets.length >= 2 && (
                                    <FormField
                                        control={targetsSettingsForm.control}
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
                                                            field.onChange(val);
                                                        }}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </form>
                        </Form>
                    </SettingsSectionForm>

                    <Form {...addTargetForm}>
                        <form
                            onSubmit={addTargetForm.handleSubmit(addTarget)}
                            className="space-y-4"
                        >
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-start">
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
                                            <FormLabel>
                                                {t("targetAddr")}
                                            </FormLabel>
                                            <FormControl>
                                                <Input id="ip" {...field} />
                                            </FormControl>
                                            {site && site.type == "newt" && (
                                                <ContainersSelector
                                                    site={site}
                                                    onContainerSelect={(
                                                        hostname,
                                                        port
                                                    ) => {
                                                        addTargetForm.setValue(
                                                            "ip",
                                                            hostname
                                                        );
                                                        if (port) {
                                                            addTargetForm.setValue(
                                                                "port",
                                                                port
                                                            );
                                                        }
                                                    }}
                                                />
                                            )}
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

                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef
                                                          .header,
                                                      header.getContext()
                                                  )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow key={row.id}>
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(
                                                    cell.column.columnDef.cell,
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
                    {t("saveAllSettings")}
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
