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
import { useEffect, useMemo, useState } from "react";
import { Input } from "@app/components/ui/input";
import { DataTablePagination } from "@app/components/DataTablePagination";
import { Plus, Search, RefreshCw, Filter, X, Download } from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@app/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@app/components/ui/tabs";
import { useTranslations } from "next-intl";
import { DateRangePicker, DateTimeValue } from "@app/components/DateTimePicker";

const STORAGE_KEYS = {
    PAGE_SIZE: "datatable-page-size",
    getTablePageSize: (tableId?: string) =>
        tableId ? `${tableId}-size` : STORAGE_KEYS.PAGE_SIZE
};

const getStoredPageSize = (tableId?: string, defaultSize = 20): number => {
    if (typeof window === "undefined") return defaultSize;

    try {
        const key = STORAGE_KEYS.getTablePageSize(tableId);
        const stored = localStorage.getItem(key);
        if (stored) {
            const parsed = parseInt(stored, 10);
            // Validate that it's a reasonable page size
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

type TabFilter = {
    id: string;
    label: string;
    filterFn: (row: any) => boolean;
};

type DataTableProps<TData, TValue> = {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    title?: string;
    addButtonText?: string;
    onRefresh?: () => void;
    onExport?: () => void;
    isExporting?: boolean;
    isRefreshing?: boolean;
    searchPlaceholder?: string;
    searchColumn?: string;
    defaultSort?: {
        id: string;
        desc: boolean;
    };
    tabs?: TabFilter[];
    defaultTab?: string;
    persistPageSize?: boolean | string;
    defaultPageSize?: number;
    onDateRangeChange?: (
        startDate: DateTimeValue,
        endDate: DateTimeValue
    ) => void;
    dateRange?: {
        start: DateTimeValue;
        end: DateTimeValue;
    };
    // Server-side pagination props
    totalCount?: number;
    currentPage?: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    isLoading?: boolean;
};

export function LogDataTable<TData, TValue>({
    columns,
    data,
    title,
    onRefresh,
    isRefreshing,
    onExport,
    isExporting,
    searchPlaceholder = "Search...",
    searchColumn = "name",
    defaultSort,
    tabs,
    defaultTab,
    persistPageSize = false,
    defaultPageSize = 20,
    onDateRangeChange,
    dateRange,
    totalCount,
    currentPage = 0,
    onPageChange,
    onPageSizeChange: onPageSizeChangeProp,
    isLoading = false
}: DataTableProps<TData, TValue>) {
    const t = useTranslations();

    // Determine table identifier for storage
    const tableId =
        typeof persistPageSize === "string" ? persistPageSize : undefined;

    // Initialize page size from storage or default
    const [pageSize, setPageSize] = useState<number>(() => {
        if (persistPageSize) {
            return getStoredPageSize(tableId, defaultPageSize);
        }
        return defaultPageSize;
    });

    const [sorting, setSorting] = useState<SortingState>(
        defaultSort ? [defaultSort] : []
    );
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState<any>([]);
    const [activeTab, setActiveTab] = useState<string>(
        defaultTab || tabs?.[0]?.id || ""
    );

    const [startDate, setStartDate] = useState<DateTimeValue>(
        dateRange?.start || {}
    );
    const [endDate, setEndDate] = useState<DateTimeValue>(dateRange?.end || {});

    // Sync internal date state with external dateRange prop
    useEffect(() => {
        if (dateRange?.start) {
            setStartDate(dateRange.start);
        }
        if (dateRange?.end) {
            setEndDate(dateRange.end);
        }
    }, [dateRange?.start, dateRange?.end]);

    // Apply tab filter to data
    const filteredData = useMemo(() => {
        if (!tabs || activeTab === "") {
            return data;
        }

        const activeTabFilter = tabs.find((tab) => tab.id === activeTab);
        if (!activeTabFilter) {
            return data;
        }

        return data.filter(activeTabFilter.filterFn);
    }, [data, tabs, activeTab]);

    // Determine if using server-side pagination
    const isServerPagination = totalCount !== undefined;

    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        // Only use client-side pagination if totalCount is not provided
        ...(isServerPagination ? {} : { getPaginationRowModel: getPaginationRowModel() }),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onGlobalFilterChange: setGlobalFilter,
        // Configure pagination state
        ...(isServerPagination ? {
            manualPagination: true,
            pageCount: totalCount ? Math.ceil(totalCount / pageSize) : 0,
        } : {}),
        initialState: {
            pagination: {
                pageSize: pageSize,
                pageIndex: currentPage
            }
        },
        state: {
            sorting,
            columnFilters,
            globalFilter,
            pagination: {
                pageSize: pageSize,
                pageIndex: currentPage
            }
        }
    });

    useEffect(() => {
        const currentPageSize = table.getState().pagination.pageSize;
        if (currentPageSize !== pageSize) {
            table.setPageSize(pageSize);

            // Persist to localStorage if enabled
            if (persistPageSize) {
                setStoredPageSize(pageSize, tableId);
            }
        }
    }, [pageSize, table, persistPageSize, tableId]);

    // Update table page index when currentPage prop changes (server pagination)
    useEffect(() => {
        if (isServerPagination) {
            const currentPageIndex = table.getState().pagination.pageIndex;
            if (currentPageIndex !== currentPage) {
                table.setPageIndex(currentPage);
            }
        }
    }, [currentPage, table, isServerPagination]);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        // Reset to first page when changing tabs
        table.setPageIndex(0);
    };

    // Enhanced pagination component that updates our local state
    const handlePageSizeChange = (newPageSize: number) => {
        setPageSize(newPageSize);
        table.setPageSize(newPageSize);

        // Persist immediately when changed
        if (persistPageSize) {
            setStoredPageSize(newPageSize, tableId);
        }

        // For server pagination, notify parent component
        if (isServerPagination && onPageSizeChangeProp) {
            onPageSizeChangeProp(newPageSize);
        }
    };

    // Handle page changes for server pagination
    const handlePageChange = (newPageIndex: number) => {
        if (isServerPagination && onPageChange) {
            onPageChange(newPageIndex);
        }
    };

    const handleDateRangeChange = (
        start: DateTimeValue,
        end: DateTimeValue
    ) => {
        setStartDate(start);
        setEndDate(end);
        onDateRangeChange?.(start, end);
    };

    return (
        <div className="container mx-auto max-w-12xl">
            <Card>
                <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pb-4">
                    <div className="flex flex-row items-start w-full sm:mr-2 gap-2">
                        <div className="relative w-full sm:max-w-sm">
                            <Input
                                placeholder={searchPlaceholder}
                                value={globalFilter ?? ""}
                                onChange={(e) =>
                                    table.setGlobalFilter(
                                        String(e.target.value)
                                    )
                                }
                                className="w-full pl-8 m-0"
                            />
                            <Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <DateRangePicker
                            startValue={startDate}
                            endValue={endDate}
                            onRangeChange={handleDateRangeChange}
                            className="flex-wrap gap-2"
                        />
                    </div>
                    <div className="flex items-start gap-2 sm:justify-end">
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
                        {onExport && (
                            <Button
                                onClick={onExport}
                                disabled={isExporting}
                            >
                                <Download
                                    className={`mr-2 h-4 w-4 ${isExporting ? "animate-spin" : ""}`}
                                />
                                {t("exportCsv")}
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
                        <DataTablePagination
                            table={table}
                            onPageSizeChange={handlePageSizeChange}
                            onPageChange={isServerPagination ? handlePageChange : undefined}
                            totalCount={totalCount}
                            isServerPagination={isServerPagination}
                            isLoading={isLoading}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
