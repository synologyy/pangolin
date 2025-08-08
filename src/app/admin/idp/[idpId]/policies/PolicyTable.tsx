"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@app/components/ui/button";
import {
    ArrowUpDown,
    Trash2,
    MoreHorizontal,
    Pencil,
    ArrowRight
} from "lucide-react";
import { PolicyDataTable } from "./PolicyDataTable";
import { Badge } from "@app/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@app/components/ui/dropdown-menu";
import Link from "next/link";
import { InfoPopup } from "@app/components/ui/info-popup";
import { useTranslations } from "next-intl";

export interface PolicyRow {
    orgId: string;
    roleMapping?: string;
    orgMapping?: string;
}

interface Props {
    policies: PolicyRow[];
    onDelete: (orgId: string) => void;
    onAdd: () => void;
    onEdit: (policy: PolicyRow) => void;
}

export default function PolicyTable({ policies, onDelete, onAdd, onEdit }: Props) {
    const t = useTranslations();
    const columns: ColumnDef<PolicyRow>[] = [
        {
            id: "dots",
            cell: ({ row }) => {
                const r = row.original;

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">{t('openMenu')}</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => {
                                    onDelete(r.orgId);
                                }}
                            >
                                <span className="text-red-500">{t('delete')}</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            }
        },
        {
            accessorKey: "orgId",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t('orgId')}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            }
        },
        {
            accessorKey: "roleMapping",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t('roleMapping')}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const mapping = row.original.roleMapping;
                return mapping ? (
                    <InfoPopup
                        text={mapping.length > 50 ? `${mapping.substring(0, 50)}...` : mapping}
                        info={mapping}
                    />
                ) : (
                    "--"
                );
            }
        },
        {
            accessorKey: "orgMapping",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t('orgMapping')}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const mapping = row.original.orgMapping;
                return mapping ? (
                    <InfoPopup
                        text={mapping.length > 50 ? `${mapping.substring(0, 50)}...` : mapping}
                        info={mapping}
                    />
                ) : (
                    "--"
                );
            }
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const policy = row.original;
                return (
                    <div className="flex items-center justify-end">
                        <Button
                            variant={"secondary"}
                            className="ml-2"
                            onClick={() => onEdit(policy)}
                        >
                            {t('edit')}
                        </Button>
                    </div>
                );
            }
        }
    ];

    return <PolicyDataTable columns={columns} data={policies} onAdd={onAdd} />;
}
