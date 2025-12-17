"use client";

import { cn } from "@app/lib/cn";
import { useTranslations } from "next-intl";

type ProfessionalContentOverlayProps = {
    children: React.ReactNode;
    isProfessional?: boolean;
};

export function ProfessionalContentOverlay({
    children,
    isProfessional = false
}: ProfessionalContentOverlayProps) {
    const t = useTranslations();

    return (
        <div
            className={cn(
                "relative",
                isProfessional && "opacity-60 pointer-events-none"
            )}
        >
            {isProfessional && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
                    <div className="text-center p-6 bg-primary/10 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2">
                            {t("licenseTierProfessionalRequired")}
                        </h3>
                        <p className="text-muted-foreground">
                            {t("licenseTierProfessionalRequiredDescription")}
                        </p>
                    </div>
                </div>
            )}
            {children}
        </div>
    );
}
