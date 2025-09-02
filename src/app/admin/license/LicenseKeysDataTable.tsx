"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@app/components/ui/data-table";
import { Button } from "@app/components/ui/button";
import { Badge } from "@app/components/ui/badge";
import { LicenseKeyCache } from "@server/license/license";
import { ArrowUpDown } from "lucide-react";
import moment from "moment";
import CopyToClipboard from "@app/components/CopyToClipboard";
import { useTranslations } from "next-intl";

type LicenseKeysDataTableProps = {
    licenseKeys: LicenseKeyCache[];
    onDelete: (key: LicenseKeyCache) => void;
    onCreate: () => void;
};

function obfuscateLicenseKey(key: string): string {
    if (key.length <= 8) return key;
    const firstPart = key.substring(0, 4);
    const lastPart = key.substring(key.length - 4);
    return `${firstPart}••••••••••••••••••••${lastPart}`;
}

export function LicenseKeysDataTable({
    licenseKeys,
    onDelete,
    onCreate
}: LicenseKeysDataTableProps) {

    const t = useTranslations();

    const columns: ColumnDef<LicenseKeyCache>[] = [
        {
            accessorKey: "licenseKey",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t('licenseKey')}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const licenseKey = row.original.licenseKey;
                return (
                    <CopyToClipboard
                        text={licenseKey}
                        displayText={obfuscateLicenseKey(licenseKey)}
                    />
                );
            }
        },
        {
            accessorKey: "valid",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t('valid')}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                return row.original.valid ? t('yes') : t('no');
            }
        },
        {
            accessorKey: "type",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t('type')}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const type = row.original.type;
                const label =
                    type === "SITES" ? t('sitesAdditional') : t('licenseHost');
                const variant = type === "SITES" ? "secondary" : "default";
                return row.original.valid ? (
                    <Badge variant={variant}>{label}</Badge>
                ) : null;
            }
        },
        {
            accessorKey: "numSites",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t('numberOfSites')}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            }
        },
        {
            id: "delete",
            cell: ({ row }) => (
                <div className="flex items-center justify-end space-x-2">
                    <Button
                        variant="secondary"
                        onClick={() => onDelete(row.original)}
                    >
                        {t('delete')}
                    </Button>
                </div>
            )
        }
    ];

    return (
        <DataTable
            columns={columns}
            data={licenseKeys}
            persistPageSize="licenseKeys-table"
            title={t('licenseKeys')}
            searchPlaceholder={t('licenseKeySearch')}
            searchColumn="licenseKey"
            onAdd={onCreate}
            addButtonText={t('licenseKeyAdd')}
        />
    );
}
