"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ExtendedColumnDef } from "@app/components/ui/data-table";
import { useTranslations } from "next-intl";
import { Badge } from "@app/components/ui/badge";
import { DNSRecordsDataTable } from "./DNSRecordsDataTable";
import CopyToClipboard from "@app/components/CopyToClipboard";

export type DNSRecordRow = {
    id: string;
    recordType: string; // "NS" | "CNAME" | "A" | "TXT"
    baseDomain: string | null;
    value: string;
    verified?: boolean;
};

type Props = {
    records: DNSRecordRow[];
    type: string | null;
};

export default function DNSRecordsTable({
    records,
    type
}: Props) {
    const t = useTranslations();

    const columns: ExtendedColumnDef<DNSRecordRow>[] = [
        {
            accessorKey: "baseDomain",
            friendlyName: t("recordName", { fallback: "Record name" }),
            header: ({ column }) => {
                return (
                    <div>{t("recordName", { fallback: "Record name" })}</div>
                );
            },
            cell: ({ row }) => {
                const baseDomain = row.original.baseDomain;
                return baseDomain ? (
                    <CopyToClipboard
                        text={baseDomain}
                        displayText={baseDomain}
                        isLink={false}
                    />
                ) : (
                    <div>-</div>
                );
            }
        },
        {
            accessorKey: "recordType",
            friendlyName: t("type"),
            header: ({ column }) => {
                return <div>{t("type")}</div>;
            },
            cell: ({ row }) => {
                const type = row.original.recordType;
                return <div className="">{type}</div>;
            }
        },
        {
            accessorKey: "ttl",
            friendlyName: t("TTL"),
            header: ({ column }) => {
                return <div>{t("TTL")}</div>;
            },
            cell: ({ row }) => {
                return <div>{t("auto")}</div>;
            }
        },
        {
            accessorKey: "value",
            friendlyName: t("value"),
            header: () => {
                return <div>{t("value")}</div>;
            },
            cell: ({ row }) => {
                const value = row.original.value;
                return (
                    <CopyToClipboard
                        text={value}
                        displayText={value}
                        isLink={false}
                    />
                );
            }
        },
        {
            accessorKey: "verified",
            friendlyName: t("status"),
            header: ({ column }) => {
                return <div>{t("status")}</div>;
            },
            cell: ({ row }) => {
                const verified = row.original.verified;
                return verified ? (
                    type === "wildcard" ? (
                        <Badge variant="outlinePrimary">
                            {t("manual", { fallback: "Manual" })}
                        </Badge>
                    ) : (
                        <Badge variant="green">{t("verified")}</Badge>
                    )
                ) : (
                    <Badge variant="yellow">
                        {t("pending", { fallback: "Pending" })}
                    </Badge>
                );
            }
        }
    ];

    return (
        <DNSRecordsDataTable
            columns={columns}
            data={records}
            type={type}
        />
    );
}
