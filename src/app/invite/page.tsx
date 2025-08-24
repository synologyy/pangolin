import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import { verifySession } from "@app/lib/auth/verifySession";
import { AcceptInviteResponse } from "@server/routers/user";
import { AxiosResponse } from "axios";
import { redirect } from "next/navigation";
import InviteStatusCard from "./InviteStatusCard";
import { formatAxiosError } from "@app/lib/api";
import { getTranslations } from "next-intl/server";

export default async function InvitePage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await props.searchParams;

    const tokenParam = params.token as string;
    const emailParam = params.email as string;

    if (!tokenParam) {
        redirect("/");
    }

    const user = await verifySession();
    const t = await getTranslations();

    const parts = tokenParam.split("-");
    if (parts.length !== 2) {
        return (
            <>
                <h1>{t('inviteInvalid')}</h1>
                <p>{t('inviteInvalidDescription')}</p>
            </>
        );
    }

    const inviteId = parts[0];
    const token = parts[1];

    let error = "";
    const res = await internal
        .post<AxiosResponse<AcceptInviteResponse>>(
            `/invite/accept`,
            {
                inviteId,
                token,
            },
            await authCookieHeader()
        )
        .catch((e) => {
            error = formatAxiosError(e);
        });

    if (res && res.status === 200) {
        redirect(`/${res.data.data.orgId}`);
    }

    function cardType() {
        if (error.includes(t('inviteErrorWrongUser'))) {
            return "wrong_user";
        } else if (
            error.includes(t('inviteErrorUserNotExists'))
        ) {
            return "user_does_not_exist";
        } else if (error.includes(t('inviteErrorLoginRequired'))) {
            return "not_logged_in";
        } else {
            return "rejected";
        }
    }

    const type = cardType();

    if (!user && type === "user_does_not_exist") {
        const redirectUrl = emailParam 
            ? `/auth/signup?redirect=/invite?token=${params.token}&email=${encodeURIComponent(emailParam)}`
            : `/auth/signup?redirect=/invite?token=${params.token}`;
        redirect(redirectUrl);
    }

    if (!user && type === "not_logged_in") {
        const redirectUrl = emailParam 
            ? `/auth/login?redirect=/invite?token=${params.token}&email=${encodeURIComponent(emailParam)}`
            : `/auth/login?redirect=/invite?token=${params.token}`;
        redirect(redirectUrl);
    }

    return (
        <>
            <InviteStatusCard type={type} token={tokenParam} email={emailParam} />
        </>
    );
}
