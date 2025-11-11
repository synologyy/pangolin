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

export type AuthPageCustomizationProps = {
    orgId: string;
};

const AuthPageFormSchema = z.object({
    logoUrl: z.string().url(),
    logoWidth: z.number().min(1),
    logoHeight: z.number().min(1),
    title: z.string(),
    subtitle: z.string().optional(),
    resourceTitle: z.string(),
    resourceSubtitle: z.string().optional()
});

export default function AuthPageCustomizationForm({
    orgId
}: AuthPageCustomizationProps) {
    const [, formAction, isSubmitting] = React.useActionState(onSubmit, null);

    const form = useForm({
        resolver: zodResolver(AuthPageFormSchema),
        defaultValues: {
            title: `Log in to {{orgName}}`,
            resourceTitle: `Authenticate to access {{resourceName}}`
        }
    });

    async function onSubmit() {
        const isValid = await form.trigger();

        if (!isValid) return;
        // ...
    }

    return (
        <Form {...form}>
            <button>Hello</button>
        </Form>
    );
}
