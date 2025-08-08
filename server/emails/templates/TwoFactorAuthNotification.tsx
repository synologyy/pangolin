import React from "react";
import { Body, Head, Html, Preview, Tailwind } from "@react-email/components";
import { themeColors } from "./lib/theme";
import {
    EmailContainer,
    EmailFooter,
    EmailGreeting,
    EmailHeading,
    EmailLetterHead,
    EmailSignature,
    EmailText
} from "./components/Email";

interface Props {
    email: string;
    enabled: boolean;
}

export const TwoFactorAuthNotification = ({ email, enabled }: Props) => {
    const previewText = `Two-Factor Authentication ${enabled ? "enabled" : "disabled"} for your account`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind config={themeColors}>
                <Body className="font-sans bg-gray-50">
                    <EmailContainer>
                        <EmailLetterHead />

                        {/* <EmailHeading> */}
                        {/*     Security Update: 2FA{" "} */}
                        {/*     {enabled ? "Enabled" : "Disabled"} */}
                        {/* </EmailHeading> */}

                        <EmailGreeting>Hi there,</EmailGreeting>

                        <EmailText>
                            Two-factor authentication has been successfully{" "}
                            <strong>{enabled ? "enabled" : "disabled"}</strong>{" "}
                            on your account.
                        </EmailText>

                        {enabled ? (
                            <>
                                <EmailText>
                                    Your account is now protected with an
                                    additional layer of security. Keep your
                                    authentication method safe and accessible.
                                </EmailText>
                            </>
                        ) : (
                            <>
                                <EmailText>
                                    We recommend re-enabling two-factor
                                    authentication to keep your account secure.
                                </EmailText>
                            </>
                        )}

                        <EmailText>
                            If you didn't make this change, please contact our
                            support team immediately.
                        </EmailText>

                        <EmailFooter>
                            <EmailSignature />
                        </EmailFooter>
                    </EmailContainer>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default TwoFactorAuthNotification;
