"use client";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useResourceContext } from "@app/hooks/useResourceContext";
import { formatAxiosError } from "@app/lib/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
    Credenza,
    CredenzaBody,
    CredenzaClose,
    CredenzaContent,
    CredenzaDescription,
    CredenzaFooter,
    CredenzaHeader,
    CredenzaTitle
} from "@app/components/Credenza";
import DomainPicker from "@app/components/DomainPicker";
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
import { SwitchInput } from "@app/components/SwitchInput";
import { Label } from "@app/components/ui/label";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { toast } from "@app/hooks/useToast";
import { createApiClient } from "@app/lib/api";
import { finalizeSubdomainSanitize } from "@app/lib/subdomain-utils";
import { UpdateResourceResponse } from "@server/routers/resource";
import { AxiosResponse } from "axios";
import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { toASCII, toUnicode } from "punycode";
import { useActionState, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

export default function GeneralForm() {
    const params = useParams();
    const { resource, updateResource } = useResourceContext();
    const router = useRouter();
    const t = useTranslations();
    const [editDomainOpen, setEditDomainOpen] = useState(false);

    const { env } = useEnvContext();

    const orgId = params.orgId;

    const api = createApiClient({ env });

    const [resourceFullDomain, setResourceFullDomain] = useState(
        `${resource.ssl ? "https" : "http"}://${toUnicode(resource.fullDomain || "")}`
    );

    console.log({ resource });

    const [defaultSubdomain, defaultBaseDomain] = useMemo(() => {
        const resourceUrl = new URL(resourceFullDomain);
        const domain = resourceUrl.hostname;

        const allDomainParts = domain.split(".");
        let sub = undefined;
        let base = domain;

        if (allDomainParts.length >= 3) {
            // 3 parts: [subdomain, domain, tld]
            const [first, ...rest] = allDomainParts;
            sub = first;
            base = rest.join(".");
        }

        return [sub, base];
    }, [resourceFullDomain]);

    const [selectedDomain, setSelectedDomain] = useState<{
        domainId: string;
        subdomain?: string;
        fullDomain: string;
        baseDomain: string;
    } | null>(null);

    const GeneralFormSchema = z
        .object({
            enabled: z.boolean(),
            subdomain: z.string().optional(),
            name: z.string().min(1).max(255),
            niceId: z.string().min(1).max(255).optional(),
            domainId: z.string().optional(),
            proxyPort: z.int().min(1).max(65535).optional()
        })
        .refine(
            (data) => {
                // For non-HTTP resources, proxyPort should be defined
                if (!resource.http) {
                    return data.proxyPort !== undefined;
                }
                // For HTTP resources, proxyPort should be undefined
                return data.proxyPort === undefined;
            },
            {
                message: !resource.http
                    ? "Port number is required for non-HTTP resources"
                    : "Port number should not be set for HTTP resources",
                path: ["proxyPort"]
            }
        );

    const form = useForm({
        resolver: zodResolver(GeneralFormSchema),
        defaultValues: {
            enabled: resource.enabled,
            name: resource.name,
            niceId: resource.niceId,
            subdomain: resource.subdomain ? resource.subdomain : undefined,
            domainId: resource.domainId || undefined,
            proxyPort: resource.proxyPort || undefined
        },
        mode: "onChange"
    });

    const [, formAction, saveLoading] = useActionState(onSubmit, null);

    async function onSubmit() {
        const isValid = await form.trigger();
        if (!isValid) return;

        const data = form.getValues();

        const res = await api
            .post<AxiosResponse<UpdateResourceResponse>>(
                `resource/${resource?.resourceId}`,
                {
                    enabled: data.enabled,
                    name: data.name,
                    niceId: data.niceId,
                    subdomain: data.subdomain
                        ? toASCII(data.subdomain)
                        : undefined,
                    domainId: data.domainId,
                    proxyPort: data.proxyPort
                }
            )
            .catch((e) => {
                toast({
                    variant: "destructive",
                    title: t("resourceErrorUpdate"),
                    description: formatAxiosError(
                        e,
                        t("resourceErrorUpdateDescription")
                    )
                });
            });

        if (res && res.status === 200) {
            const updated = res.data.data;

            updateResource({
                enabled: data.enabled,
                name: data.name,
                niceId: data.niceId,
                subdomain: data.subdomain,
                fullDomain: updated.fullDomain,
                proxyPort: data.proxyPort
            });

            toast({
                title: t("resourceUpdated"),
                description: t("resourceUpdatedDescription")
            });

            if (data.niceId && data.niceId !== resource?.niceId) {
                router.replace(
                    `/${updated.orgId}/settings/resources/proxy/${data.niceId}/general`
                );
            }

            router.refresh();
        }
    }

    return (
        <>
            <SettingsContainer>
                <SettingsSection>
                    <SettingsSectionHeader>
                        <SettingsSectionTitle>
                            {t("resourceGeneral")}
                        </SettingsSectionTitle>
                        <SettingsSectionDescription>
                            {t("resourceGeneralDescription")}
                        </SettingsSectionDescription>
                    </SettingsSectionHeader>

                    <SettingsSectionBody>
                        <SettingsSectionForm>
                            <Form {...form}>
                                <form
                                    action={formAction}
                                    className="space-y-4"
                                    id="general-settings-form"
                                >
                                    <FormField
                                        control={form.control}
                                        name="enabled"
                                        render={() => (
                                            <FormItem className="col-span-2">
                                                <div className="flex items-center space-x-2">
                                                    <FormControl>
                                                        <SwitchInput
                                                            id="enable-resource"
                                                            defaultChecked={
                                                                resource.enabled
                                                            }
                                                            label={t(
                                                                "resourceEnable"
                                                            )}
                                                            onCheckedChange={(
                                                                val
                                                            ) =>
                                                                form.setValue(
                                                                    "enabled",
                                                                    val
                                                                )
                                                            }
                                                        />
                                                    </FormControl>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t("name")}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="niceId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t("identifier")}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        placeholder={t(
                                                            "enterIdentifier"
                                                        )}
                                                        className="flex-1"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {!resource.http && (
                                        <>
                                            <FormField
                                                control={form.control}
                                                name="proxyPort"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            {t(
                                                                "resourcePortNumber"
                                                            )}
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                value={
                                                                    field.value ??
                                                                    ""
                                                                }
                                                                onChange={(e) =>
                                                                    field.onChange(
                                                                        e.target
                                                                            .value
                                                                            ? parseInt(
                                                                                  e
                                                                                      .target
                                                                                      .value
                                                                              )
                                                                            : undefined
                                                                    )
                                                                }
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                        <FormDescription>
                                                            {t(
                                                                "resourcePortNumberDescription"
                                                            )}
                                                        </FormDescription>
                                                    </FormItem>
                                                )}
                                            />
                                        </>
                                    )}

                                    {resource.http && (
                                        <div className="space-y-2">
                                            <Label>{t("resourceDomain")}</Label>
                                            <div className="border p-2 rounded-md flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <Globe size="14" />
                                                    {resourceFullDomain}
                                                </span>
                                                <Button
                                                    variant="secondary"
                                                    type="button"
                                                    size="sm"
                                                    onClick={() =>
                                                        setEditDomainOpen(true)
                                                    }
                                                >
                                                    {t("resourceEditDomain")}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </form>
                            </Form>
                        </SettingsSectionForm>
                    </SettingsSectionBody>

                    <SettingsSectionFooter>
                        <Button
                            type="submit"
                            onClick={() => {
                                console.log(form.getValues());
                            }}
                            loading={saveLoading}
                            disabled={saveLoading}
                            form="general-settings-form"
                        >
                            {t("saveSettings")}
                        </Button>
                    </SettingsSectionFooter>
                </SettingsSection>
            </SettingsContainer>

            <Credenza
                open={editDomainOpen}
                onOpenChange={(setOpen) => setEditDomainOpen(setOpen)}
            >
                <CredenzaContent>
                    <CredenzaHeader>
                        <CredenzaTitle>Edit Domain</CredenzaTitle>
                        <CredenzaDescription>
                            Select a domain for your resource
                        </CredenzaDescription>
                    </CredenzaHeader>
                    <CredenzaBody>
                        <DomainPicker
                            orgId={orgId as string}
                            cols={1}
                            defaultSubdomain={defaultSubdomain}
                            defaultBaseDomain={defaultBaseDomain}
                            onDomainChange={(res) => {
                                const selected = {
                                    domainId: res.domainId,
                                    subdomain: res.subdomain,
                                    fullDomain: res.fullDomain,
                                    baseDomain: res.baseDomain
                                };
                                setSelectedDomain(selected);
                            }}
                        />
                    </CredenzaBody>
                    <CredenzaFooter>
                        <CredenzaClose asChild>
                            <Button variant="outline">{t("cancel")}</Button>
                        </CredenzaClose>
                        <Button
                            onClick={() => {
                                if (selectedDomain) {
                                    const sanitizedSubdomain =
                                        selectedDomain.subdomain
                                            ? finalizeSubdomainSanitize(
                                                  selectedDomain.subdomain
                                              )
                                            : "";

                                    const sanitizedFullDomain =
                                        sanitizedSubdomain
                                            ? `${sanitizedSubdomain}.${selectedDomain.baseDomain}`
                                            : selectedDomain.baseDomain;

                                    setResourceFullDomain(
                                        `${resource.ssl ? "https" : "http"}://${sanitizedFullDomain}`
                                    );
                                    form.setValue(
                                        "domainId",
                                        selectedDomain.domainId
                                    );
                                    form.setValue(
                                        "subdomain",
                                        sanitizedSubdomain
                                    );

                                    setEditDomainOpen(false);
                                }
                            }}
                        >
                            Select Domain
                        </Button>
                    </CredenzaFooter>
                </CredenzaContent>
            </Credenza>
        </>
    );
}
