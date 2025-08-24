"use client";

import { createApiClient } from "@app/lib/api";
import { Button } from "@app/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@app/components/ui/card";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type InviteStatusCardProps = {
    type: "rejected" | "wrong_user" | "user_does_not_exist" | "not_logged_in";
    token: string;
    email?: string;
};

export default function InviteStatusCard({
    type,
    token,
    email,
}: InviteStatusCardProps) {
    const router = useRouter();
    const api = createApiClient(useEnvContext());
    const t = useTranslations();

    async function goToLogin() {
        await api.post("/auth/logout", {});
        const redirectUrl = email 
            ? `/auth/login?redirect=/invite?token=${token}&email=${encodeURIComponent(email)}`
            : `/auth/login?redirect=/invite?token=${token}`;
        router.push(redirectUrl);
    }

    async function goToSignup() {
        await api.post("/auth/logout", {});
        const redirectUrl = email 
            ? `/auth/signup?redirect=/invite?token=${token}&email=${encodeURIComponent(email)}`
            : `/auth/signup?redirect=/invite?token=${token}`;
        router.push(redirectUrl);
    }

    function renderBody() {
        if (type === "rejected") {
            return (
                <div>
                    <p className="text-center mb-4">
                        {t('inviteErrorNotValid')}
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-2">
                        <li>{t('inviteErrorExpired')}</li>
                        <li>{t('inviteErrorRevoked')}</li>
                        <li>{t('inviteErrorTypo')}</li>
                    </ul>
                </div>
            );
        } else if (type === "wrong_user") {
            return (
                <div>
                    <p className="text-center mb-4">
                        {t('inviteErrorUser')}
                    </p>
                    <p className="text-center">
                        {t('inviteLoginUser')}
                    </p>
                </div>
            );
        } else if (type === "user_does_not_exist") {
            return (
                <div>
                    <p className="text-center mb-4">
                        {t('inviteErrorNoUser')}
                    </p>
                    <p className="text-center">
                        {t('inviteCreateUser')}
                    </p>
                </div>
            );
        }
    }

    function renderFooter() {
        if (type === "rejected") {
            return (
                <Button
                    onClick={() => {
                        router.push("/");
                    }}
                >
                    {t('goHome')}
                </Button>
            );
        } else if (type === "wrong_user") {
            return (
                <Button onClick={goToLogin}>{t('inviteLogInOtherUser')}</Button>
            );
        } else if (type === "user_does_not_exist") {
            return <Button onClick={goToSignup}>{t('createAnAccount')}</Button>;
        }
    }

    return (
        <div className="p-3 md:mt-32 flex items-center justify-center">
            <Card className="w-full max-w-md">
                <CardHeader>
                    {/* <div className="flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mx-auto mb-4">
                        <XCircle
                            className="w-10 h-10 text-red-600"
                            aria-hidden="true"
                        />
                    </div> */}
                    <CardTitle className="text-center text-2xl font-bold">
                        {t('inviteNotAccepted')}
                    </CardTitle>
                </CardHeader>
                <CardContent>{renderBody()}</CardContent>

                <CardFooter className="flex justify-center space-x-4">
                    {renderFooter()}
                </CardFooter>
            </Card>
        </div>
    );
}
