import React from "react";
import { Separator } from "@/components/ui/separator";
import { CreateSiteForm } from "./components/CreateSite";
import { GeneralForm } from "./components/GeneralForm";

export default function SettingsProfilePage({
    params,
}: {
    params: { niceId: string };
}) {
    const isCreateForm = params.niceId === "create";

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">
                    {isCreateForm ? "Create Site" : "Profile"}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {isCreateForm
                        ? "Create a new site for your profile."
                        : "This is how others will see you on the site."}
                </p>
            </div>
            <Separator />

            {isCreateForm ? <CreateSiteForm /> : <GeneralForm />}
        </div>
    );
}
