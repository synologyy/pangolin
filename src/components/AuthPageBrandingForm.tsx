"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@app/components/ui/form";
import {
    SettingsSection,
    SettingsSectionBody,
    SettingsSectionDescription,
    SettingsSectionForm,
    SettingsSectionHeader,
    SettingsSectionTitle
} from "./Settings";
import { useTranslations } from "next-intl";
import AuthPageSettings, {
    AuthPageSettingsRef
} from "./private/AuthPageSettings";
import type {
    GetLoginPageBrandingResponse,
    GetLoginPageResponse
} from "@server/routers/loginPage/types";
import { Input } from "./ui/input";
import { XIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { build } from "@server/build";

export type AuthPageCustomizationProps = {
    orgId: string;
    branding: GetLoginPageBrandingResponse | null;
};

const AuthPageFormSchema = z.object({
    logoUrl: z
        .string()
        .url()
        .refine(
            async (url) => {
                try {
                    const response = await fetch(url);
                    return (
                        response.status === 200 &&
                        (response.headers.get("content-type") ?? "").startsWith(
                            "image/"
                        )
                    );
                } catch (error) {
                    return false;
                }
            },
            {
                message: "Invalid logo URL, must be a valid image URL"
            }
        ),
    logoWidth: z.number().min(1),
    logoHeight: z.number().min(1),
    title: z.string(),
    subtitle: z.string().optional(),
    resourceTitle: z.string(),
    resourceSubtitle: z.string().optional()
});

export default function AuthPageBrandingForm({
    orgId,
    branding
}: AuthPageCustomizationProps) {
    const [, formAction, isSubmitting] = React.useActionState(onSubmit, null);
    const t = useTranslations();

    const form = useForm({
        resolver: zodResolver(AuthPageFormSchema),
        defaultValues: {
            logoUrl: branding?.logoUrl ?? "",
            logoWidth: branding?.logoWidth ?? 500,
            logoHeight: branding?.logoHeight ?? 500,
            title: branding?.title ?? `Log in to {{orgName}}`,
            subtitle: branding?.subtitle ?? `Log in to {{orgName}}`,
            resourceTitle:
                branding?.resourceTitle ??
                `Authenticate to access {{resourceName}}`,
            resourceSubtitle:
                branding?.resourceSubtitle ??
                `Choose your preferred authentication method for {{resourceName}}`
        }
    });

    async function onSubmit() {
        console.log({
            dirty: form.formState.isDirty
        });
        const isValid = await form.trigger();

        if (!isValid) return;
        // ...
    }

    return (
        <>
            <SettingsSection>
                <SettingsSectionHeader>
                    <SettingsSectionTitle>
                        {t("authPageBranding")}
                    </SettingsSectionTitle>
                    <SettingsSectionDescription>
                        {t("authPageBrandingDescription")}
                    </SettingsSectionDescription>
                </SettingsSectionHeader>

                <SettingsSectionBody>
                    <SettingsSectionForm>
                        <Form {...form}>
                            <form
                                action={formAction}
                                id="auth-page-branding-form"
                                className="flex flex-col gap-8 items-stretch"
                            >
                                <div className="grid md:grid-cols-5 gap-3 items-start">
                                    <FormField
                                        control={form.control}
                                        name="logoUrl"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-3">
                                                <FormLabel>
                                                    {t("brandingLogoURL")}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="md:col-span-2 flex gap-3  items-start">
                                        <FormField
                                            control={form.control}
                                            name="logoWidth"
                                            render={({ field }) => (
                                                <FormItem className="grow">
                                                    <FormLabel>
                                                        {t("brandingLogoWidth")}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <span className="self-center relative top-2.5">
                                            <XIcon className="text-muted-foreground size-4" />
                                        </span>

                                        <FormField
                                            control={form.control}
                                            name="logoWidth"
                                            render={({ field }) => (
                                                <FormItem className="grow">
                                                    <FormLabel>
                                                        {t(
                                                            "brandingLogoHeight"
                                                        )}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                <Separator />

                                <div className="flex flex-col gap-3">
                                    <FormField
                                        control={form.control}
                                        name="title"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-3">
                                                <FormLabel>
                                                    {t("brandingOrgTitle")}
                                                </FormLabel>
                                                <FormDescription>
                                                    {t(
                                                        "brandingOrgDescription",
                                                        {
                                                            orgName:
                                                                "{{orgName}}"
                                                        }
                                                    )}
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
                                        name="subtitle"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-3">
                                                <FormLabel>
                                                    {t("brandingOrgSubtitle")}
                                                </FormLabel>
                                                <FormDescription>
                                                    {t(
                                                        "brandingOrgDescription",
                                                        {
                                                            orgName:
                                                                "{{orgName}}"
                                                        }
                                                    )}
                                                </FormDescription>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Separator />

                                <div className="flex flex-col gap-3">
                                    <FormField
                                        control={form.control}
                                        name="resourceTitle"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-3">
                                                <FormLabel>
                                                    {t("brandingResourceTitle")}
                                                </FormLabel>
                                                <FormDescription>
                                                    {t(
                                                        "brandingResourceDescription",
                                                        {
                                                            resourceName:
                                                                "{{resourceName}}"
                                                        }
                                                    )}
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
                                        name="resourceSubtitle"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-3">
                                                <FormLabel>
                                                    {t(
                                                        "brandingResourceSubtitle"
                                                    )}
                                                </FormLabel>
                                                <FormDescription>
                                                    {t(
                                                        "brandingResourceDescription",
                                                        {
                                                            resourceName:
                                                                "{{resourceName}}"
                                                        }
                                                    )}
                                                </FormDescription>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </form>
                        </Form>
                    </SettingsSectionForm>
                </SettingsSectionBody>

                <div className="flex justify-end gap-2 mt-6">
                    {/* {branding && (
                          <Button
                        type="submit"
                        form="auth-page-branding-form"
                        loading={isSubmitting}
                        disabled={isSubmitting}
                    >
                        {t("saveSettings")}
                    </Button>
                    )} */}
                    <Button
                        type="submit"
                        form="auth-page-branding-form"
                        loading={isSubmitting}
                        disabled={isSubmitting}
                    >
                        {t("saveAuthPageBranding")}
                    </Button>
                </div>
            </SettingsSection>
        </>
    );
}
