"use client";

import { useEnvContext } from "@app/hooks/useEnvContext";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { ValidateOidcUrlCallbackResponse } from "@server/routers/idp";
import { AxiosResponse } from "axios";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useLicenseStatusContext } from "@app/hooks/useLicenseStatusContext";
import { useTranslations } from "next-intl";

type ValidateOidcTokenParams = {
    orgId: string;
    idpId: string;
    code: string | undefined;
    expectedState: string | undefined;
    stateCookie: string | undefined;
    idp: { name: string };
};

export default function ValidateOidcToken(props: ValidateOidcTokenParams) {
    const { env } = useEnvContext();
    const api = createApiClient({ env });
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { licenseStatus, isLicenseViolation } = useLicenseStatusContext();

    const t = useTranslations();

    useEffect(() => {
        async function validate() {
            setLoading(true);

            console.log(t('idpOidcTokenValidating'), {
                code: props.code,
                expectedState: props.expectedState,
                stateCookie: props.stateCookie
            });

            if (isLicenseViolation()) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }

            try {
                const res = await api.post<
                    AxiosResponse<ValidateOidcUrlCallbackResponse>
                >(`/auth/idp/${props.idpId}/oidc/validate-callback`, {
                    code: props.code,
                    state: props.expectedState,
                    storedState: props.stateCookie
                });

                console.log(t('idpOidcTokenResponse'), res.data);

                const redirectUrl = res.data.data.redirectUrl;

                if (!redirectUrl) {
                    router.push("/");
                }

                setLoading(false);
                await new Promise((resolve) => setTimeout(resolve, 100));

                if (redirectUrl.startsWith("http")) {
                    window.location.href = res.data.data.redirectUrl; // this is validated by the parent using this component
                } else {
                    router.push(res.data.data.redirectUrl);
                }
            } catch (e) {
                setError(formatAxiosError(e, t('idpErrorOidcTokenValidating')));
            } finally {
                setLoading(false);
            }
        }

        validate();
    }, []);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>{t('idpConnectingTo', {name: props.idp.name})}</CardTitle>
                    <CardDescription>{t('idpConnectingToDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                    {loading && (
                        <div className="flex items-center space-x-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>{t('idpConnectingToProcess')}</span>
                        </div>
                    )}
                    {!loading && !error && (
                        <div className="flex items-center space-x-2 text-green-600">
                            <CheckCircle2 className="h-5 w-5" />
                            <span>{t('idpConnectingToFinished')}</span>
                        </div>
                    )}
                    {error && (
                        <Alert variant="destructive" className="w-full">
                            <AlertCircle className="h-5 w-5" />
                            <AlertDescription className="flex flex-col space-y-2">
                                <span>
                                    {t('idpErrorConnectingTo', {name: props.idp.name})}
                                </span>
                                <span className="text-xs">{error}</span>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
