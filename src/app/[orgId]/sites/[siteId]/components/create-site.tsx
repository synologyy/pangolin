"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, CaretSortIcon, CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { Button, buttonVariants } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { generateKeypair } from "./wireguard-config";
import React, { useState, useEffect } from "react";
import { api } from "@/api";
import { AxiosResponse } from "axios"
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Checkbox } from "@app/components/ui/checkbox"

const method = [
    { label: "Wireguard", value: "wg" },
    { label: "Newt", value: "newt" },
] as const;

const accountFormSchema = z.object({
    name: z
        .string()
        .min(2, {
            message: "Name must be at least 2 characters.",
        })
        .max(30, {
            message: "Name must not be longer than 30 characters.",
        }),
    subdomain: z
        .string()
        // cant be too long and cant have spaces or special characters
        .regex(/^[a-zA-Z0-9-]+$/)
        .min(2, {
            message: "Subdomain must be at least 2 characters.",
        })
        .max(30, {
            message: "Subdomain must not be longer than 30 characters.",
        }),
    method: z.enum(["wg", "newt"]),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

const defaultValues: Partial<AccountFormValues> = {
    name: "Wombat",
    method: "wg"
};

export function CreateSiteForm() {
    const params = useParams();
    const orgId = params.orgId;
    const router = useRouter();

    const [keypair, setKeypair] = useState<{ publicKey: string; privateKey: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isChecked, setIsChecked] = useState(false);

    const handleCheckboxChange = (checked: boolean) => {
        setIsChecked(checked);
    };

    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountFormSchema),
        defaultValues,
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            const generatedKeypair = generateKeypair();
            setKeypair(generatedKeypair);
            setIsLoading(false);
        }
    }, []);

    const name = form.watch("name");
    useEffect(() => {
        const subdomain = name.toLowerCase().replace(/\s+/g, "-");
        form.setValue("subdomain", subdomain, { shouldValidate: true });
    }, [name, form]);

    async function onSubmit(data: AccountFormValues) {
        const res = await api
            .put(`/org/${orgId}/site/`, {
                name: data.name,
                subdomain: data.subdomain,
                pubKey: keypair?.publicKey,
            })
            .catch((e) => {
                toast({
                    title: "Error creating site..."
                });
            });

        if (res && res.status === 201) {
            const siteId = res.data.data.siteId;
            // navigate to the site page
            router.push(`/${orgId}/sites/${siteId}`);
        }
    }

    const wgConfig = keypair
        ? `[Interface]
Address = 10.0.0.2/24
ListenPort = 51820
PrivateKey = ${keypair.privateKey}

[Peer]
PublicKey = ${keypair.publicKey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = myserver.dyndns.org:51820
PersistentKeepalive = 5`
        : "";

    const newtConfig = `curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh`;

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Your name" {...field} />
                                </FormControl>
                                <FormDescription>
                                    This is the name that will be displayed for this site.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="subdomain"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Subdomain</FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormDescription>
                                    The subdomain of the site. This will be used to access resources on the site.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="method"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Method</FormLabel>
                                <div className="relative w-max">
                                    <FormControl>
                                        <select
                                            className={cn(
                                                buttonVariants({ variant: "outline" }),
                                                "w-[200px] appearance-none font-normal"
                                            )}
                                            {...field}
                                        >
                                            <option value="wg">WireGuard</option>
                                            <option value="newt">Newt</option>
                                        </select>
                                    </FormControl>
                                    <ChevronDownIcon className="absolute right-3 top-2.5 h-4 w-4 opacity-50" />
                                </div>
                                <FormDescription>
                                    This is how you will connect your site to Fossorial.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {form.watch("method") === "wg" && !isLoading ? (
                        <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 overflow-x-auto">
                            <code className="text-white whitespace-pre-wrap">{wgConfig}</code>
                        </pre>
                    ) : form.watch("method") === "wg" && isLoading ? (
                        <p>Loading WireGuard configuration...</p>
                    ) : (
                        <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 overflow-x-auto">
                            <code className="text-white whitespace-pre-wrap">{newtConfig}</code>
                        </pre>
                    )}
                    <div className="flex items-center space-x-2">
                        <Checkbox id="terms" checked={isChecked}
                            onCheckedChange={handleCheckboxChange} />
                        <label
                            htmlFor="terms"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            I have copied the config
                        </label>
                    </div>
                    <Button type="submit" disabled={!isChecked}>Create Site</Button>
                </form>
            </Form>
        </>
    );
}
