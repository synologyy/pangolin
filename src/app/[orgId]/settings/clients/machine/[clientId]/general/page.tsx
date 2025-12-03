"use client";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionBody,
    SettingsSectionDescription,
    SettingsSectionFooter,
    SettingsSectionForm,
    SettingsSectionHeader,
    SettingsSectionTitle
} from "@app/components/Settings";
import { useClientContext } from "@app/hooks/useClientContext";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { toast } from "@app/hooks/useToast";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { ListSitesResponse } from "@server/routers/site";
import { AxiosResponse } from "axios";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const GeneralFormSchema = z.object({
    name: z.string().nonempty("Name is required")
});

type GeneralFormValues = z.infer<typeof GeneralFormSchema>;

export default function GeneralPage() {
    const t = useTranslations();
    const { client, updateClient } = useClientContext();
    const api = createApiClient(useEnvContext());
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(GeneralFormSchema),
        defaultValues: {
            name: client?.name
        },
        mode: "onChange"
    });

    // Fetch available sites and client's assigned sites
    useEffect(() => {
        const fetchSites = async () => {
            try {
                // Fetch all available sites
                const res = await api.get<AxiosResponse<ListSitesResponse>>(
                    `/org/${client?.orgId}/sites/`
                );
            } catch (e) {
                toast({
                    variant: "destructive",
                    title: "Failed to fetch sites",
                    description: formatAxiosError(
                        e,
                        "An error occurred while fetching sites."
                    )
                });
            }
        };

        if (client?.clientId) {
            fetchSites();
        }
    }, [client?.clientId, client?.orgId, api, form]);

    async function onSubmit(data: GeneralFormValues) {
        setLoading(true);

        try {
            await api.post(`/client/${client?.clientId}`, {
                name: data.name
            });

            updateClient({ name: data.name });

            toast({
                title: t("clientUpdated"),
                description: t("clientUpdatedDescription")
            });

            router.refresh();
        } catch (e) {
            toast({
                variant: "destructive",
                title: t("clientUpdateFailed"),
                description: formatAxiosError(e, t("clientUpdateError"))
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <SettingsContainer>
            <SettingsSection>
                <SettingsSectionHeader>
                    <SettingsSectionTitle>
                        {t("generalSettings")}
                    </SettingsSectionTitle>
                    <SettingsSectionDescription>
                        {t("generalSettingsDescription")}
                    </SettingsSectionDescription>
                </SettingsSectionHeader>

                <SettingsSectionBody>
                    <SettingsSectionForm>
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit)}
                                className="space-y-4"
                                id="general-settings-form"
                            >
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("name")}</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </form>
                        </Form>
                    </SettingsSectionForm>
                </SettingsSectionBody>

                <SettingsSectionFooter>
                    <Button
                        type="submit"
                        form="general-settings-form"
                        loading={loading}
                        disabled={loading}
                    >
                        {t("saveSettings")}
                    </Button>
                </SettingsSectionFooter>
            </SettingsSection>
        </SettingsContainer>
    );
}
