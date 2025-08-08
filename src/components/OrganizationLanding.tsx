"use client";

import { useState } from "react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useTranslations } from "next-intl";

interface Organization {
    id: string;
    name: string;
}

interface OrganizationLandingProps {
    organizations?: Organization[];
    disableCreateOrg?: boolean;
}

export default function OrganizationLanding({
    organizations = [],
    disableCreateOrg = false
}: OrganizationLandingProps) {
    const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

    const { env } = useEnvContext();

    const handleOrgClick = (orgId: string) => {
        setSelectedOrg(orgId);
    };

    const t = useTranslations();

    function getDescriptionText() {
        if (organizations.length === 0) {
            if (!disableCreateOrg) {
                return t("componentsErrorNoMemberCreate");
            } else {
                return t("componentsErrorNoMember");
            }
        }

        return t("componentsMember", { count: organizations.length });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("welcome")}</CardTitle>
                <CardDescription>{getDescriptionText()}</CardDescription>
            </CardHeader>
            <CardContent>
                {organizations.length === 0 ? (
                    !disableCreateOrg && (
                        <Link href="/setup">
                            <Button
                                className="w-full h-auto py-3 text-lg"
                                size="lg"
                            >
                                <Plus className="mr-2 h-5 w-5" />
                                {t("componentsCreateOrg")}
                            </Button>
                        </Link>
                    )
                ) : (
                    <ul className="space-y-2">
                        {organizations.map((org) => (
                            <li key={org.id}>
                                <Link href={`/${org.id}/settings`}>
                                    <Button
                                        variant="outline"
                                        className={`flex items-center justify-between w-full h-auto py-3 ${
                                            selectedOrg === org.id
                                                ? "ring-2 ring-primary"
                                                : ""
                                        }`}
                                    >
                                        <div className="truncate">
                                            {org.name}
                                        </div>
                                        <ArrowRight size={20} />
                                    </Button>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
