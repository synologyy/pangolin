import VerifyEmailForm from "@app/components/VerifyEmailForm";
import { verifySession } from "@app/lib/auth/verifySession";
import { cleanRedirect } from "@app/lib/cleanRedirect";
import { pullEnv } from "@app/lib/pullEnv";
import { redirect } from "next/navigation";
import { cache } from "react";

export const dynamic = "force-dynamic";

export default async function Page(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const env = pullEnv();

    if (!env.flags.emailVerificationRequired) {
        redirect("/");
    }

    const searchParams = await props.searchParams;
    const getUser = cache(verifySession);
    const user = await getUser({ skipCheckVerifyEmail: true });

    if (!user) {
        redirect("/");
    }

    if (user.emailVerified) {
        redirect("/");
    }

    let redirectUrl: string | undefined;
    if (searchParams.redirect) {
        redirectUrl = cleanRedirect(searchParams.redirect as string);
    }

    return (
        <>
            <VerifyEmailForm
                email={user.email!}
                redirect={redirectUrl}
            />
        </>
    );
}
