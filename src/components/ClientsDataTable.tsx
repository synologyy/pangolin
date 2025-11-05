"use client";

import {
    ColumnDef,
} from "@tanstack/react-table";
import { DataTable } from "@app/components/ui/data-table";

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    onRefresh?: () => void;
    isRefreshing?: boolean;
    addClient?: () => void;
    columnVisibility?: Record<string, boolean>;
    enableColumnVisibility?: boolean;
}

export function ClientsDataTable<TData, TValue>({
    columns,
    data,
    addClient,
    onRefresh,
    isRefreshing,
    columnVisibility,
    enableColumnVisibility
}: DataTableProps<TData, TValue>) {
    return (
        <DataTable
            columns={columns}
            data={data}
            persistPageSize="clients-table"
            title="Clients"
            searchPlaceholder="Search clients..."
            searchColumn="name"
            onAdd={addClient}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            addButtonText="Add Client"
            columnVisibility={columnVisibility}
            enableColumnVisibility={enableColumnVisibility}
        />
    );
}
