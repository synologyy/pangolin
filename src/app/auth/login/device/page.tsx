import { verifySession } from "@app/lib/auth/verifySession";
import { redirect } from "next/navigation";
import DeviceLoginForm from "@/components/DeviceLoginForm";
import { cache } from "react";

export const dynamic = "force-dynamic";

export default async function DeviceLoginPage() {
    const getUser = cache(verifySession);
    const user = await getUser();

    if (!user) {
        redirect("/auth/login?redirect=/auth/login/device");
    }

    return <DeviceLoginForm userEmail={user?.email || ""} />;
}
