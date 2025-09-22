"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@app/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@app/components/ui/form";
import { Input } from "@app/components/ui/input";
import { useForm } from "react-hook-form";
import { toast } from "@app/hooks/useToast";
import { useRouter, useParams, redirect } from "next/navigation";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionHeader,
    SettingsSectionTitle,
    SettingsSectionDescription,
    SettingsSectionBody,
    SettingsSectionForm,
    SettingsSectionFooter,
    SettingsSectionGrid
} from "@app/components/Settings";
import { formatAxiosError } from "@app/lib/api";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useState, useEffect } from "react";
import { SwitchInput } from "@app/components/SwitchInput";
import { Alert, AlertDescription, AlertTitle } from "@app/components/ui/alert";
import { InfoIcon, ExternalLink } from "lucide-react";
import {
    InfoSection,
    InfoSectionContent,
    InfoSections,
    InfoSectionTitle
} from "@app/components/InfoSection";
import CopyToClipboard from "@app/components/CopyToClipboard";
import { Badge } from "@app/components/ui/badge";
import { useLicenseStatusContext } from "@app/hooks/useLicenseStatusContext";
import { useTranslations } from "next-intl";

export default function GeneralPage() {
    const { env } = useEnvContext();
    const api = createApiClient({ env });
    const router = useRouter();
    const { idpId } = useParams();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const { isUnlocked } = useLicenseStatusContext();

    const redirectUrl = `${env.app.dashboardUrl}/auth/idp/${idpId}/oidc/callback`;
    const t = useTranslations();

    const GeneralFormSchema = z.object({
        name: z.string().min(2, { message: t('nameMin', {len: 2}) }),
        clientId: z.string().min(1, { message: t('idpClientIdRequired') }),
        clientSecret: z.string().min(1, { message: t('idpClientSecretRequired') }),
        authUrl: z.string().url({ message: t('idpErrorAuthUrlInvalid') }),
        tokenUrl: z.string().url({ message: t('idpErrorTokenUrlInvalid') }),
        identifierPath: z
            .string()
            .min(1, { message: t('idpPathRequired') }),
        emailPath: z.string().optional(),
        namePath: z.string().optional(),
        scopes: z.string().min(1, { message: t('idpScopeRequired') }),
        autoProvision: z.boolean().default(false)
    });

    type GeneralFormValues = z.infer<typeof GeneralFormSchema>;

    const form = useForm({
        resolver: zodResolver(GeneralFormSchema),
        defaultValues: {
            name: "",
            clientId: "",
            clientSecret: "",
            authUrl: "",
            tokenUrl: "",
            identifierPath: "sub",
            emailPath: "email",
            namePath: "name",
            scopes: "openid profile email",
            autoProvision: true
        }
    });

    useEffect(() => {
        const loadIdp = async () => {
            try {
                const res = await api.get(`/idp/${idpId}`);
                if (res.status === 200) {
                    const data = res.data.data;
                    form.reset({
                        name: data.idp.name,
                        clientId: data.idpOidcConfig.clientId,
                        clientSecret: data.idpOidcConfig.clientSecret,
                        authUrl: data.idpOidcConfig.authUrl,
                        tokenUrl: data.idpOidcConfig.tokenUrl,
                        identifierPath: data.idpOidcConfig.identifierPath,
                        emailPath: data.idpOidcConfig.emailPath,
                        namePath: data.idpOidcConfig.namePath,
                        scopes: data.idpOidcConfig.scopes,
                        autoProvision: data.idp.autoProvision
                    });
                }
            } catch (e) {
                toast({
                    title: t('error'),
                    description: formatAxiosError(e),
                    variant: "destructive"
                });
                router.push("/admin/idp");
            } finally {
                setInitialLoading(false);
            }
        };

        loadIdp();
    }, [idpId, api, form, router]);

    async function onSubmit(data: GeneralFormValues) {
        setLoading(true);

        try {
            const payload = {
                name: data.name,
                clientId: data.clientId,
                clientSecret: data.clientSecret,
                authUrl: data.authUrl,
                tokenUrl: data.tokenUrl,
                identifierPath: data.identifierPath,
                emailPath: data.emailPath,
                namePath: data.namePath,
                autoProvision: data.autoProvision,
                scopes: data.scopes
            };

            const res = await api.post(`/idp/${idpId}/oidc`, payload);

            if (res.status === 200) {
                toast({
                    title: t('success'),
                    description: t('idpUpdatedDescription')
                });
                router.refresh();
            }
        } catch (e) {
            toast({
                title: t('error'),
                description: formatAxiosError(e),
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }

    if (initialLoading) {
        return null;
    }

    return (
        <>
            <SettingsContainer>
                <SettingsSection>
                    <SettingsSectionHeader>
                        <SettingsSectionTitle>
                            {t('idpTitle')}
                        </SettingsSectionTitle>
                        <SettingsSectionDescription>
                            {t('idpSettingsDescription')}
                        </SettingsSectionDescription>
                    </SettingsSectionHeader>
                    <SettingsSectionBody>
                        <InfoSections cols={3}>
                            <InfoSection>
                                <InfoSectionTitle>
                                    {t('redirectUrl')}
                                </InfoSectionTitle>
                                <InfoSectionContent>
                                    <CopyToClipboard text={redirectUrl} />
                                </InfoSectionContent>
                            </InfoSection>
                        </InfoSections>

                        <Alert variant="neutral" className="">
                            <InfoIcon className="h-4 w-4" />
                            <AlertTitle className="font-semibold">
                                {t('redirectUrlAbout')}
                            </AlertTitle>
                            <AlertDescription>
                                {t('redirectUrlAboutDescription')}
                            </AlertDescription>
                        </Alert>
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
                                                <FormLabel>{t('name')}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    {t('idpDisplayName')}
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="flex items-start mb-0">
                                        <SwitchInput
                                            id="auto-provision-toggle"
                                            label={t('idpAutoProvisionUsers')}
                                            defaultChecked={form.getValues(
                                                "autoProvision"
                                            )}
                                            onCheckedChange={(checked) => {
                                                form.setValue(
                                                    "autoProvision",
                                                    checked
                                                );
                                            }}
                                        />
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                        {t('idpAutoProvisionUsersDescription')}
                                    </span>
                                </form>
                            </Form>
                        </SettingsSectionForm>
                    </SettingsSectionBody>
                </SettingsSection>

                <SettingsSectionGrid cols={2}>
                    <SettingsSection>
                        <SettingsSectionHeader>
                            <SettingsSectionTitle>
                                {t('idpOidcConfigure')}
                            </SettingsSectionTitle>
                            <SettingsSectionDescription>
                                {t('idpOidcConfigureDescription')}
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
                                            name="clientId"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t('idpClientId')}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t('idpClientIdDescription')}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="clientSecret"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t('idpClientSecret')}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="password"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t('idpClientSecretDescription')}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="authUrl"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t('idpAuthUrl')}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t('idpAuthUrlDescription')}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="tokenUrl"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t('idpTokenUrl')}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t('idpTokenUrlDescription')}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </form>
                                </Form>
                            </SettingsSectionForm>
                        </SettingsSectionBody>
                    </SettingsSection>

                    <SettingsSection>
                        <SettingsSectionHeader>
                            <SettingsSectionTitle>
                                {t('idpToken')}
                            </SettingsSectionTitle>
                            <SettingsSectionDescription>
                                {t('idpTokenDescription')}
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
                                        <Alert variant="neutral">
                                            <InfoIcon className="h-4 w-4" />
                                            <AlertTitle className="font-semibold">
                                                {t('idpJmespathAbout')}
                                            </AlertTitle>
                                            <AlertDescription>
                                                {t('idpJmespathAboutDescription')}
                                                <a
                                                    href="https://jmespath.org"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline inline-flex items-center"
                                                >
                                                    {t('idpJmespathAboutDescriptionLink')}{" "}
                                                    <ExternalLink className="ml-1 h-4 w-4" />
                                                </a>
                                            </AlertDescription>
                                        </Alert>

                                        <FormField
                                            control={form.control}
                                            name="identifierPath"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t('idpJmespathLabel')}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t('idpJmespathLabelDescription')}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="emailPath"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t('idpJmespathEmailPathOptional')}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t('idpJmespathEmailPathOptionalDescription')}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="namePath"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t('idpJmespathNamePathOptional')}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t('idpJmespathNamePathOptionalDescription')}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="scopes"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t('idpOidcConfigureScopes')}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t('idpOidcConfigureScopesDescription')}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </form>
                                </Form>
                            </SettingsSectionForm>
                        </SettingsSectionBody>
                    </SettingsSection>
                </SettingsSectionGrid>
            </SettingsContainer>

            <div className="flex justify-end mt-8">
                <Button
                    type="submit"
                    form="general-settings-form"
                    loading={loading}
                    disabled={loading}
                >
                    {t('saveGeneralSettings')}
                </Button>
            </div>
        </>
    );
}
