import AuthPageCustomizationForm from "@app/components/AuthPagesCustomizationForm";
import { SettingsContainer } from "@app/components/Settings";

export interface AuthPageProps {
    params: Promise<{ orgId: string }>;
}

export default async function AuthPage(props: AuthPageProps) {
    const orgId = (await props.params).orgId;
    return (
        <SettingsContainer>
            <AuthPageCustomizationForm orgId={orgId} />
        </SettingsContainer>
    );
}
