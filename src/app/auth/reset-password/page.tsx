import { verifySession } from "@app/lib/auth/verifySession";
import { redirect } from "next/navigation";
import { cache } from "react";
import ResetPasswordForm from "@app/components/ResetPasswordForm";
import Link from "next/link";
import { cleanRedirect } from "@app/lib/cleanRedirect";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function Page(props: {
    searchParams: Promise<{
        redirect: string | undefined;
        email: string | undefined;
        token: string | undefined;
        quickstart?: string | undefined;
    }>;
}) {
    const searchParams = await props.searchParams;
    const getUser = cache(verifySession);
    const user = await getUser();
    const t = await getTranslations();

    if (user) {
        redirect("/");
    }

    let redirectUrl: string | undefined = undefined;
    if (searchParams.redirect) {
        redirectUrl = cleanRedirect(searchParams.redirect);
    }

    return (
        <>
            <ResetPasswordForm
                redirect={searchParams.redirect}
                tokenParam={searchParams.token}
                emailParam={searchParams.email}
                quickstart={
                    searchParams.quickstart === "true" ? true : undefined
                }
            />

            <p className="text-center text-muted-foreground mt-4">
                <Link
                    href={
                        !searchParams.redirect
                            ? `/auth/signup`
                            : `/auth/signup?redirect=${redirectUrl}`
                    }
                    className="underline"
                >
                    {t("loginBack")}
                </Link>
            </p>
        </>
    );
}
