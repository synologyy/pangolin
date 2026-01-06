"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import BrandingLogo from "@app/components/BrandingLogo";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useLicenseStatusContext } from "@app/hooks/useLicenseStatusContext";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect } from "react";

export default function DeviceAuthSuccessPage() {
    const { env } = useEnvContext();
    const { isUnlocked } = useLicenseStatusContext();
    const t = useTranslations();

    const logoWidth = isUnlocked()
        ? env.branding.logo?.authPage?.width || 175
        : 175;
    const logoHeight = isUnlocked()
        ? env.branding.logo?.authPage?.height || 58
        : 58;

    useEffect(() => {
        // Detect if we're on iOS or Android
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
        const isAndroid = /android/i.test(userAgent);

        if (isIOS || isAndroid) {
            // Wait 500ms then attempt to open the app
            setTimeout(() => {
                // Try to open the app using deep link
                window.location.href = "pangolin://";

                setTimeout(() => {
                    if (isIOS) {
                        window.location.href = "https://apps.apple.com/app/pangolin/net.pangolin.Pangolin.PangoliniOS";
                    } else if (isAndroid) {
                        window.location.href = "https://play.google.com/store/apps/details?id=net.pangolin.Pangolin";
                    }
                }, 2000);
            }, 500);
        }
    }, []);

    return (
        <>
            <Card>
                <CardHeader className="border-b">
                    <div className="flex flex-row items-center justify-center">
                        <BrandingLogo height={logoHeight} width={logoWidth} />
                    </div>
                    <div className="text-center space-y-1 pt-3">
                        <p className="text-muted-foreground">
                            {t("deviceActivation")}
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="flex flex-col items-center space-y-4">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-center">
                                {t("deviceConnected")}
                            </h3>
                            <p className="text-center text-sm text-muted-foreground">
                                {t("deviceAuthorizedMessage")}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <p className="text-center text-muted-foreground mt-4">
                <Link href={"/"} className="underline">
                    {t("backToHome")}
                </Link>
            </p>
        </>
    );
}
