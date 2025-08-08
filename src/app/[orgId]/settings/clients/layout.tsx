import { redirect } from "next/navigation";
import { pullEnv } from "@app/lib/pullEnv";

export const dynamic = "force-dynamic";

interface SettingsLayoutProps {
    children: React.ReactNode;
    params: Promise<{ orgId: string }>;
}

export default async function SettingsLayout(props: SettingsLayoutProps) {
    const params = await props.params;
    const { children } = props;
    const env = pullEnv();

    if (!env.flags.enableClients) {
        redirect(`/${params.orgId}/settings`);
    }

    return children;
}
