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

export type CreateBlueprintFormProps = {};

export default function CreateBlueprintForm({}: CreateBlueprintFormProps) {
    const t = useTranslations();

    const [, formAction, isSubmitting] = useActionState(onSubmit, null);

    const baseForm = useForm({
        resolver: zodResolver(
            z.object({
                name: z.string().min(1).max(255),
                contents: z.string()
            })
        ),
        defaultValues: {
            name: "",
            contents: `proxy-resources:
    resource-nice-id-uno:
        name: this is my resource
        protocol: http
        full-domain: duce.test.example.com
        host-header: example.com
        tls-server-name: example.com
`
        }
    });

    async function onSubmit() {
        // setCreateLoading(true);
        // const baseData = baseForm.getValues();
        // const isHttp = baseData.http;
        // try {
        //     const payload = {
        //         name: baseData.name,
        //         http: baseData.http,
        //     };
        //     let sanitizedSubdomain: string | undefined;
        //     if (isHttp) {
        //         const httpData = httpForm.getValues();
        //         sanitizedSubdomain = httpData.subdomain
        //             ? finalizeSubdomainSanitize(httpData.subdomain)
        //             : undefined;
        //         Object.assign(payload, {
        //             subdomain: sanitizedSubdomain
        //                 ? toASCII(sanitizedSubdomain)
        //                 : undefined,
        //             domainId: httpData.domainId,
        //             protocol: "tcp"
        //         });
        //     } else {
        //         const tcpUdpData = tcpUdpForm.getValues();
        //         Object.assign(payload, {
        //             protocol: tcpUdpData.protocol,
        //             proxyPort: tcpUdpData.proxyPort
        //             // enableProxy: tcpUdpData.enableProxy
        //         });
        //     }
        //     const res = await api
        //         .put<
        //             AxiosResponse<Resource>
        //         >(`/org/${orgId}/resource/`, payload)
        //         .catch((e) => {
        //             toast({
        //                 variant: "destructive",
        //                 title: t("resourceErrorCreate"),
        //                 description: formatAxiosError(
        //                     e,
        //                     t("resourceErrorCreateDescription")
        //                 )
        //             });
        //         });
        //     if (res && res.status === 201) {
        //         const id = res.data.data.resourceId;
        //         const niceId = res.data.data.niceId;
        //         setNiceId(niceId);
        //         // Create targets if any exist
        //         if (targets.length > 0) {
        //             try {
        //                 for (const target of targets) {
        //                     const data: any = {
        //                         ip: target.ip,
        //                         port: target.port,
        //                         method: target.method,
        //                         enabled: target.enabled,
        //                         siteId: target.siteId,
        //                         hcEnabled: target.hcEnabled,
        //                         hcPath: target.hcPath || null,
        //                         hcMethod: target.hcMethod || null,
        //                         hcInterval: target.hcInterval || null,
        //                         hcTimeout: target.hcTimeout || null,
        //                         hcHeaders: target.hcHeaders || null,
        //                         hcScheme: target.hcScheme || null,
        //                         hcHostname: target.hcHostname || null,
        //                         hcPort: target.hcPort || null,
        //                         hcFollowRedirects:
        //                             target.hcFollowRedirects || null,
        //                         hcStatus: target.hcStatus || null
        //                     };
        //                     // Only include path-related fields for HTTP resources
        //                     if (isHttp) {
        //                         data.path = target.path;
        //                         data.pathMatchType = target.pathMatchType;
        //                         data.rewritePath = target.rewritePath;
        //                         data.rewritePathType = target.rewritePathType;
        //                         data.priority = target.priority;
        //                     }
        //                     await api.put(`/resource/${id}/target`, data);
        //                 }
        //             } catch (targetError) {
        //                 console.error("Error creating targets:", targetError);
        //                 toast({
        //                     variant: "destructive",
        //                     title: t("targetErrorCreate"),
        //                     description: formatAxiosError(
        //                         targetError,
        //                         t("targetErrorCreateDescription")
        //                     )
        //                 });
        //             }
        //         }
        //         if (isHttp) {
        //             router.push(`/${orgId}/settings/resources/${niceId}`);
        //         } else {
        //             const tcpUdpData = tcpUdpForm.getValues();
        //             // Only show config snippets if enableProxy is explicitly true
        //             // if (tcpUdpData.enableProxy === true) {
        //             setShowSnippets(true);
        //             router.refresh();
        //             // } else {
        //             //     // If enableProxy is false or undefined, go directly to resource page
        //             //     router.push(`/${orgId}/settings/resources/${id}`);
        //             // }
        //         }
        //     }
        // } catch (e) {
        //     console.error(t("resourceErrorCreateMessage"), e);
        //     toast({
        //         variant: "destructive",
        //         title: t("resourceErrorCreate"),
        //         description: t("resourceErrorCreateMessageDescription")
        //     });
        // }
        // setCreateLoading(false);
    }
    return (
        <Form {...baseForm}>
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
                                    control={baseForm.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("name")}</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                            <FormDescription>
                                                {t("blueprintNameDescription")}
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                            </SettingsSectionForm>
                        </SettingsSectionBody>
                    </SettingsSection>

                    <SettingsSection>
                        <SettingsSectionHeader>
                            <SettingsSectionTitle>
                                {t("contents")}
                            </SettingsSectionTitle>
                            <SettingsSectionDescription>
                                {t("blueprintContentsDescription")}
                            </SettingsSectionDescription>
                        </SettingsSectionHeader>
                        <SettingsSectionBody>
                            <div
                                className={cn(
                                    "resize-y h-52 min-h-52 overflow-y-auto overflow-x-clip max-w-full"
                                    // "w-[80dvw] sm:w-[88dvw] md:w-[82dvw] lg:w-[70dvw] xl:w-[855px]"
                                )}
                            >
                                <Editor
                                    className="w-full h-full max-w-full"
                                    language="yaml"
                                    // value={changedContents}
                                    theme="vs-dark"
                                    options={{
                                        minimap: {
                                            enabled: false
                                        }
                                    }}
                                    // onChange={(value) => setChangedContents(value ?? "")}
                                />

                                <textarea name="" id="" hidden />
                            </div>
                        </SettingsSectionBody>
                    </SettingsSection>

                    <div className="flex justify-end space-x-2 mt-8">
                        <Button
                            type="submit"
                            // onClick={async () => {
                            //     // const isHttp = baseForm.watch("http");
                            //     // const baseValid = await baseForm.trigger();
                            //     // const settingsValid = isHttp
                            //     //     ? await httpForm.trigger()
                            //     //     : await tcpUdpForm.trigger();
                            //     // console.log(httpForm.getValues());
                            //     // if (baseValid && settingsValid) {
                            //     //     onSubmit();
                            //     // }
                            // }}
                            loading={isSubmitting}
                            // disabled={!areAllTargetsValid()}
                        >
                            {t("resourceCreate")}
                        </Button>
                    </div>
                </SettingsContainer>
            </form>
        </Form>
    );
}
