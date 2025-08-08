"use client";

import {
    ColumnDef,
} from "@tanstack/react-table";
import { DataTable } from "@app/components/ui/data-table";

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    addClient?: () => void;
}

export function ClientsDataTable<TData, TValue>({
    columns,
    data,
    addClient
}: DataTableProps<TData, TValue>) {
    return (
        <DataTable
            columns={columns}
            data={data}
            title="Clients"
            searchPlaceholder="Search clients..."
            searchColumn="name"
            onAdd={addClient}
            addButtonText="Add Client"
        />
    );
}
