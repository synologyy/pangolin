"use client";

import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";
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
import { useStoredColumnVisibility } from "@app/hooks/useStoredColumnVisibility";
import { useStoredPageSize } from "@app/hooks/useStoredPageSize";
import { toast } from "@app/hooks/useToast";
import { createApiClient, formatAxiosError } from "@app/lib/api";
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
import {
    ArrowRight,
    ArrowUpDown,
    ArrowUpRight,
    Columns,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Search
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "./ui/badge";
import { InfoPopup } from "./ui/info-popup";

export type ClientRow = {
    id: number;
    name: string;
    subnet: string;
    // siteIds: string;
    mbIn: string;
    mbOut: string;
    orgId: string;
    online: boolean;
    olmVersion?: string;
    olmUpdateAvailable: boolean;
    userId: string | null;
    username: string | null;
    userEmail: string | null;
};

type ClientTableProps = {
    machineClients: ClientRow[];
    orgId: string;
};

export default function MachineClientsTable({
    machineClients,
    orgId
}: ClientTableProps) {
    const router = useRouter();

    const t = useTranslations();

    const [machinePageSize, setMachinePageSize] = useStoredPageSize(
        "machine-clients",
        20
    );

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<ClientRow | null>(
        null
    );

    const api = createApiClient(useEnvContext());
    const [isRefreshing, startTransition] = useTransition();

    const [machineSorting, setMachineSorting] = useState<SortingState>([]);
    const [machineColumnFilters, setMachineColumnFilters] =
        useState<ColumnFiltersState>([]);
    const [machineGlobalFilter, setMachineGlobalFilter] = useState<any>([]);

    const defaultMachineColumnVisibility = {
        client: false,
        subnet: false,
        userId: false
    };

    const [machineColumnVisibility, setMachineColumnVisibility] =
        useStoredColumnVisibility(
            "machine-clients",
            defaultMachineColumnVisibility
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

    const deleteClient = (clientId: number) => {
        api.delete(`/client/${clientId}`)
            .catch((e) => {
                console.error("Error deleting client", e);
                toast({
                    variant: "destructive",
                    title: "Error deleting client",
                    description: formatAxiosError(e, "Error deleting client")
                });
            })
            .then(() => {
                startTransition(() => {
                    router.refresh();
                    setIsDeleteModalOpen(false);
                });
            });
    };

    // Check if there are any rows without userIds in the current view's data
    const hasRowsWithoutUserId = useMemo(() => {
        return machineClients.some((client) => !client.userId) ?? false;
    }, [machineClients]);

    const columns: ExtendedColumnDef<ClientRow>[] = useMemo(() => {
        const baseColumns: ExtendedColumnDef<ClientRow>[] = [
            {
                accessorKey: "name",
                enableHiding: false,
                friendlyName: "Name",
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === "asc"
                                )
                            }
                        >
                            Name
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                }
            },
            {
                accessorKey: "userId",
                friendlyName: "User",
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === "asc"
                                )
                            }
                        >
                            User
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    const r = row.original;
                    return r.userId ? (
                        <Link
                            href={`/${r.orgId}/settings/access/users/${r.userId}`}
                        >
                            <Button variant="outline">
                                {r.userEmail || r.username || r.userId}
                                <ArrowUpRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                    ) : (
                        "-"
                    );
                }
            },
            // {
            //     accessorKey: "siteName",
            //     header: ({ column }) => {
            //         return (
            //             <Button
            //                 variant="ghost"
            //                 onClick={() =>
            //                     column.toggleSorting(column.getIsSorted() === "asc")
            //                 }
            //             >
            //                 Site
            //                 <ArrowUpDown className="ml-2 h-4 w-4" />
            //             </Button>
            //         );
            //     },
            //     cell: ({ row }) => {
            //         const r = row.original;
            //         return (
            //             <Link href={`/${r.orgId}/settings/sites/${r.siteId}`}>
            //                 <Button variant="outline">
            //                     {r.siteName}
            //                     <ArrowUpRight className="ml-2 h-4 w-4" />
            //                 </Button>
            //             </Link>
            //         );
            //     }
            // },
            {
                accessorKey: "online",
                friendlyName: "Connectivity",
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === "asc"
                                )
                            }
                        >
                            Connectivity
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    const originalRow = row.original;
                    if (originalRow.online) {
                        return (
                            <span className="text-green-500 flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span>Connected</span>
                            </span>
                        );
                    } else {
                        return (
                            <span className="text-neutral-500 flex items-center space-x-2">
                                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                <span>Disconnected</span>
                            </span>
                        );
                    }
                }
            },
            {
                accessorKey: "mbIn",
                friendlyName: "Data In",
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === "asc"
                                )
                            }
                        >
                            Data In
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                }
            },
            {
                accessorKey: "mbOut",
                friendlyName: "Data Out",
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === "asc"
                                )
                            }
                        >
                            Data Out
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                }
            },
            {
                accessorKey: "client",
                friendlyName: t("client"),
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === "asc"
                                )
                            }
                        >
                            {t("client")}
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    const originalRow = row.original;

                    return (
                        <div className="flex items-center space-x-1">
                            <Badge variant="secondary">
                                <div className="flex items-center space-x-2">
                                    <span>Olm</span>
                                    {originalRow.olmVersion && (
                                        <span className="text-xs text-gray-500">
                                            v{originalRow.olmVersion}
                                        </span>
                                    )}
                                </div>
                            </Badge>
                            {originalRow.olmUpdateAvailable && (
                                <InfoPopup info={t("olmUpdateAvailableInfo")} />
                            )}
                        </div>
                    );
                }
            },
            {
                accessorKey: "subnet",
                friendlyName: "Address",
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === "asc"
                                )
                            }
                        >
                            Address
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                }
            }
        ];

        // Only include actions column if there are rows without userIds
        if (hasRowsWithoutUserId) {
            baseColumns.push({
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
                                <DropdownMenuContent
                                    align="end"
                                    className="w-48"
                                >
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
                    const clientRow = row.original;
                    return !clientRow.userId ? (
                        <div className="flex items-center gap-2 justify-end">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                    >
                                        <span className="sr-only">
                                            Open menu
                                        </span>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {/* <Link */}
                                    {/*     className="block w-full" */}
                                    {/*     href={`/${clientRow.orgId}/settings/sites/${clientRow.nice}`} */}
                                    {/* > */}
                                    {/*     <DropdownMenuItem> */}
                                    {/*         View settings */}
                                    {/*     </DropdownMenuItem> */}
                                    {/* </Link> */}
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setSelectedClient(clientRow);
                                            setIsDeleteModalOpen(true);
                                        }}
                                    >
                                        <span className="text-red-500">
                                            Delete
                                        </span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Link
                                href={`/${clientRow.orgId}/settings/clients/${clientRow.id}`}
                            >
                                <Button variant={"outline"}>
                                    Edit
                                    <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                            </Link>
                        </div>
                    ) : null;
                }
            });
        }

        return baseColumns;
    }, [hasRowsWithoutUserId, t]);

    const machineTable = useReactTable({
        data: machineClients || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setMachineSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setMachineColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onGlobalFilterChange: setMachineGlobalFilter,
        onColumnVisibilityChange: setMachineColumnVisibility,
        initialState: {
            pagination: {
                pageSize: machinePageSize,
                pageIndex: 0
            },
            columnVisibility: machineColumnVisibility
        },
        state: {
            sorting: machineSorting,
            columnFilters: machineColumnFilters,
            globalFilter: machineGlobalFilter,
            columnVisibility: machineColumnVisibility
        }
    });

    return (
        <>
            {selectedClient && (
                <ConfirmDeleteDialog
                    open={isDeleteModalOpen}
                    setOpen={(val) => {
                        setIsDeleteModalOpen(val);
                        setSelectedClient(null);
                    }}
                    dialog={
                        <div>
                            <p>{t("deleteClientQuestion")}</p>
                            <p>{t("clientMessageRemove")}</p>
                        </div>
                    }
                    buttonText="Confirm Delete Client"
                    onConfirm={async () => deleteClient(selectedClient!.id)}
                    string={selectedClient.name}
                    title="Delete Client"
                />
            )}

            <div className="container mx-auto max-w-12xl">
                <Card>
                    <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pb-0">
                        <div className="flex flex-row space-y-3 w-full sm:mr-2 gap-2">
                            <div className="relative w-full sm:max-w-sm">
                                <Input
                                    placeholder={t("resourcesSearch")}
                                    value={machineGlobalFilter ?? ""}
                                    onChange={(e) =>
                                        machineTable.setGlobalFilter(
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
                                    onClick={() =>
                                        router.push(
                                            `/${orgId}/settings/clients/create`
                                        )
                                    }
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t("createClient")}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto mt-9">
                            <Table>
                                <TableHeader>
                                    {machineTable
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
                                    {machineTable.getRowModel().rows?.length ? (
                                        machineTable
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
                                                colSpan={columns.length}
                                                className="h-24 text-center"
                                            >
                                                {t("noResults")}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="mt-4">
                            <DataTablePagination
                                table={machineTable}
                                onPageSizeChange={setMachinePageSize}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
