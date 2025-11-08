"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ExtendedColumnDef } from "@app/components/ui/data-table";
import { Button } from "@app/components/ui/button";
import {
    ArrowRight,
    ArrowUpDown,
    Globe,
    Terminal,
    Webhook
} from "lucide-react";
import { useTransition } from "react";
import { Badge } from "@app/components/ui/badge";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DataTable } from "./ui/data-table";
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

    const columns: ExtendedColumnDef<BlueprintRow>[] = [
        {
            accessorKey: "createdAt",
            friendlyName: t("appliedAt"),
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
                        {new Date(
                            row.original.createdAt * 1000
                        ).toLocaleString()}
                    </time>
                );
            }
        },
        {
            accessorKey: "name",
            enableHiding: false,
            friendlyName: t("name"),
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
            friendlyName: t("source"),
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
            enableHiding: false,
            header: () => <span className="p-3"></span>,
            cell: ({ row }) => {
                return (
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            className="items-center"
                            asChild
                        >
                            <Link
                                href={`/${orgId}/settings/blueprints/${row.original.blueprintId}`}
                            >
                                View details{" "}
                                <ArrowRight className="size-4 flex-none" />
                            </Link>
                        </Button>
                    </div>
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
            enableColumnVisibility={true}
            stickyLeftColumn="name"
            stickyRightColumn="actions"
            onAdd={() => {
                router.push(`/${orgId}/settings/blueprints/create`);
            }}
            addButtonText={t("blueprintAdd")}
            onRefresh={() => {
                startTransition(() => router.refresh());
            }}
            isRefreshing={isRefreshing}
            defaultSort={{
                id: "createdAt",
                desc: true
            }}
        />
    );
}
