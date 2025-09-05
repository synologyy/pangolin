"use client";

import { Badge } from "@app/components/ui/badge";
import Image from "next/image";

type IdpTypeBadgeProps = {
    type: string;
    variant?: string;
    name?: string;
};

export default function IdpTypeBadge({
    type,
    variant,
    name
}: IdpTypeBadgeProps) {
    const effectiveType = variant || type;
    const effectiveName = name || formatType(effectiveType);

    function formatType(type: string) {
        if (type === "google") return "Google";
        if (type === "azure") return "Azure";
        if (type === "oidc") return "OAuth2/OIDC";
        return type.charAt(0).toUpperCase() + type.slice(1);
    }

    return (
        <Badge
            variant="secondary"
            className="inline-flex items-center space-x-1 w-fit"
        >
            {effectiveType === "google" && (
                <>
                    <Image
                        src="/idp/google.png"
                        alt="Google"
                        width={16}
                        height={16}
                        className="rounded"
                    />
                    <span>{effectiveName}</span>
                </>
            )}
            {effectiveType === "azure" && (
                <>
                    <Image
                        src="/idp/azure.png"
                        alt="Azure"
                        width={16}
                        height={16}
                        className="rounded"
                    />
                    <span>{effectiveName}</span>
                </>
            )}
            {effectiveType === "oidc" && <span>{effectiveName}</span>}
            {!["google", "azure", "oidc"].includes(effectiveType) && (
                <span>{effectiveName}</span>
            )}
        </Badge>
    );
}
