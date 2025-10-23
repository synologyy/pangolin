"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DomainsDataTable } from "@app/components/DomainsDataTable";
import { Button } from "@app/components/ui/button";
import { ArrowRight, ArrowUpDown, MoreHorizontal } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import Link from "next/link";
import { ListBlueprintsResponse } from "@server/routers/blueprints";

export type BlueprintRow = ListBlueprintsResponse['blueprints'][number]

type Props = {
    blueprints: BlueprintRow[];
    orgId: string;
};

export default function BlueprintsTable({ blueprints, orgId }: Props) {

    const t = useTranslations();

    const [isRefreshing, startTransition] = useTransition()
    const router = useRouter()


    const columns: ColumnDef<BlueprintRow>[] = [
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
                        <ArrowUpDown className="ml-2 h-4 w-4" />
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
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            // cell: ({ row }) => {
            //     const originalRow = row.original;
            //     if (
            //         originalRow.type == "newt" ||
            //         originalRow.type == "wireguard"
            //     ) {
            //         if (originalRow.online) {
            //             return (
            //                 <span className="text-green-500 flex items-center space-x-2">
            //                     <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            //                     <span>{t("online")}</span>
            //                 </span>
            //             );
            //         } else {
            //             return (
            //                 <span className="text-neutral-500 flex items-center space-x-2">
            //                     <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            //                     <span>{t("offline")}</span>
            //                 </span>
            //             );
            //         }
            //     } else {
            //         return <span>-</span>;
            //     }
            // }
        },
        // {
        //     accessorKey: "nice",
        //     header: ({ column }) => {
        //         return (
        //             <Button
        //                 variant="ghost"
        //                 onClick={() =>
        //                     column.toggleSorting(column.getIsSorted() === "asc")
        //                 }
        //                 className="hidden md:flex whitespace-nowrap"
        //             >
        //                 {t("site")}
        //                 <ArrowUpDown className="ml-2 h-4 w-4" />
        //             </Button>
        //         );
        //     },
        //     // cell: ({ row }) => {
        //     //     return (
        //     //         <div className="hidden md:block whitespace-nowrap">
        //     //             {row.original.nice}
        //     //         </div>
        //     //     );
        //     // }
        // },
        // {
        //     id: "actions",
        //     cell: ({ row }) => {
        //         const siteRow = row.original;
        //         return (
        //             <div className="flex items-center justify-end gap-2">
        //                 <DropdownMenu>
        //                     <DropdownMenuTrigger asChild>
        //                         <Button variant="ghost" className="h-8 w-8 p-0">
        //                             <span className="sr-only">Open menu</span>
        //                             <MoreHorizontal className="h-4 w-4" />
        //                         </Button>
        //                     </DropdownMenuTrigger>
        //                     <DropdownMenuContent align="end">
        //                         <Link
        //                             className="block w-full"
        //                              href="#"
        //                             // href={`/${siteRow.orgId}/settings/sites/${siteRow.nice}`}
        //                         >
        //                             <DropdownMenuItem>
        //                                 {t("viewSettings")}
        //                             </DropdownMenuItem>
        //                         </Link>
        //                         <DropdownMenuItem
        //                             onClick={() => {
        //                                 // setSelectedSite(siteRow);
        //                                 // setIsDeleteModalOpen(true);
        //                             }}
        //                         >
        //                             <span className="text-red-500">
        //                                 {t("delete")}
        //                             </span>
        //                         </DropdownMenuItem>
        //                     </DropdownMenuContent>
        //                 </DropdownMenu>

        //                 <Link
        //                     href="#"
        //                     // href={`/${siteRow.orgId}/settings/sites/${siteRow.nice}`}
        //                 >
        //                     <Button variant={"secondary"} size="sm">
        //                         {t("edit")}
        //                         <ArrowRight className="ml-2 w-4 h-4" />
        //                     </Button>
        //                 </Link>
        //             </div>
        //         );
        //     }
        // }
    ];

    return <DataTable
                columns={columns}
                data={blueprints}
                persistPageSize="blueprint-table"
                title={t('blueprints')}
                searchPlaceholder={t('searchBlueprintProgress')}
                searchColumn="name"
                onAdd={() => {
                    router.push(`/${orgId}/settings/blueprints/create`);
                }}
                addButtonText={t('blueprintAdd')}
                onRefresh={() => {
                    startTransition(() => router.refresh())
                }}
                isRefreshing={isRefreshing}
                defaultSort={{
                    id: "name",
                    desc: false
                }}
            />
}