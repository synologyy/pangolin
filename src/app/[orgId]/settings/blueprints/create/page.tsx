import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { Button } from "@app/components/ui/button";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import CreateBlueprintForm from "@app/components/CreateBlueprintForm";

export interface CreateBlueprintPageProps {
    params: Promise<{ orgId: string }>;
}

export const metadata: Metadata = {
    title: "Create blueprint"
};

export default async function CreateBlueprintPage(
    props: CreateBlueprintPageProps
) {
    const t = await getTranslations();

    const orgId = (await props.params).orgId;

    return (
        <>
            <div className="flex flex-col gap-2 items-start">
                <Button variant="link" asChild className="gap-1 px-0">
                    <Link href={`/${orgId}/settings/blueprints`}>
                        <ArrowLeft className="size-4 flex-none" />{" "}
                        {t("blueprintGoBack")}
                    </Link>
                </Button>
                <SettingsSectionTitle
                    title={t("blueprintCreate")}
                    description={t("blueprintCreateDescription2")}
                />
            </div>

            <CreateBlueprintForm />
        </>
    );
}
