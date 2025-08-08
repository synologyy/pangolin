"use client";

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    SortingState,
    getSortedRowModel,
    ColumnFiltersState,
    getFilteredRowModel
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@app/components/ui/button";
import { useState } from "react";
import { Input } from "@app/components/ui/input";
import { DataTablePagination } from "@app/components/DataTablePagination";
import { Plus, Search, RefreshCw } from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@app/components/ui/card";
import { useTranslations } from "next-intl";

type DataTableProps<TData, TValue> = {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    title?: string;
    addButtonText?: string;
    onAdd?: () => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    searchPlaceholder?: string;
    searchColumn?: string;
    defaultSort?: {
        id: string;
        desc: boolean;
    };
};

export function DataTable<TData, TValue>({
    columns,
    data,
    title,
    addButtonText,
    onAdd,
    onRefresh,
    isRefreshing,
    searchPlaceholder = "Search...",
    searchColumn = "name",
    defaultSort
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>(
        defaultSort ? [defaultSort] : []
    );
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState<any>([]);
    const t = useTranslations();

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onGlobalFilterChange: setGlobalFilter,
        initialState: {
            pagination: {
                pageSize: 20,
                pageIndex: 0
            }
        },
        state: {
            sorting,
            columnFilters,
            globalFilter
        }
    });

    return (
        <div className="container mx-auto max-w-12xl">
            <Card>
                <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pb-4">
                    <div className="flex items-center w-full sm:max-w-sm sm:mr-2 relative">
                        <Input
                            placeholder={searchPlaceholder}
                            value={globalFilter ?? ""}
                            onChange={(e) =>
                                table.setGlobalFilter(String(e.target.value))
                            }
                            className="w-full pl-8"
                        />
                        <Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                        {onRefresh && (
                            <Button
                                variant="outline"
                                onClick={onRefresh}
                                disabled={isRefreshing}
                            >
                                <RefreshCw
                                    className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                                />
                                {t("refresh")}
                            </Button>
                        )}
                        {onAdd && addButtonText && (
                            <Button onClick={onAdd}>
                                <Plus className="mr-2 h-4 w-4" />
                                {addButtonText}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
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
                                    <TableRow
                                        key={row.id}
                                        data-state={
                                            row.getIsSelected() && "selected"
                                        }
                                    >
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
                                        No results found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <div className="mt-4">
                        <DataTablePagination table={table} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
