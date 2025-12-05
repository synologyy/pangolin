"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@app/components/ui/data-table";
import { useTranslations } from "next-intl";

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    onAdd: () => void;
}

export function PolicyDataTable<TData, TValue>({
    columns,
    data,
    onAdd
}: DataTableProps<TData, TValue>) {

    const t = useTranslations();
    
    return (
        <DataTable
            columns={columns}
            data={data}
            persistPageSize="orgPolicies-table"
            title={t('orgPolicies')}
            searchPlaceholder={t('orgPoliciesSearch')}
            searchColumn="orgId"
            addButtonText={t('orgPoliciesAdd')}
            onAdd={onAdd}
            enableColumnVisibility={true}
            stickyLeftColumn="orgId"
            stickyRightColumn="actions"
        />
    );
}
