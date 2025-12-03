"use client";

import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";
import CopyToClipboard from "@app/components/CopyToClipboard";
import { DataTable } from "@app/components/ui/data-table";
import { ExtendedColumnDef } from "@app/components/ui/data-table";
import { Button } from "@app/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@app/components/ui/dropdown-menu";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { toast } from "@app/hooks/useToast";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import {
    ArrowUpDown,
    ArrowUpRight,
    MoreHorizontal
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import CreateInternalResourceDialog from "@app/components/CreateInternalResourceDialog";
import EditInternalResourceDialog from "@app/components/EditInternalResourceDialog";
import { orgQueries } from "@app/lib/queries";
import { useQuery } from "@tanstack/react-query";

export type TargetHealth = {
    targetId: number;
    ip: string;
    port: number;
    enabled: boolean;
    healthStatus?: "healthy" | "unhealthy" | "unknown";
};

export type ResourceRow = {
    id: number;
    nice: string | null;
    name: string;
    orgId: string;
    domain: string;
    authState: string;
    http: boolean;
    protocol: string;
    proxyPort: number | null;
    enabled: boolean;
    domainId?: string;
    ssl: boolean;
    targetHost?: string;
    targetPort?: number;
    targets?: TargetHealth[];
};

export type InternalResourceRow = {
    id: number;
    name: string;
    orgId: string;
    siteName: string;
    siteAddress: string | null;
    // mode: "host" | "cidr" | "port";
    mode: "host" | "cidr";
    // protocol: string | null;
    // proxyPort: number | null;
    siteId: number;
    siteNiceId: string;
    destination: string;
    // destinationPort: number | null;
    alias: string | null;
};

type ClientResourcesTableProps = {
    internalResources: InternalResourceRow[];
    orgId: string;
    defaultSort?: {
        id: string;
        desc: boolean;
    };
};

export default function ClientResourcesTable({
    internalResources,
    orgId,
    defaultSort
}: ClientResourcesTableProps) {
    const router = useRouter();
    const t = useTranslations();

    const { env } = useEnvContext();

    const api = createApiClient({ env });

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const [selectedInternalResource, setSelectedInternalResource] =
        useState<InternalResourceRow | null>();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingResource, setEditingResource] =
        useState<InternalResourceRow | null>();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    const { data: sites = [] } = useQuery(orgQueries.sites({ orgId }));

    const [isRefreshing, startTransition] = useTransition();

    const refreshData = () => {
        startTransition(() => {
            try {
                router.refresh();
            } catch (error) {
                toast({
                    title: t("error"),
                    description: t("refreshError"),
                    variant: "destructive"
                });
            }
        });
    };

    const deleteInternalResource = async (
        resourceId: number,
        siteId: number
    ) => {
        try {
            await api
                .delete(`/org/${orgId}/site/${siteId}/resource/${resourceId}`)
                .then(() => {
                    startTransition(() => {
                        router.refresh();
                        setIsDeleteModalOpen(false);
                    });
                });
        } catch (e) {
            console.error(t("resourceErrorDelete"), e);
            toast({
                variant: "destructive",
                title: t("resourceErrorDelte"),
                description: formatAxiosError(e, t("v"))
            });
        }
    };

    const internalColumns: ExtendedColumnDef<InternalResourceRow>[] = [
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
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            }
        },
        {
            accessorKey: "siteName",
            friendlyName: t("siteName"),
            header: () => <span className="p-3">{t("siteName")}</span>,
            cell: ({ row }) => {
                const resourceRow = row.original;
                return (
                    <Link
                        href={`/${resourceRow.orgId}/settings/sites/${resourceRow.siteNiceId}`}
                    >
                        <Button variant="outline">
                            {resourceRow.siteName}
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                );
            }
        },
        {
            accessorKey: "mode",
            friendlyName: t("editInternalResourceDialogMode"),
            header: () => (
                <span className="p-3">
                    {t("editInternalResourceDialogMode")}
                </span>
            ),
            cell: ({ row }) => {
                const resourceRow = row.original;
                const modeLabels: Record<"host" | "cidr" | "port", string> = {
                    host: t("editInternalResourceDialogModeHost"),
                    cidr: t("editInternalResourceDialogModeCidr"),
                    port: t("editInternalResourceDialogModePort")
                };
                return <span>{modeLabels[resourceRow.mode]}</span>;
            }
        },
        {
            accessorKey: "destination",
            friendlyName: t("resourcesTableDestination"),
            header: () => (
                <span className="p-3">{t("resourcesTableDestination")}</span>
            ),
            cell: ({ row }) => {
                const resourceRow = row.original;
                let displayText: string;
                let copyText: string;

                // if (
                //     resourceRow.mode === "port" &&
                //     // resourceRow.protocol &&
                //     // resourceRow.proxyPort &&
                //     // resourceRow.destinationPort
                // ) {
                //     // const protocol = resourceRow.protocol.toUpperCase();
                //     // For port mode: site part uses alias or site address, destination part uses destination IP
                //     // If site address has CIDR notation, extract just the IP address
                //     let siteAddress = resourceRow.siteAddress;
                //     if (siteAddress && siteAddress.includes("/")) {
                //         siteAddress = siteAddress.split("/")[0];
                //     }
                //     const siteDisplay = resourceRow.alias || siteAddress;
                //     // displayText = `${protocol} ${siteDisplay}:${resourceRow.proxyPort} -> ${resourceRow.destination}:${resourceRow.destinationPort}`;
                //     // copyText = `${siteDisplay}:${resourceRow.proxyPort}`;
                // } else if (resourceRow.mode === "host") {
                if (resourceRow.mode === "host") {
                    // For host mode: use alias if available, otherwise use destination
                    const destinationDisplay =
                        resourceRow.alias || resourceRow.destination;
                    displayText = destinationDisplay;
                    copyText = destinationDisplay;
                } else if (resourceRow.mode === "cidr") {
                    displayText = resourceRow.destination;
                    copyText = resourceRow.destination;
                } else {
                    const destinationDisplay =
                        resourceRow.alias || resourceRow.destination;
                    displayText = destinationDisplay;
                    copyText = destinationDisplay;
                }

                return (
                    <CopyToClipboard
                        text={copyText}
                        isLink={false}
                        displayText={displayText}
                    />
                );
            }
        },

        {
            id: "actions",
            enableHiding: false,
            header: () => <span className="p-3"></span>,
            cell: ({ row }) => {
                const resourceRow = row.original;
                return (
                    <div className="flex items-center gap-2 justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">
                                        {t("openMenu")}
                                    </span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedInternalResource(
                                            resourceRow
                                        );
                                        setIsDeleteModalOpen(true);
                                    }}
                                >
                                    <span className="text-red-500">
                                        {t("delete")}
                                    </span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            variant={"outline"}
                            onClick={() => {
                                setEditingResource(resourceRow);
                                setIsEditDialogOpen(true);
                            }}
                        >
                            {t("edit")}
                        </Button>
                    </div>
                );
            }
        }
    ];

    return (
        <>
            {selectedInternalResource && (
                <ConfirmDeleteDialog
                    open={isDeleteModalOpen}
                    setOpen={(val) => {
                        setIsDeleteModalOpen(val);
                        setSelectedInternalResource(null);
                    }}
                    dialog={
                        <div>
                            <p>{t("resourceQuestionRemove")}</p>
                            <p>{t("resourceMessageRemove")}</p>
                        </div>
                    }
                    buttonText={t("resourceDeleteConfirm")}
                    onConfirm={async () =>
                        deleteInternalResource(
                            selectedInternalResource!.id,
                            selectedInternalResource!.siteId
                        )
                    }
                    string={selectedInternalResource.name}
                    title={t("resourceDelete")}
                />
            )}

            <DataTable
                columns={internalColumns}
                data={internalResources}
                persistPageSize="internal-resources"
                searchPlaceholder={t("resourcesSearch")}
                searchColumn="name"
                onAdd={() => setIsCreateDialogOpen(true)}
                addButtonText={t("resourceAdd")}
                onRefresh={refreshData}
                isRefreshing={isRefreshing}
                defaultSort={defaultSort}
                enableColumnVisibility={true}
                persistColumnVisibility="internal-resources"
                stickyLeftColumn="name"
                stickyRightColumn="actions"
            />

            {editingResource && (
                <EditInternalResourceDialog
                    open={isEditDialogOpen}
                    setOpen={setIsEditDialogOpen}
                    resource={editingResource}
                    orgId={orgId}
                    onSuccess={() => {
                        router.refresh();
                        setEditingResource(null);
                    }}
                />
            )}

            <CreateInternalResourceDialog
                open={isCreateDialogOpen}
                setOpen={setIsCreateDialogOpen}
                orgId={orgId}
                sites={sites}
                onSuccess={() => {
                    router.refresh();
                }}
            />
        </>
    );
}
