"use client";

import React, { useState, useEffect } from "react";
import { Link, X, Clock, Share, ArrowRight, Lock } from "lucide-react"; // Replace with actual imports
import { Card, CardContent } from "@app/components/ui/card";
import { Button } from "@app/components/ui/button";
import { useTranslations } from "next-intl";

export const ShareableLinksSplash = () => {
    const [isDismissed, setIsDismissed] = useState(false);

    const key = "share-links-splash-dismissed";

    useEffect(() => {
        const dismissed = localStorage.getItem(key);
        if (dismissed === "true") {
            setIsDismissed(true);
        }
    }, []);

    const handleDismiss = () => {
        setIsDismissed(true);
        localStorage.setItem(key, "true");
    };

    const t = useTranslations();

    if (isDismissed) {
        return null;
    }

    return (
        <Card className="w-full mx-auto overflow-hidden mb-8 hidden md:block relative">
            <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-2"
                aria-label={t("dismiss")}
            >
                <X className="w-5 h-5" />
            </button>
            <CardContent className="grid gap-6 p-6">
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Link className="text-blue-500" />
                        {t("share")}
                    </h3>
                    <p className="text-sm">{t("shareDescription2")}</p>
                    <ul className="text-sm text-muted-foreground space-y-2">
                        <li className="flex items-center gap-2">
                            <Share className="text-green-500 w-4 h-4" />
                            {t("shareEasyCreate")}
                        </li>
                        <li className="flex items-center gap-2">
                            <Clock className="text-yellow-500 w-4 h-4" />
                            {t("shareConfigurableExpirationDuration")}
                        </li>
                        <li className="flex items-center gap-2">
                            <Lock className="text-red-500 w-4 h-4" />
                            {t("shareSecureAndRevocable")}
                        </li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
};

export default ShareableLinksSplash;
