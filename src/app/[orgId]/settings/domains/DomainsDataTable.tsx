"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@app/components/ui/data-table";
import { useTranslations } from "next-intl";

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    onAdd?: () => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

export function DomainsDataTable<TData, TValue>({
    columns,
    data,
    onAdd,
    onRefresh,
    isRefreshing
}: DataTableProps<TData, TValue>) {
    const t = useTranslations();

    return (
        <DataTable
            columns={columns}
            data={data}
            persistPageSize="domains-table"
            title={t("domains")}
            searchPlaceholder={t("domainsSearch")}
            searchColumn="baseDomain"
            addButtonText={t("domainAdd")}
            onAdd={onAdd}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
        />
    );
}
