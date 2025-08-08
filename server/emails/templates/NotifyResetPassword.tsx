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
}

export const ConfirmPasswordReset = ({ email }: Props) => {
    const previewText = `Your password has been successfully reset.`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind config={themeColors}>
                <Body className="font-sans bg-gray-50">
                    <EmailContainer>
                        <EmailLetterHead />

                        {/* <EmailHeading>Password Successfully Reset</EmailHeading> */}

                        <EmailGreeting>Hi there,</EmailGreeting>

                        <EmailText>
                            Your password has been successfully reset. You can
                            now sign in to your account using your new password.
                        </EmailText>

                        <EmailText>
                            If you didn't make this change, please contact our
                            support team immediately to secure your account.
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

export default ConfirmPasswordReset;
