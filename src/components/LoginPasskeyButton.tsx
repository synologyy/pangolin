"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@app/hooks/useToast";

export default function LoginPasskeyButton({ email, redirect }: { email: string; redirect?: string }) {
    const api = createApiClient(useEnvContext());
    const router = useRouter();

    const handleLogin = async () => {
        try {
            const challengeRes = await api.post("/auth/passkey/login-challenge", { email });
            const assertion = await startAuthentication(challengeRes.data.data.options);
            await api.post("/auth/passkey/login-verify", { credential: assertion });
            toast({ title: "Logged in" });
            if (redirect) {
                router.push(redirect);
            } else {
                router.push("/");
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Failed to login", variant: "destructive" });
        }
    };

    return (
        <Button type="button" variant="outline" onClick={handleLogin}>
            Use Passkey
        </Button>
    );
}
