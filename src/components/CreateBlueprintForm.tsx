"use client";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionBody,
    SettingsSectionDescription,
    SettingsSectionForm,
    SettingsSectionHeader,
    SettingsSectionTitle
} from "@app/components/Settings";
import { useTranslations } from "next-intl";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@app/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { useForm } from "react-hook-form";
import { Input } from "./ui/input";
import { useActionState, useTransition } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { cn } from "@app/lib/cn";
import { Button } from "./ui/button";
import { wait } from "@app/lib/wait";
import { parse as parseYaml } from "yaml";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { AxiosResponse } from "axios";
import type { CreateBlueprintResponse } from "@server/routers/blueprints";
import { toast } from "@app/hooks/useToast";

export type CreateBlueprintFormProps = {
    orgId: string;
};

export default function CreateBlueprintForm({
    orgId
}: CreateBlueprintFormProps) {
    const t = useTranslations();
    const { env } = useEnvContext();
    const api = createApiClient({ env });
    const [, formAction, isSubmitting] = useActionState(onSubmit, null);

    const form = useForm({
        resolver: zodResolver(
            z.object({
                name: z.string().min(1).max(255),
                contents: z
                    .string()
                    .min(1)
                    .superRefine((contents, ctx) => {
                        try {
                            parseYaml(contents);
                        } catch (error) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: `Invalid YAML: ${error instanceof Error ? error.message : "Unknown error"}`
                            });
                        }
                    })
            })
        ),
        defaultValues: {
            name: "",
            contents: `proxy-resources:
    resource-nice-id-uno:
        name: this is my resource
        protocol: http
        full-domain: never-gonna-give-you-up.example.com
        host-header: example.com
        tls-server-name: example.com
`
        }
    });

    async function onSubmit() {
        const isValid = await form.trigger();

        if (!isValid) return;

        const payload = form.getValues();
        console.log({
            isValid,
            payload
            // json: parse(data.contents)
        });
        const res = await api
            .put<
                AxiosResponse<CreateBlueprintResponse>
            >(`/org/${orgId}/blueprint/`, payload)
            .catch((e) => {
                toast({
                    variant: "destructive",
                    title: t("resourceErrorCreate"),
                    description: formatAxiosError(
                        e,
                        t("blueprintErrorCreateDescription")
                    )
                });
            });

        if (res && res.status === 201) {
            toast({
                variant: "default",
                title: "Success"
            });
            // const id = res.data.data.resourceId;
            // const niceId = res.data.data.niceId;
            // setNiceId(niceId);
            // // Create targets if any exist
            // if (targets.length > 0) {
            //     try {
            //         for (const target of targets) {
            //             const data: any = {
            //                 ip: target.ip,
            //                 port: target.port,
            //                 method: target.method,
            //                 enabled: target.enabled,
            //                 siteId: target.siteId,
            //                 hcEnabled: target.hcEnabled,
            //                 hcPath: target.hcPath || null,
            //                 hcMethod: target.hcMethod || null,
            //                 hcInterval: target.hcInterval || null,
            //                 hcTimeout: target.hcTimeout || null,
            //                 hcHeaders: target.hcHeaders || null,
            //                 hcScheme: target.hcScheme || null,
            //                 hcHostname: target.hcHostname || null,
            //                 hcPort: target.hcPort || null,
            //                 hcFollowRedirects: target.hcFollowRedirects || null,
            //                 hcStatus: target.hcStatus || null
            //             };
            //             // Only include path-related fields for HTTP resources
            //             if (isHttp) {
            //                 data.path = target.path;
            //                 data.pathMatchType = target.pathMatchType;
            //                 data.rewritePath = target.rewritePath;
            //                 data.rewritePathType = target.rewritePathType;
            //                 data.priority = target.priority;
            //             }
            //             await api.put(`/resource/${id}/target`, data);
            //         }
            //     } catch (targetError) {
            //         console.error("Error creating targets:", targetError);
            //         toast({
            //             variant: "destructive",
            //             title: t("targetErrorCreate"),
            //             description: formatAxiosError(
            //                 targetError,
            //                 t("targetErrorCreateDescription")
            //             )
            //         });
            //     }
            // }
            // if (isHttp) {
            //     router.push(`/${orgId}/settings/resources/${niceId}`);
            // } else {
            //     const tcpUdpData = tcpUdpForm.getValues();
            //     // Only show config snippets if enableProxy is explicitly true
            //     // if (tcpUdpData.enableProxy === true) {
            //     setShowSnippets(true);
            //     router.refresh();
            //     // } else {
            //     //     // If enableProxy is false or undefined, go directly to resource page
            //     //     router.push(`/${orgId}/settings/resources/${id}`);
            //     // }
            // }
        }
    }
    return (
        <Form {...form}>
            <form action={formAction} id="base-resource-form">
                <SettingsContainer>
                    <SettingsSection>
                        <SettingsSectionHeader>
                            <SettingsSectionTitle>
                                {t("blueprintInfo")}
                            </SettingsSectionTitle>
                        </SettingsSectionHeader>
                        <SettingsSectionBody>
                            <SettingsSectionForm>
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("name")}</FormLabel>
                                            <FormDescription>
                                                {t("blueprintNameDescription")}
                                            </FormDescription>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="contents"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                {t("contents")}
                                            </FormLabel>
                                            <FormDescription>
                                                {t(
                                                    "blueprintContentsDescription"
                                                )}
                                            </FormDescription>
                                            <FormControl>
                                                <div
                                                    className={cn(
                                                        "resize-y h-52 min-h-52 overflow-y-auto overflow-x-clip max-w-full"
                                                    )}
                                                >
                                                    <Editor
                                                        className="w-full h-full max-w-full"
                                                        language="yaml"
                                                        theme="vs-dark"
                                                        options={{
                                                            minimap: {
                                                                enabled: false
                                                            }
                                                        }}
                                                        {...field}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </SettingsSectionForm>
                        </SettingsSectionBody>
                    </SettingsSection>

                    <div className="flex justify-end space-x-2 mt-8">
                        <Button type="submit" loading={isSubmitting}>
                            {t("actionApplyBlueprint")}
                        </Button>
                    </div>
                </SettingsContainer>
            </form>
        </Form>
    );
}
