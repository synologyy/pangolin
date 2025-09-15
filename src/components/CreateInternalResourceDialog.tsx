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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@app/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@app/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { ListSitesResponse } from "@server/routers/site";
import { cn } from "@app/lib/cn";

type Site = ListSitesResponse["sites"][0];

type CreateInternalResourceDialogProps = {
    open: boolean;
    setOpen: (val: boolean) => void;
    orgId: string;
    sites: Site[];
    onSuccess?: () => void;
};

export default function CreateInternalResourceDialog({
    open,
    setOpen,
    orgId,
    sites,
    onSuccess
}: CreateInternalResourceDialogProps) {
    const t = useTranslations();
    const api = createApiClient(useEnvContext());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const formSchema = z.object({
        name: z
            .string()
            .min(1, t("createInternalResourceDialogNameRequired"))
            .max(255, t("createInternalResourceDialogNameMaxLength")),
        siteId: z.number().int().positive(t("createInternalResourceDialogPleaseSelectSite")),
        protocol: z.enum(["tcp", "udp"]),
        proxyPort: z
            .number()
            .int()
            .positive()
            .min(1, t("createInternalResourceDialogProxyPortMin"))
            .max(65535, t("createInternalResourceDialogProxyPortMax")),
        destinationIp: z.string(),
        destinationPort: z
            .number()
            .int()
            .positive()
            .min(1, t("createInternalResourceDialogDestinationPortMin"))
            .max(65535, t("createInternalResourceDialogDestinationPortMax"))
    });
    
    type FormData = z.infer<typeof formSchema>;

    const availableSites = sites.filter(
        (site) => site.type === "newt" && site.subnet
    );

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            siteId: availableSites[0]?.siteId || 0,
            protocol: "tcp",
            proxyPort: undefined,
            destinationIp: "",
            destinationPort: undefined
        }
    });

    useEffect(() => {
        if (open && availableSites.length > 0) {
            form.reset({
                name: "",
                siteId: availableSites[0].siteId,
                protocol: "tcp",
                proxyPort: undefined,
                destinationIp: "",
                destinationPort: undefined
            });
        }
    }, [open]);

    const handleSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            await api.put(`/org/${orgId}/site/${data.siteId}/resource`, {
                name: data.name,
                protocol: data.protocol,
                proxyPort: data.proxyPort,
                destinationIp: data.destinationIp,
                destinationPort: data.destinationPort,
                enabled: true
            });

            toast({
                title: t("createInternalResourceDialogSuccess"),
                description: t("createInternalResourceDialogInternalResourceCreatedSuccessfully"),
                variant: "default"
            });

            onSuccess?.();
            setOpen(false);
        } catch (error) {
            console.error("Error creating internal resource:", error);
            toast({
                title: t("createInternalResourceDialogError"),
                description: formatAxiosError(
                    error,
                    t("createInternalResourceDialogFailedToCreateInternalResource")
                ),
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (availableSites.length === 0) {
        return (
            <Credenza open={open} onOpenChange={setOpen}>
                <CredenzaContent className="max-w-md">
                    <CredenzaHeader>
                        <CredenzaTitle>{t("createInternalResourceDialogNoSitesAvailable")}</CredenzaTitle>
                        <CredenzaDescription>
                            {t("createInternalResourceDialogNoSitesAvailableDescription")}
                        </CredenzaDescription>
                    </CredenzaHeader>
                    <CredenzaFooter>
                        <Button onClick={() => setOpen(false)}>{t("createInternalResourceDialogClose")}</Button>
                    </CredenzaFooter>
                </CredenzaContent>
            </Credenza>
        );
    }

    return (
        <Credenza open={open} onOpenChange={setOpen}>
            <CredenzaContent className="max-w-2xl">
                <CredenzaHeader>
                    <CredenzaTitle>{t("createInternalResourceDialogCreateClientResource")}</CredenzaTitle>
                    <CredenzaDescription>
                        {t("createInternalResourceDialogCreateClientResourceDescription")}
                    </CredenzaDescription>
                </CredenzaHeader>
                <CredenzaBody>
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(handleSubmit)}
                            className="space-y-6"
                            id="create-internal-resource-form"
                        >
                            {/* Resource Properties Form */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">
                                    {t("createInternalResourceDialogResourceProperties")}
                                </h3>
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t("createInternalResourceDialogName")}</FormLabel>
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
                                            name="siteId"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>{t("createInternalResourceDialogSite")}</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    className={cn(
                                                                        "w-full justify-between",
                                                                        !field.value && "text-muted-foreground"
                                                                    )}
                                                                >
                                                                    {field.value
                                                                        ? availableSites.find(
                                                                              (site) => site.siteId === field.value
                                                                          )?.name
                                                                        : t("createInternalResourceDialogSelectSite")}
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-full p-0">
                                                            <Command>
                                                                <CommandInput placeholder={t("createInternalResourceDialogSearchSites")} />
                                                                <CommandList>
                                                                    <CommandEmpty>{t("createInternalResourceDialogNoSitesFound")}</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {availableSites.map((site) => (
                                                                            <CommandItem
                                                                                key={site.siteId}
                                                                                value={site.name}
                                                                                onSelect={() => {
                                                                                    field.onChange(site.siteId);
                                                                                }}
                                                                            >
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-4 w-4",
                                                                                        field.value === site.siteId
                                                                                            ? "opacity-100"
                                                                                            : "opacity-0"
                                                                                    )}
                                                                                />
                                                                                {site.name}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="protocol"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t("createInternalResourceDialogProtocol")}
                                                    </FormLabel>
                                                    <Select
                                                        onValueChange={
                                                            field.onChange
                                                        }
                                                        value={field.value}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="tcp">
                                                                {t("createInternalResourceDialogTcp")}
                                                            </SelectItem>
                                                            <SelectItem value="udp">
                                                                {t("createInternalResourceDialogUdp")}
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="proxyPort"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t("createInternalResourceDialogSitePort")}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        value={field.value || ""}
                                                        onChange={(e) =>
                                                            field.onChange(
                                                                e.target.value === "" ? undefined : parseInt(e.target.value)
                                                            )
                                                        }
                                                    />
                                                </FormControl>
                                                <FormDescription>
                                                    {t("createInternalResourceDialogSitePortDescription")}
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Target Configuration Form */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">
                                    {t("createInternalResourceDialogTargetConfiguration")}
                                </h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="destinationIp"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t("targetAddr")}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t("createInternalResourceDialogDestinationIPDescription")}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="destinationPort"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t("targetPort")}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            value={field.value || ""}
                                                            onChange={(e) =>
                                                                field.onChange(
                                                                    e.target.value === "" ? undefined : parseInt(e.target.value)
                                                                )
                                                            }
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        {t("createInternalResourceDialogDestinationPortDescription")}
                                                    </FormDescription>
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
                        {t("createInternalResourceDialogCancel")}
                    </Button>
                    <Button
                        type="submit"
                        form="create-internal-resource-form"
                        disabled={isSubmitting}
                        loading={isSubmitting}
                    >
                        {t("createInternalResourceDialogCreateResource")}
                    </Button>
                </CredenzaFooter>
            </CredenzaContent>
        </Credenza>
    );
}
