"use client";

import { useEffect } from "react";

interface SetLastOrgCookieProps {
    orgId: string;
}

export default function SetLastOrgCookie({ orgId }: SetLastOrgCookieProps) {
    useEffect(() => {
        const isSecure =
            typeof window !== "undefined" &&
            window.location.protocol === "https:";

        document.cookie = `pangolin-last-org=${orgId}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax${isSecure ? "; secure" : ""}`;
    }, [orgId]);

    return null;
}
