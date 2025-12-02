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
import { Input } from "@app/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@app/components/ui/table";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { toast } from "@app/hooks/useToast";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { ListSitesResponse } from "@server/routers/site";
import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
    VisibilityState
} from "@tanstack/react-table";
import {
    ArrowUpDown,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    Columns,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Search,
    XCircle
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import CreateInternalResourceDialog from "@app/components/CreateInternalResourceDialog";
import EditInternalResourceDialog from "@app/components/EditInternalResourceDialog";
import { siteQueries } from "@app/lib/queries";
import { useQuery } from "@tanstack/react-query";

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

export type InternalResourceRow = {
    id: number;
    name: string;
    orgId: string;
    siteName: string;
    siteAddress: string | null;
    // mode: "host" | "cidr" | "port";
    mode: "host" | "cidr";
    // protocol: string | null;
    // proxyPort: number | null;
    siteId: number;
    siteNiceId: string;
    destination: string;
    // destinationPort: number | null;
    alias: string | null;
};

type ClientResourcesTableProps = {
    internalResources: InternalResourceRow[];
    orgId: string;
    defaultSort?: {
        id: string;
        desc: boolean;
    };
};

const STORAGE_KEYS = {
    PAGE_SIZE: "datatable-page-size",
    COLUMN_VISIBILITY: "datatable-column-visibility",
    getTablePageSize: (tableId?: string) =>
        tableId ? `datatable-${tableId}-page-size` : STORAGE_KEYS.PAGE_SIZE,
    getTableColumnVisibility: (tableId?: string) =>
        tableId
            ? `datatable-${tableId}-column-visibility`
            : STORAGE_KEYS.COLUMN_VISIBILITY
};

const getStoredPageSize = (tableId?: string, defaultSize = 20): number => {
    if (typeof window === "undefined") return defaultSize;

    try {
        const key = STORAGE_KEYS.getTablePageSize(tableId);
        const stored = localStorage.getItem(key);
        if (stored) {
            const parsed = parseInt(stored, 10);
            if (parsed > 0 && parsed <= 1000) {
                return parsed;
            }
        }
    } catch (error) {
        console.warn("Failed to read page size from localStorage:", error);
    }
    return defaultSize;
};

const setStoredPageSize = (pageSize: number, tableId?: string): void => {
    if (typeof window === "undefined") return;

    try {
        const key = STORAGE_KEYS.getTablePageSize(tableId);
        localStorage.setItem(key, pageSize.toString());
    } catch (error) {
        console.warn("Failed to save page size to localStorage:", error);
    }
};

const getStoredColumnVisibility = (
    tableId?: string,
    defaultVisibility?: Record<string, boolean>
): Record<string, boolean> => {
    if (typeof window === "undefined") return defaultVisibility || {};

    try {
        const key = STORAGE_KEYS.getTableColumnVisibility(tableId);
        const stored = localStorage.getItem(key);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Validate that it's an object
            if (typeof parsed === "object" && parsed !== null) {
                return parsed;
            }
        }
    } catch (error) {
        console.warn(
            "Failed to read column visibility from localStorage:",
            error
        );
    }
    return defaultVisibility || {};
};

const setStoredColumnVisibility = (
    visibility: Record<string, boolean>,
    tableId?: string
): void => {
    if (typeof window === "undefined") return;

    try {
        const key = STORAGE_KEYS.getTableColumnVisibility(tableId);
        localStorage.setItem(key, JSON.stringify(visibility));
    } catch (error) {
        console.warn(
            "Failed to save column visibility to localStorage:",
            error
        );
    }
};

export default function ClientResourcesTable({
    internalResources,
    orgId,
    defaultSort
}: ClientResourcesTableProps) {
    const router = useRouter();
    const t = useTranslations();

    const { env } = useEnvContext();

    const api = createApiClient({ env });

    const [internalPageSize, setInternalPageSize] = useState<number>(() =>
        getStoredPageSize("internal-resources", 20)
    );

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const [selectedInternalResource, setSelectedInternalResource] =
        useState<InternalResourceRow | null>();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingResource, setEditingResource] =
        useState<InternalResourceRow | null>();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    const { data: sites = [] } = useQuery(
        siteQueries.listPerOrg({ orgId, api })
    );

    const [internalSorting, setInternalSorting] = useState<SortingState>(
        defaultSort ? [defaultSort] : []
    );
    const [internalColumnFilters, setInternalColumnFilters] =
        useState<ColumnFiltersState>([]);
    const [internalGlobalFilter, setInternalGlobalFilter] = useState<any>([]);
    const [isRefreshing, startTransition] = useTransition();

    const [internalColumnVisibility, setInternalColumnVisibility] =
        useState<VisibilityState>(() =>
            getStoredColumnVisibility("internal-resources", {})
        );

    const refreshData = async () => {
        try {
            router.refresh();
            console.log("Data refreshed");
        } catch (error) {
            toast({
                title: t("error"),
                description: t("refreshError"),
                variant: "destructive"
            });
        }
    };

    const deleteInternalResource = async (
        resourceId: number,
        siteId: number
    ) => {
        try {
            await api.delete(
                `/org/${orgId}/site/${siteId}/resource/${resourceId}`
            );
            router.refresh();
            setIsDeleteModalOpen(false);
        } catch (e) {
            console.error(t("resourceErrorDelete"), e);
            toast({
                variant: "destructive",
                title: t("resourceErrorDelte"),
                description: formatAxiosError(e, t("v"))
            });
        }
    };

    const internalColumns: ExtendedColumnDef<InternalResourceRow>[] = [
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
            accessorKey: "siteName",
            friendlyName: t("siteName"),
            header: () => <span className="p-3">{t("siteName")}</span>,
            cell: ({ row }) => {
                const resourceRow = row.original;
                return (
                    <Link
                        href={`/${resourceRow.orgId}/settings/sites/${resourceRow.siteNiceId}`}
                    >
                        <Button variant="outline">
                            {resourceRow.siteName}
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                );
            }
        },
        {
            accessorKey: "mode",
            friendlyName: t("editInternalResourceDialogMode"),
            header: () => (
                <span className="p-3">
                    {t("editInternalResourceDialogMode")}
                </span>
            ),
            cell: ({ row }) => {
                const resourceRow = row.original;
                const modeLabels: Record<"host" | "cidr" | "port", string> = {
                    host: t("editInternalResourceDialogModeHost"),
                    cidr: t("editInternalResourceDialogModeCidr"),
                    port: t("editInternalResourceDialogModePort")
                };
                return <span>{modeLabels[resourceRow.mode]}</span>;
            }
        },
        {
            accessorKey: "destination",
            friendlyName: t("resourcesTableDestination"),
            header: () => (
                <span className="p-3">{t("resourcesTableDestination")}</span>
            ),
            cell: ({ row }) => {
                const resourceRow = row.original;
                let displayText: string;
                let copyText: string;

                // if (
                //     resourceRow.mode === "port" &&
                //     // resourceRow.protocol &&
                //     // resourceRow.proxyPort &&
                //     // resourceRow.destinationPort
                // ) {
                //     // const protocol = resourceRow.protocol.toUpperCase();
                //     // For port mode: site part uses alias or site address, destination part uses destination IP
                //     // If site address has CIDR notation, extract just the IP address
                //     let siteAddress = resourceRow.siteAddress;
                //     if (siteAddress && siteAddress.includes("/")) {
                //         siteAddress = siteAddress.split("/")[0];
                //     }
                //     const siteDisplay = resourceRow.alias || siteAddress;
                //     // displayText = `${protocol} ${siteDisplay}:${resourceRow.proxyPort} -> ${resourceRow.destination}:${resourceRow.destinationPort}`;
                //     // copyText = `${siteDisplay}:${resourceRow.proxyPort}`;
                // } else if (resourceRow.mode === "host") {
                if (resourceRow.mode === "host") {
                    // For host mode: use alias if available, otherwise use destination
                    const destinationDisplay =
                        resourceRow.alias || resourceRow.destination;
                    displayText = destinationDisplay;
                    copyText = destinationDisplay;
                } else if (resourceRow.mode === "cidr") {
                    displayText = resourceRow.destination;
                    copyText = resourceRow.destination;
                } else {
                    const destinationDisplay =
                        resourceRow.alias || resourceRow.destination;
                    displayText = destinationDisplay;
                    copyText = destinationDisplay;
                }

                return (
                    <CopyToClipboard
                        text={copyText}
                        isLink={false}
                        displayText={displayText}
                    />
                );
            }
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
                                    variant="outline"
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
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedInternalResource(
                                            resourceRow
                                        );
                                        setIsDeleteModalOpen(true);
                                    }}
                                >
                                    <span className="text-red-500">
                                        {t("delete")}
                                    </span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            variant={"outline"}
                            onClick={() => {
                                setEditingResource(resourceRow);
                                setIsEditDialogOpen(true);
                            }}
                        >
                            {t("edit")}
                        </Button>
                    </div>
                );
            }
        }
    ];

    const internalTable = useReactTable({
        data: internalResources,
        columns: internalColumns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setInternalSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setInternalColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onGlobalFilterChange: setInternalGlobalFilter,
        onColumnVisibilityChange: setInternalColumnVisibility,
        initialState: {
            pagination: {
                pageSize: internalPageSize,
                pageIndex: 0
            },
            columnVisibility: internalColumnVisibility
        },
        state: {
            sorting: internalSorting,
            columnFilters: internalColumnFilters,
            globalFilter: internalGlobalFilter,
            columnVisibility: internalColumnVisibility
        }
    });

    const handleInternalPageSizeChange = (newPageSize: number) => {
        setInternalPageSize(newPageSize);
        setStoredPageSize(newPageSize, "internal-resources");
    };

    // Persist column visibility changes to localStorage
    useEffect(() => {
        setStoredColumnVisibility(
            internalColumnVisibility,
            "internal-resources"
        );
    }, [internalColumnVisibility]);

    return (
        <>
            {selectedInternalResource && (
                <ConfirmDeleteDialog
                    open={isDeleteModalOpen}
                    setOpen={(val) => {
                        setIsDeleteModalOpen(val);
                        setSelectedInternalResource(null);
                    }}
                    dialog={
                        <div>
                            <p>{t("resourceQuestionRemove")}</p>
                            <p>{t("resourceMessageRemove")}</p>
                        </div>
                    }
                    buttonText={t("resourceDeleteConfirm")}
                    onConfirm={async () =>
                        deleteInternalResource(
                            selectedInternalResource!.id,
                            selectedInternalResource!.siteId
                        )
                    }
                    string={selectedInternalResource.name}
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
                                    value={internalGlobalFilter ?? ""}
                                    onChange={(e) =>
                                        internalTable.setGlobalFilter(
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
                                {" "}
                                <Button
                                    onClick={() => setIsCreateDialogOpen(true)}
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
                                    {internalTable
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
                                    {internalTable.getRowModel().rows
                                        ?.length ? (
                                        internalTable
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
                                                colSpan={internalColumns.length}
                                                className="h-24 text-center"
                                            >
                                                {t(
                                                    "resourcesTableNoInternalResourcesFound"
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="mt-4">
                            <DataTablePagination
                                table={internalTable}
                                onPageSizeChange={handleInternalPageSizeChange}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {editingResource && (
                <EditInternalResourceDialog
                    open={isEditDialogOpen}
                    setOpen={setIsEditDialogOpen}
                    resource={editingResource}
                    orgId={orgId}
                    onSuccess={() => {
                        router.refresh();
                        setEditingResource(null);
                    }}
                />
            )}

            <CreateInternalResourceDialog
                open={isCreateDialogOpen}
                setOpen={setIsCreateDialogOpen}
                orgId={orgId}
                sites={sites}
                onSuccess={() => {
                    router.refresh();
                }}
            />
        </>
    );
}
