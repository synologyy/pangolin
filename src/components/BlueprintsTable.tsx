"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DomainsDataTable } from "@app/components/DomainsDataTable";
import { Button } from "@app/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { useState } from "react";
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

export type BlueprintRow = {
    blueprintId: number;
    source: string;
    succeeded: boolean;
    name: string;
};

type Props = {
    blueprints: BlueprintRow[];
};

export default function BlueprintsTable({ blueprints }: Props) {
    return <></>
}