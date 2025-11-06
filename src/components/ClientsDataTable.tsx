"use client";

import {
    ColumnDef,
} from "@tanstack/react-table";
import { DataTable } from "@app/components/ui/data-table";

type TabFilter = {
    id: string;
    label: string;
    filterFn: (row: any) => boolean;
};

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    onRefresh?: () => void;
    isRefreshing?: boolean;
    addClient?: () => void;
    columnVisibility?: Record<string, boolean>;
    enableColumnVisibility?: boolean;
    hideHeader?: boolean;
    tabs?: TabFilter[];
    defaultTab?: string;
}

export function ClientsDataTable<TData, TValue>({
    columns,
    data,
    addClient,
    onRefresh,
    isRefreshing,
    columnVisibility,
    enableColumnVisibility,
    hideHeader = false,
    tabs,
    defaultTab
}: DataTableProps<TData, TValue>) {
    return (
        <DataTable
            columns={columns}
            data={data || []}
            persistPageSize="clients-table"
            title={hideHeader ? undefined : "Clients"}
            searchPlaceholder="Search clients..."
            searchColumn="name"
            onAdd={hideHeader ? undefined : addClient}
            onRefresh={hideHeader ? undefined : onRefresh}
            isRefreshing={isRefreshing}
            addButtonText={hideHeader ? undefined : "Add Client"}
            columnVisibility={columnVisibility}
            enableColumnVisibility={enableColumnVisibility}
            tabs={tabs}
            defaultTab={defaultTab}
        />
    );
}
