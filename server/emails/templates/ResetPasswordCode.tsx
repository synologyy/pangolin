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
import ButtonLink from "./components/ButtonLink";

interface Props {
    email: string;
    code: string;
    link: string;
}

export const ResetPasswordCode = ({ email, code, link }: Props) => {
    const previewText = `Reset your password with code: ${code}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind config={themeColors}>
                <Body className="font-sans bg-gray-50">
                    <EmailContainer>
                        <EmailLetterHead />

                        {/* <EmailHeading>Reset Your Password</EmailHeading> */}

                        <EmailGreeting>Hi there,</EmailGreeting>

                        <EmailText>
                            You've requested to reset your password. Click the
                            button below to reset your password, or use the
                            verification code provided if prompted.
                        </EmailText>

                        <EmailSection>
                            <ButtonLink href={link}>Reset Password</ButtonLink>
                        </EmailSection>

                        <EmailSection>
                            <CopyCodeBox text={code} />
                        </EmailSection>

                        <EmailText>
                            This reset code will expire in 2 hours. If you
                            didn't request a password reset, you can safely
                            ignore this email.
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

export default ResetPasswordCode;
