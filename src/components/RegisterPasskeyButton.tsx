"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { Button } from "@/components/ui/button";
import { toast } from "@app/hooks/useToast";

export default function RegisterPasskeyButton() {
    const api = createApiClient(useEnvContext());

    const handleRegister = async () => {
        try {
            const res = await api.post("/auth/passkey/register-challenge");
            const attestation = await startRegistration(res.data.data.options);
            await api.post("/auth/passkey/register-verify", { credential: attestation });
            toast({ title: "Passkey registered" });
        } catch (e) {
            console.error(e);
            toast({ title: "Failed to register passkey", variant: "destructive" });
        }
    };

    return (
        <Button type="button" onClick={handleRegister} variant="outline">
            Register Passkey
        </Button>
    );
}
