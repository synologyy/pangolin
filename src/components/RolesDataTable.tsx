"use client";

import {
    ColumnDef,
} from "@tanstack/react-table";
import { DataTable } from "@app/components/ui/data-table";
import { useTranslations } from 'next-intl';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    createRole?: () => void;
}

export function RolesDataTable<TData, TValue>({
    columns,
    data,
    createRole
}: DataTableProps<TData, TValue>) {

    const t = useTranslations();

    return (
        <DataTable
            columns={columns}
            data={data}
            persistPageSize="roles-table"
            title={t('roles')}
            searchPlaceholder={t('accessRolesSearch')}
            searchColumn="name"
            onAdd={createRole}
            addButtonText={t('accessRolesAdd')}
        />
    );
}
