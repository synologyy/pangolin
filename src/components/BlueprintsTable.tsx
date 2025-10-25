"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DomainsDataTable } from "@app/components/DomainsDataTable";
import { Button } from "@app/components/ui/button";
import {
    ArrowRight,
    ArrowUpDown,
    Globe,
    LucideIcon,
    MoreHorizontal,
    Terminal,
    Webhook
} from "lucide-react";
import { useState, useTransition } from "react";
import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";
import { formatAxiosError } from "@app/lib/api";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { Badge } from "@app/components/ui/badge";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import CreateDomainForm from "@app/components/CreateDomainForm";
import { useToast } from "@app/hooks/useToast";
import { useOrgContext } from "@app/hooks/useOrgContext";
import { DataTable } from "./ui/data-table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "./ui/dropdown-menu";
import Link from "next/link";
import { ListBlueprintsResponse } from "@server/routers/blueprints";

export type BlueprintRow = ListBlueprintsResponse["blueprints"][number];

type Props = {
    blueprints: BlueprintRow[];
    orgId: string;
};

export default function BlueprintsTable({ blueprints, orgId }: Props) {
    const t = useTranslations();

    const [isRefreshing, startTransition] = useTransition();
    const router = useRouter();

    const columns: ColumnDef<BlueprintRow>[] = [
        {
            accessorKey: "createdAt",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t("appliedAt")}
                        <ArrowUpDown className="ml-2 size-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                return (
                    <time
                        className="text-muted-foreground"
                        dateTime={row.original.createdAt.toString()}
                    >
                        {new Date(row.original.createdAt).toLocaleString()}
                    </time>
                );
            }
        },
        {
            accessorKey: "name",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t("name")}
                        <ArrowUpDown className="ml-2 size-4" />
                    </Button>
                );
            }
        },

        {
            accessorKey: "source",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t("source")}
                        <ArrowUpDown className="ml-2 size-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const originalRow = row.original;
                switch (originalRow.source) {
                    case "API": {
                        return (
                            <Badge variant="secondary">
                                <span className="inline-flex items-center gap-1 ">
                                    API
                                    <Webhook className="size-4 flex-none" />
                                </span>
                            </Badge>
                        );
                    }
                    case "NEWT": {
                        return (
                            <Badge variant="secondary">
                                <span className="inline-flex items-center gap-1 ">
                                    Newt CLI
                                    <Terminal className="size-4 flex-none" />
                                </span>
                            </Badge>
                        );
                    }
                    case "UI": {
                        return (
                            <Badge variant="secondary">
                                <span className="inline-flex items-center gap-1 ">
                                    Dashboard{" "}
                                    <Globe className="size-4 flex-none" />
                                </span>
                            </Badge>
                        );
                    }
                }
            }
        },
        {
            accessorKey: "succeeded",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t("status")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const { succeeded } = row.original;
                if (succeeded) {
                    return <Badge variant="green">{t("success")}</Badge>;
                } else {
                    return (
                        <Badge variant="red">
                            {t("failed", { fallback: "Failed" })}
                        </Badge>
                    );
                }
            }
        },
        {
            id: "actions",
            header: ({ column }) => {
                return (
                    <span className="text-muted-foreground p-3">
                        {t("actions")}
                    </span>
                );
            },
            cell: ({ row }) => {
                const domain = row.original;

                return (
                    <Button variant="outline" className="items-center" asChild>
                        <Link href={`#`}>
                            View details{" "}
                            <ArrowRight className="size-4 flex-none" />
                        </Link>
                    </Button>
                );
            }
        }
    ];

    return (
        <DataTable
            columns={columns}
            data={blueprints}
            persistPageSize="blueprint-table"
            title={t("blueprints")}
            searchPlaceholder={t("searchBlueprintProgress")}
            searchColumn="name"
            onAdd={() => {
                router.push(`/${orgId}/settings/blueprints/create`);
            }}
            addButtonText={t("blueprintAdd")}
            onRefresh={() => {
                startTransition(() => router.refresh());
            }}
            isRefreshing={isRefreshing}
            defaultSort={{
                id: "name",
                desc: false
            }}
        />
    );
}
