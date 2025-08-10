"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignUpResponse } from "@server/routers/auth";
import { useRouter } from "next/navigation";
import { passwordSchema } from "@server/auth/passwordSchema";
import { AxiosResponse } from "axios";
import { formatAxiosError } from "@app/lib/api";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import Image from "next/image";
import { cleanRedirect } from "@app/lib/cleanRedirect";
import { useTranslations } from "next-intl";
import BrandingLogo from "@app/components/BrandingLogo";
import { build } from "@server/build";

type SignupFormProps = {
    redirect?: string;
    inviteId?: string;
    inviteToken?: string;
};

const formSchema = z
    .object({
        email: z.string().email({ message: "Invalid email address" }),
        password: passwordSchema,
        confirmPassword: passwordSchema,
        agreeToTerms: z.boolean().refine(
            (val) => {
                if (build === "saas") {
                    val === true;
                }
                return true;
            },
            {
                message:
                    "You must agree to the terms of service and privacy policy"
            }
        )
    })
    .refine((data) => data.password === data.confirmPassword, {
        path: ["confirmPassword"],
        message: "Passwords do not match"
    });

export default function SignupForm({
    redirect,
    inviteId,
    inviteToken
}: SignupFormProps) {
    const router = useRouter();

    const { env } = useEnvContext();

    const api = createApiClient({ env });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [termsAgreedAt, setTermsAgreedAt] = useState<string | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
            confirmPassword: "",
            agreeToTerms: false
        }
    });

    const t = useTranslations();

    async function onSubmit(values: z.infer<typeof formSchema>) {
        const { email, password } = values;

        setLoading(true);
        const res = await api
            .put<AxiosResponse<SignUpResponse>>("/auth/signup", {
                email,
                password,
                inviteId,
                inviteToken,
                termsAcceptedTimestamp: termsAgreedAt
            })
            .catch((e) => {
                console.error(e);
                setError(formatAxiosError(e, t("signupError")));
            });

        if (res && res.status === 200) {
            setError(null);

            if (res.data?.data?.emailVerificationRequired) {
                if (redirect) {
                    const safe = cleanRedirect(redirect);
                    router.push(`/auth/verify-email?redirect=${safe}`);
                } else {
                    router.push("/auth/verify-email");
                }
                return;
            }

            if (redirect) {
                const safe = cleanRedirect(redirect);
                router.push(safe);
            } else {
                router.push("/");
            }
        }

        setLoading(false);
    }

    function getSubtitle() {
        return t("authCreateAccount");
    }

    const handleTermsChange = (checked: boolean) => {
        if (checked) {
            const isoNow = new Date().toISOString();
            console.log("Terms agreed at:", isoNow);
            setTermsAgreedAt(isoNow);
            form.setValue("agreeToTerms", true);
        } else {
            form.setValue("agreeToTerms", false);
            setTermsAgreedAt(null);
        }
    };

    return (
        <Card className="w-full max-w-md shadow-md">
            <CardHeader className="border-b">
                <div className="flex flex-row items-center justify-center">
                    <BrandingLogo height={58} width={175} />
                </div>
                <div className="text-center space-y-1 pt-3">
                    <p className="text-muted-foreground">{getSubtitle()}</p>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-4"
                    >
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("email")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("password")}</FormLabel>
                                    <FormControl>
                                        <Input type="password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        {t("confirmPassword")}
                                    </FormLabel>
                                    <FormControl>
                                        <Input type="password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {build === "saas" && (
                            <FormField
                                control={form.control}
                                name="agreeToTerms"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={(checked) => {
                                                    field.onChange(checked);
                                                    handleTermsChange(
                                                        checked as boolean
                                                    );
                                                }}
                                            />
                                        </FormControl>
                                        <div className="leading-none">
                                            <FormLabel className="text-sm font-normal">
                                                {t("signUpTerms.IAgreeToThe")}
                                                <a
                                                    href="https://digpangolin.com/terms-of-service.html"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline"
                                                >
                                                    {t(
                                                        "signUpTerms.termsOfService"
                                                    )}
                                                </a>
                                                {t("signUpTerms.and")}
                                                <a
                                                    href="https://digpangolin.com/privacy-policy.html"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline"
                                                >
                                                    {t(
                                                        "signUpTerms.privacyPolicy"
                                                    )}
                                                </a>
                                            </FormLabel>
                                            <FormMessage />
                                        </div>
                                    </FormItem>
                                )}
                            />
                        )}

                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Button type="submit" className="w-full">
                            {t("createAccount")}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
