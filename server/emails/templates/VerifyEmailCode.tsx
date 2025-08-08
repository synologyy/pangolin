import React from "react";
import { Body, Head, Html, Preview, Tailwind } from "@react-email/components";
import { themeColors } from "./lib/theme";
import {
    EmailContainer,
    EmailFooter,
    EmailGreeting,
    EmailHeading,
    EmailLetterHead,
    EmailSection,
    EmailSignature,
    EmailText
} from "./components/Email";
import CopyCodeBox from "./components/CopyCodeBox";

interface VerifyEmailProps {
    username?: string;
    verificationCode: string;
    verifyLink: string;
}

export const VerifyEmail = ({
    username,
    verificationCode,
    verifyLink
}: VerifyEmailProps) => {
    const previewText = `Verify your email with code: ${verificationCode}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind config={themeColors}>
                <Body className="font-sans bg-gray-50">
                    <EmailContainer>
                        <EmailLetterHead />

                        {/* <EmailHeading>Verify Your Email Address</EmailHeading> */}

                        <EmailGreeting>Hi there,</EmailGreeting>

                        <EmailText>
                            Welcome! To complete your account setup, please
                            verify your email address using the code below.
                        </EmailText>

                        <EmailSection>
                            <CopyCodeBox text={verificationCode} />
                        </EmailSection>

                        <EmailText>
                            This verification code will expire in 15 minutes. If
                            you didn't create an account, you can safely ignore
                            this email.
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

export default VerifyEmail;
