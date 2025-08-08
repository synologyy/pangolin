"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ResourcesDataTable } from "./ResourcesDataTable";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@app/components/ui/dropdown-menu";
import { Button } from "@app/components/ui/button";
import {
    Copy,
    ArrowRight,
    ArrowUpDown,
    MoreHorizontal,
    Check,
    ArrowUpRight,
    ShieldOff,
    ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";
import { formatAxiosError } from "@app/lib/api";
import { toast } from "@app/hooks/useToast";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import CopyToClipboard from "@app/components/CopyToClipboard";
import { Switch } from "@app/components/ui/switch";
import { AxiosResponse } from "axios";
import { UpdateResourceResponse } from "@server/routers/resource";
import { useTranslations } from "next-intl";
import { InfoPopup } from "@app/components/ui/info-popup";
import { Badge } from "@app/components/ui/badge";

export type ResourceRow = {
    id: number;
    name: string;
    orgId: string;
    domain: string;
    site: string;
    siteId: string;
    authState: string;
    http: boolean;
    protocol: string;
    proxyPort: number | null;
    enabled: boolean;
    domainId?: string;
};

type ResourcesTableProps = {
    resources: ResourceRow[];
    orgId: string;
};

export default function SitesTable({ resources, orgId }: ResourcesTableProps) {
    const router = useRouter();
    const t = useTranslations();

    const api = createApiClient(useEnvContext());

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedResource, setSelectedResource] =
        useState<ResourceRow | null>();

    const deleteResource = (resourceId: number) => {
        api.delete(`/resource/${resourceId}`)
            .catch((e) => {
                console.error(t("resourceErrorDelte"), e);
                toast({
                    variant: "destructive",
                    title: t("resourceErrorDelte"),
                    description: formatAxiosError(e, t("resourceErrorDelte"))
                });
            })
            .then(() => {
                router.refresh();
                setIsDeleteModalOpen(false);
            });
    };

    async function toggleResourceEnabled(val: boolean, resourceId: number) {
        const res = await api
            .post<AxiosResponse<UpdateResourceResponse>>(
                `resource/${resourceId}`,
                {
                    enabled: val
                }
            )
            .catch((e) => {
                toast({
                    variant: "destructive",
                    title: t("resourcesErrorUpdate"),
                    description: formatAxiosError(
                        e,
                        t("resourcesErrorUpdateDescription")
                    )
                });
            });
    }

    const columns: ColumnDef<ResourceRow>[] = [
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
            accessorKey: "site",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t("site")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const resourceRow = row.original;
                return (
                    <Link
                        href={`/${resourceRow.orgId}/settings/sites/${resourceRow.siteId}`}
                    >
                        <Button variant="outline" size="sm">
                            {resourceRow.site}
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                );
            }
        },
        {
            accessorKey: "protocol",
            header: t("protocol"),
            cell: ({ row }) => {
                const resourceRow = row.original;
                return <span>{resourceRow.protocol.toUpperCase()}</span>;
            }
        },
        {
            accessorKey: "domain",
            header: t("access"),
            cell: ({ row }) => {
                const resourceRow = row.original;
                return (
                    <div className="flex items-center space-x-2">
                        {!resourceRow.http ? (
                            <CopyToClipboard
                                text={resourceRow.proxyPort!.toString()}
                                isLink={false}
                            />
                        ) : !resourceRow.domainId ? (
                            <InfoPopup
                                info={t("domainNotFoundDescription")}
                                text={t("domainNotFound")}
                            />
                        ) : (
                            <CopyToClipboard
                                text={resourceRow.domain}
                                isLink={true}
                            />
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: "authState",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t("authentication")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const resourceRow = row.original;
                return (
                    <div>
                        {resourceRow.authState === "protected" ? (
                            <span className="text-green-500 flex items-center space-x-2">
                                <ShieldCheck className="w-4 h-4" />
                                <span>{t("protected")}</span>
                            </span>
                        ) : resourceRow.authState === "not_protected" ? (
                            <span className="text-yellow-500 flex items-center space-x-2">
                                <ShieldOff className="w-4 h-4" />
                                <span>{t("notProtected")}</span>
                            </span>
                        ) : (
                            <span>-</span>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: "enabled",
            header: t("enabled"),
            cell: ({ row }) => (
                <Switch
                    defaultChecked={
                        row.original.http
                            ? (!!row.original.domainId && row.original.enabled)
                            : row.original.enabled
                    }
                    disabled={row.original.http ? !row.original.domainId : false}
                    onCheckedChange={(val) =>
                        toggleResourceEnabled(val, row.original.id)
                    }
                />
            )
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const resourceRow = row.original;
                return (
                    <div className="flex items-center justify-end">
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
                                <Link
                                    className="block w-full"
                                    href={`/${resourceRow.orgId}/settings/resources/${resourceRow.id}`}
                                >
                                    <DropdownMenuItem>
                                        {t("viewSettings")}
                                    </DropdownMenuItem>
                                </Link>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedResource(resourceRow);
                                        setIsDeleteModalOpen(true);
                                    }}
                                >
                                    <span className="text-red-500">
                                        {t("delete")}
                                    </span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Link
                            href={`/${resourceRow.orgId}/settings/resources/${resourceRow.id}`}
                        >
                            <Button
                                variant={"secondary"}
                                className="ml-2"
                                size="sm"
                            >
                                {t("edit")}
                                <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </Link>
                    </div>
                );
            }
        }
    ];

    return (
        <>
            {selectedResource && (
                <ConfirmDeleteDialog
                    open={isDeleteModalOpen}
                    setOpen={(val) => {
                        setIsDeleteModalOpen(val);
                        setSelectedResource(null);
                    }}
                    dialog={
                        <div>
                            <p className="mb-2">
                                {t("resourceQuestionRemove", {
                                    selectedResource:
                                        selectedResource?.name ||
                                        selectedResource?.id
                                })}
                            </p>

                            <p className="mb-2">{t("resourceMessageRemove")}</p>

                            <p>{t("resourceMessageConfirm")}</p>
                        </div>
                    }
                    buttonText={t("resourceDeleteConfirm")}
                    onConfirm={async () => deleteResource(selectedResource!.id)}
                    string={selectedResource.name}
                    title={t("resourceDelete")}
                />
            )}

            <ResourcesDataTable
                columns={columns}
                data={resources}
                createResource={() => {
                    router.push(`/${orgId}/settings/resources/create`);
                }}
            />
        </>
    );
}
