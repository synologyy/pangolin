"use client";

import { useEffect, useState } from "react";
import { Button } from "@app/components/ui/button";
import { Input } from "@app/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@app/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
    Credenza,
    CredenzaBody,
    CredenzaClose,
    CredenzaContent,
    CredenzaDescription,
    CredenzaFooter,
    CredenzaHeader,
    CredenzaTitle
} from "@app/components/Credenza";
import { toast } from "@app/hooks/useToast";
import { useTranslations } from "next-intl";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { Separator } from "@app/components/ui/separator";

type InternalResourceData = {
    id: number;
    name: string;
    orgId: string;
    siteName: string;
    protocol: string;
    proxyPort: number | null;
    siteId: number;
    destinationIp?: string;
    destinationPort?: number;
};

type EditInternalResourceDialogProps = {
    open: boolean;
    setOpen: (val: boolean) => void;
    resource: InternalResourceData;
    orgId: string;
    onSuccess?: () => void;
};

export default function EditInternalResourceDialog({
    open,
    setOpen,
    resource,
    orgId,
    onSuccess
}: EditInternalResourceDialogProps) {
    const t = useTranslations();
    const api = createApiClient(useEnvContext());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const formSchema = z.object({
        name: z.string().min(1, t("editInternalResourceDialogNameRequired")).max(255, t("editInternalResourceDialogNameMaxLength")),
        protocol: z.enum(["tcp", "udp"]),
        proxyPort: z.number().int().positive().min(1, t("editInternalResourceDialogProxyPortMin")).max(65535, t("editInternalResourceDialogProxyPortMax")),
        destinationIp: z.string(),
        destinationPort: z.number().int().positive().min(1, t("editInternalResourceDialogDestinationPortMin")).max(65535, t("editInternalResourceDialogDestinationPortMax"))
    });

    type FormData = z.infer<typeof formSchema>;

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: resource.name,
            protocol: resource.protocol as "tcp" | "udp",
            proxyPort: resource.proxyPort || undefined,
            destinationIp: resource.destinationIp || "",
            destinationPort: resource.destinationPort || undefined
        }
    });

    useEffect(() => {
        if (open) {
            form.reset({
                name: resource.name,
                protocol: resource.protocol as "tcp" | "udp",
                proxyPort: resource.proxyPort || undefined,
                destinationIp: resource.destinationIp || "",
                destinationPort: resource.destinationPort || undefined
            });
        }
    }, [open, resource, form]);

    const handleSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            // Update the site resource
            await api.post(`/org/${orgId}/site/${resource.siteId}/resource/${resource.id}`, {
                name: data.name,
                protocol: data.protocol,
                proxyPort: data.proxyPort,
                destinationIp: data.destinationIp,
                destinationPort: data.destinationPort
            });

            toast({
                title: t("editInternalResourceDialogSuccess"),
                description: t("editInternalResourceDialogInternalResourceUpdatedSuccessfully"),
                variant: "default"
            });

            onSuccess?.();
            setOpen(false);
        } catch (error) {
            console.error("Error updating internal resource:", error);
            toast({
                title: t("editInternalResourceDialogError"),
                description: formatAxiosError(error, t("editInternalResourceDialogFailedToUpdateInternalResource")),
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Credenza open={open} onOpenChange={setOpen}>
            <CredenzaContent className="max-w-2xl">
                <CredenzaHeader>
                    <CredenzaTitle>{t("editInternalResourceDialogEditClientResource")}</CredenzaTitle>
                    <CredenzaDescription>
                        {t("editInternalResourceDialogUpdateResourceProperties", { resourceName: resource.name })}
                    </CredenzaDescription>
                </CredenzaHeader>
                <CredenzaBody>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6" id="edit-internal-resource-form">
                            {/* Resource Properties Form */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">{t("editInternalResourceDialogResourceProperties")}</h3>
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t("editInternalResourceDialogName")}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="protocol"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t("editInternalResourceDialogProtocol")}</FormLabel>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="tcp">TCP</SelectItem>
                                                            <SelectItem value="udp">UDP</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="proxyPort"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t("editInternalResourceDialogSitePort")}</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            {...field}
                                                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Target Configuration Form */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">{t("editInternalResourceDialogTargetConfiguration")}</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="destinationIp"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t("targetAddr")}</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="destinationPort"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t("targetPort")}</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            {...field}
                                                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        </form>
                    </Form>
                </CredenzaBody>
                <CredenzaFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={isSubmitting}
                    >
                        {t("editInternalResourceDialogCancel")}
                    </Button>
                    <Button
                        type="submit"
                        form="edit-internal-resource-form"
                        disabled={isSubmitting}
                        loading={isSubmitting}
                    >
                         {t("editInternalResourceDialogSaveResource")}
                    </Button>
                </CredenzaFooter>
            </CredenzaContent>
        </Credenza>
    );
}
