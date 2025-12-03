"use client";

import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";
import CopyToClipboard from "@app/components/CopyToClipboard";
import { DataTablePagination } from "@app/components/DataTablePagination";
import { Button } from "@app/components/ui/button";
import { Card, CardContent, CardHeader } from "@app/components/ui/card";
import { ExtendedColumnDef } from "@app/components/ui/data-table";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@app/components/ui/dropdown-menu";
import { InfoPopup } from "@app/components/ui/info-popup";
import { Input } from "@app/components/ui/input";
import { Switch } from "@app/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@app/components/ui/table";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useStoredColumnVisibility } from "@app/hooks/useStoredColumnVisibility";
import { useStoredPageSize } from "@app/hooks/useStoredPageSize";
import { toast } from "@app/hooks/useToast";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { UpdateResourceResponse } from "@server/routers/resource";
import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable
} from "@tanstack/react-table";
import { AxiosResponse } from "axios";
import {
    ArrowRight,
    ArrowUpDown,
    CheckCircle2,
    ChevronDown,
    Clock,
    Columns,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    ShieldOff,
    XCircle
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type TargetHealth = {
    targetId: number;
    ip: string;
    port: number;
    enabled: boolean;
    healthStatus?: "healthy" | "unhealthy" | "unknown";
};

export type ResourceRow = {
    id: number;
    nice: string | null;
    name: string;
    orgId: string;
    domain: string;
    authState: string;
    http: boolean;
    protocol: string;
    proxyPort: number | null;
    enabled: boolean;
    domainId?: string;
    ssl: boolean;
    targetHost?: string;
    targetPort?: number;
    targets?: TargetHealth[];
};

function getOverallHealthStatus(
    targets?: TargetHealth[]
): "online" | "degraded" | "offline" | "unknown" {
    if (!targets || targets.length === 0) {
        return "unknown";
    }

    const monitoredTargets = targets.filter(
        (t) => t.enabled && t.healthStatus && t.healthStatus !== "unknown"
    );

    if (monitoredTargets.length === 0) {
        return "unknown";
    }

    const healthyCount = monitoredTargets.filter(
        (t) => t.healthStatus === "healthy"
    ).length;
    const unhealthyCount = monitoredTargets.filter(
        (t) => t.healthStatus === "unhealthy"
    ).length;

    if (healthyCount === monitoredTargets.length) {
        return "online";
    } else if (unhealthyCount === monitoredTargets.length) {
        return "offline";
    } else {
        return "degraded";
    }
}

function StatusIcon({
    status,
    className = ""
}: {
    status: "online" | "degraded" | "offline" | "unknown";
    className?: string;
}) {
    const iconClass = `h-4 w-4 ${className}`;

    switch (status) {
        case "online":
            return <CheckCircle2 className={`${iconClass} text-green-500`} />;
        case "degraded":
            return <CheckCircle2 className={`${iconClass} text-yellow-500`} />;
        case "offline":
            return <XCircle className={`${iconClass} text-destructive`} />;
        case "unknown":
            return <Clock className={`${iconClass} text-muted-foreground`} />;
        default:
            return null;
    }
}

type ProxyResourcesTableProps = {
    resources: ResourceRow[];
    orgId: string;
    defaultSort?: {
        id: string;
        desc: boolean;
    };
};

export default function ProxyResourcesTable({
    resources,
    orgId,
    defaultSort
}: ProxyResourcesTableProps) {
    const router = useRouter();
    const t = useTranslations();

    const { env } = useEnvContext();

    const api = createApiClient({ env });

    const [proxyPageSize, setProxyPageSize] = useStoredPageSize(
        "proxy-resources",
        20
    );
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedResource, setSelectedResource] =
        useState<ResourceRow | null>();

    const [proxySorting, setProxySorting] = useState<SortingState>(
        defaultSort ? [defaultSort] : []
    );

    const [proxyColumnFilters, setProxyColumnFilters] =
        useState<ColumnFiltersState>([]);
    const [proxyGlobalFilter, setProxyGlobalFilter] = useState<any>([]);

    const [isRefreshing, startTransition] = useTransition();
    const [proxyColumnVisibility, setProxyColumnVisibility] =
        useStoredColumnVisibility("proxy-resources", {});
    const refreshData = () => {
        try {
            router.refresh();
        } catch (error) {
            toast({
                title: t("error"),
                description: t("refreshError"),
                variant: "destructive"
            });
        }
    };

    const deleteResource = (resourceId: number) => {
        api.delete(`/resource/${resourceId}`)
            .catch((e) => {
                console.error(t("resourceErrorDelte"), e);
                toast({
                    variant: "destructive",
                    title: t("resourceErrorDelte"),
                    description: formatAxiosError(e, t("resourceErrorDelte"))
                });
            })
            .then(() => {
                startTransition(() => {
                    router.refresh();
                    setIsDeleteModalOpen(false);
                });
            });
    };

    async function toggleResourceEnabled(val: boolean, resourceId: number) {
        await api
            .post<AxiosResponse<UpdateResourceResponse>>(
                `resource/${resourceId}`,
                {
                    enabled: val
                }
            )
            .catch((e) => {
                toast({
                    variant: "destructive",
                    title: t("resourcesErrorUpdate"),
                    description: formatAxiosError(
                        e,
                        t("resourcesErrorUpdateDescription")
                    )
                });
            });
    }

    function TargetStatusCell({ targets }: { targets?: TargetHealth[] }) {
        const overallStatus = getOverallHealthStatus(targets);

        if (!targets || targets.length === 0) {
            return (
                <div className="flex items-center gap-2">
                    <StatusIcon status="unknown" />
                    <span className="text-sm">
                        {t("resourcesTableNoTargets")}
                    </span>
                </div>
            );
        }

        const monitoredTargets = targets.filter(
            (t) => t.enabled && t.healthStatus && t.healthStatus !== "unknown"
        );
        const unknownTargets = targets.filter(
            (t) => !t.enabled || !t.healthStatus || t.healthStatus === "unknown"
        );

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 h-8 px-0 font-normal"
                    >
                        <StatusIcon status={overallStatus} />
                        <span className="text-sm">
                            {overallStatus === "online" &&
                                t("resourcesTableHealthy")}
                            {overallStatus === "degraded" &&
                                t("resourcesTableDegraded")}
                            {overallStatus === "offline" &&
                                t("resourcesTableOffline")}
                            {overallStatus === "unknown" &&
                                t("resourcesTableUnknown")}
                        </span>
                        <ChevronDown className="h-3 w-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[280px]">
                    {monitoredTargets.length > 0 && (
                        <>
                            {monitoredTargets.map((target) => (
                                <DropdownMenuItem
                                    key={target.targetId}
                                    className="flex items-center justify-between gap-4"
                                >
                                    <div className="flex items-center gap-2">
                                        <StatusIcon
                                            status={
                                                target.healthStatus ===
                                                "healthy"
                                                    ? "online"
                                                    : "offline"
                                            }
                                            className="h-3 w-3"
                                        />
                                        {`${target.ip}:${target.port}`}
                                    </div>
                                    <span
                                        className={`capitalize ${
                                            target.healthStatus === "healthy"
                                                ? "text-green-500"
                                                : "text-destructive"
                                        }`}
                                    >
                                        {target.healthStatus}
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        </>
                    )}
                    {unknownTargets.length > 0 && (
                        <>
                            {unknownTargets.map((target) => (
                                <DropdownMenuItem
                                    key={target.targetId}
                                    className="flex items-center justify-between gap-4"
                                >
                                    <div className="flex items-center gap-2">
                                        <StatusIcon
                                            status="unknown"
                                            className="h-3 w-3"
                                        />
                                        {`${target.ip}:${target.port}`}
                                    </div>
                                    <span className="text-muted-foreground">
                                        {!target.enabled
                                            ? t("disabled")
                                            : t("resourcesTableNotMonitored")}
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    const proxyColumns: ExtendedColumnDef<ResourceRow>[] = [
        {
            accessorKey: "name",
            enableHiding: false,
            friendlyName: t("name"),
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t("name")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            }
        },
        {
            accessorKey: "nice",
            friendlyName: t("resource"),
            enableHiding: true,
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t("resource")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            }
        },
        {
            accessorKey: "protocol",
            friendlyName: t("protocol"),
            header: () => <span className="p-3">{t("protocol")}</span>,
            cell: ({ row }) => {
                const resourceRow = row.original;
                return (
                    <span>
                        {resourceRow.http
                            ? resourceRow.ssl
                                ? "HTTPS"
                                : "HTTP"
                            : resourceRow.protocol.toUpperCase()}
                    </span>
                );
            }
        },
        {
            id: "status",
            accessorKey: "status",
            friendlyName: t("status"),
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t("status")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const resourceRow = row.original;
                return <TargetStatusCell targets={resourceRow.targets} />;
            },
            sortingFn: (rowA, rowB) => {
                const statusA = getOverallHealthStatus(rowA.original.targets);
                const statusB = getOverallHealthStatus(rowB.original.targets);
                const statusOrder = {
                    online: 3,
                    degraded: 2,
                    offline: 1,
                    unknown: 0
                };
                return statusOrder[statusA] - statusOrder[statusB];
            }
        },
        {
            accessorKey: "domain",
            friendlyName: t("access"),
            header: () => <span className="p-3">{t("access")}</span>,
            cell: ({ row }) => {
                const resourceRow = row.original;
                return (
                    <div className="flex items-center space-x-2">
                        {!resourceRow.http ? (
                            <CopyToClipboard
                                text={resourceRow.proxyPort?.toString() || ""}
                                isLink={false}
                            />
                        ) : !resourceRow.domainId ? (
                            <InfoPopup
                                info={t("domainNotFoundDescription")}
                                text={t("domainNotFound")}
                            />
                        ) : (
                            <CopyToClipboard
                                text={resourceRow.domain}
                                isLink={true}
                            />
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: "authState",
            friendlyName: t("authentication"),
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t("authentication")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const resourceRow = row.original;
                return (
                    <div>
                        {resourceRow.authState === "protected" ? (
                            <span className="flex items-center space-x-2">
                                <ShieldCheck className="w-4 h-4 text-green-500" />
                                <span>{t("protected")}</span>
                            </span>
                        ) : resourceRow.authState === "not_protected" ? (
                            <span className="flex items-center space-x-2">
                                <ShieldOff className="w-4 h-4 text-yellow-500" />
                                <span>{t("notProtected")}</span>
                            </span>
                        ) : (
                            <span>-</span>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: "enabled",
            friendlyName: t("enabled"),
            header: () => <span className="p-3">{t("enabled")}</span>,
            cell: ({ row }) => (
                <Switch
                    defaultChecked={
                        row.original.http
                            ? !!row.original.domainId && row.original.enabled
                            : row.original.enabled
                    }
                    disabled={
                        row.original.http ? !row.original.domainId : false
                    }
                    onCheckedChange={(val) =>
                        toggleResourceEnabled(val, row.original.id)
                    }
                />
            )
        },
        {
            id: "actions",
            enableHiding: false,
            header: ({ table }) => {
                const hasHideableColumns = table
                    .getAllColumns()
                    .some((column) => column.getCanHide());
                if (!hasHideableColumns) {
                    return <span className="p-3"></span>;
                }
                return (
                    <div className="flex flex-col items-end gap-1 p-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                >
                                    <Columns className="h-4 w-4" />
                                    <span className="sr-only">
                                        {t("columns") || "Columns"}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>
                                    {t("toggleColumns") || "Toggle columns"}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {table
                                    .getAllColumns()
                                    .filter((column) => column.getCanHide())
                                    .map((column) => {
                                        const columnDef =
                                            column.columnDef as any;
                                        const friendlyName =
                                            columnDef.friendlyName;
                                        const displayName =
                                            friendlyName ||
                                            (typeof columnDef.header ===
                                            "string"
                                                ? columnDef.header
                                                : column.id);
                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={column.id}
                                                className="capitalize"
                                                checked={column.getIsVisible()}
                                                onCheckedChange={(value) =>
                                                    column.toggleVisibility(
                                                        !!value
                                                    )
                                                }
                                                onSelect={(e) =>
                                                    e.preventDefault()
                                                }
                                            >
                                                {displayName}
                                            </DropdownMenuCheckboxItem>
                                        );
                                    })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
            cell: ({ row }) => {
                const resourceRow = row.original;
                return (
                    <div className="flex items-center gap-2 justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">
                                        {t("openMenu")}
                                    </span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <Link
                                    className="block w-full"
                                    href={`/${resourceRow.orgId}/settings/resources/${resourceRow.nice}`}
                                >
                                    <DropdownMenuItem>
                                        {t("viewSettings")}
                                    </DropdownMenuItem>
                                </Link>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedResource(resourceRow);
                                        setIsDeleteModalOpen(true);
                                    }}
                                >
                                    <span className="text-red-500">
                                        {t("delete")}
                                    </span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Link
                            href={`/${resourceRow.orgId}/settings/resources/${resourceRow.nice}`}
                        >
                            <Button variant={"outline"}>
                                {t("edit")}
                                <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </Link>
                    </div>
                );
            }
        }
    ];

    const proxyTable = useReactTable({
        data: resources,
        columns: proxyColumns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setProxySorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setProxyColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onGlobalFilterChange: setProxyGlobalFilter,
        onColumnVisibilityChange: setProxyColumnVisibility,
        initialState: {
            pagination: {
                pageSize: proxyPageSize,
                pageIndex: 0
            },
            columnVisibility: proxyColumnVisibility
        },
        state: {
            sorting: proxySorting,
            columnFilters: proxyColumnFilters,
            globalFilter: proxyGlobalFilter,
            columnVisibility: proxyColumnVisibility
        }
    });

    return (
        <>
            {selectedResource && (
                <ConfirmDeleteDialog
                    open={isDeleteModalOpen}
                    setOpen={(val) => {
                        setIsDeleteModalOpen(val);
                        setSelectedResource(null);
                    }}
                    dialog={
                        <div>
                            <p>{t("resourceQuestionRemove")}</p>
                            <p>{t("resourceMessageRemove")}</p>
                        </div>
                    }
                    buttonText={t("resourceDeleteConfirm")}
                    onConfirm={async () => deleteResource(selectedResource!.id)}
                    string={selectedResource.name}
                    title={t("resourceDelete")}
                />
            )}

            <div className="container mx-auto max-w-12xl">
                <Card>
                    <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pb-0">
                        <div className="flex flex-row space-y-3 w-full sm:mr-2 gap-2">
                            <div className="relative w-full sm:max-w-sm">
                                <Input
                                    placeholder={t("resourcesSearch")}
                                    value={proxyGlobalFilter ?? ""}
                                    onChange={(e) =>
                                        proxyTable.setGlobalFilter(
                                            String(e.target.value)
                                        )
                                    }
                                    className="w-full pl-8"
                                />
                                <Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:justify-end">
                            <div>
                                <Button
                                    variant="outline"
                                    onClick={() => startTransition(refreshData)}
                                    disabled={isRefreshing}
                                >
                                    <RefreshCw
                                        className={`mr-0 sm:mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                                    />
                                    <span className="hidden sm:inline">
                                        {t("refresh")}
                                    </span>
                                </Button>
                            </div>
                            <div>
                                <Button
                                    onClick={() =>
                                        router.push(
                                            `/${orgId}/settings/resources/create`
                                        )
                                    }
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t("resourceAdd")}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto mt-9">
                            <Table>
                                <TableHeader>
                                    {proxyTable
                                        .getHeaderGroups()
                                        .map((headerGroup) => (
                                            <TableRow key={headerGroup.id}>
                                                {headerGroup.headers
                                                    .filter((header) =>
                                                        header.column.getIsVisible()
                                                    )
                                                    .map((header) => (
                                                        <TableHead
                                                            key={header.id}
                                                            className={`whitespace-nowrap ${
                                                                header.column
                                                                    .id ===
                                                                "actions"
                                                                    ? "sticky right-0 z-10 w-auto min-w-fit bg-card"
                                                                    : header
                                                                            .column
                                                                            .id ===
                                                                        "name"
                                                                      ? "md:sticky md:left-0 z-10 bg-card"
                                                                      : ""
                                                            }`}
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
                                                    ))}
                                            </TableRow>
                                        ))}
                                </TableHeader>
                                <TableBody>
                                    {proxyTable.getRowModel().rows?.length ? (
                                        proxyTable
                                            .getRowModel()
                                            .rows.map((row) => (
                                                <TableRow
                                                    key={row.id}
                                                    data-state={
                                                        row.getIsSelected() &&
                                                        "selected"
                                                    }
                                                >
                                                    {row
                                                        .getVisibleCells()
                                                        .map((cell) => (
                                                            <TableCell
                                                                key={cell.id}
                                                                className={`whitespace-nowrap ${
                                                                    cell.column
                                                                        .id ===
                                                                    "actions"
                                                                        ? "sticky right-0 z-10 w-auto min-w-fit bg-card"
                                                                        : cell
                                                                                .column
                                                                                .id ===
                                                                            "name"
                                                                          ? "md:sticky md:left-0 z-10 bg-card"
                                                                          : ""
                                                                }`}
                                                            >
                                                                {flexRender(
                                                                    cell.column
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
                                                colSpan={proxyColumns.length}
                                                className="h-24 text-center"
                                            >
                                                {t(
                                                    "resourcesTableNoProxyResourcesFound"
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="mt-4">
                            <DataTablePagination
                                table={proxyTable}
                                onPageSizeChange={setProxyPageSize}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
