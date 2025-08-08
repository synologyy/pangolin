import React from "react";
import { Body, Head, Html, Preview, Tailwind } from "@react-email/components";
import {
    EmailContainer,
    EmailLetterHead,
    EmailHeading,
    EmailText,
    EmailFooter,
    EmailSection,
    EmailGreeting,
    EmailSignature
} from "./components/Email";
import { themeColors } from "./lib/theme";
import CopyCodeBox from "./components/CopyCodeBox";

interface ResourceOTPCodeProps {
    email?: string;
    resourceName: string;
    orgName: string;
    otp: string;
}

export const ResourceOTPCode = ({
    email,
    resourceName,
    orgName: organizationName,
    otp
}: ResourceOTPCodeProps) => {
    const previewText = `Your access code for ${resourceName}: ${otp}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind config={themeColors}>
                <Body className="font-sans bg-gray-50">
                    <EmailContainer>
                        <EmailLetterHead />

                        {/* <EmailHeading> */}
                        {/*     Access Code for {resourceName} */}
                        {/* </EmailHeading> */}

                        <EmailGreeting>Hi there,</EmailGreeting>

                        <EmailText>
                            You've requested access to{" "}
                            <strong>{resourceName}</strong> in{" "}
                            <strong>{organizationName}</strong>. Use the
                            verification code below to complete your
                            authentication.
                        </EmailText>

                        <EmailSection>
                            <CopyCodeBox text={otp} />
                        </EmailSection>

                        <EmailText>
                            This code will expire in 15 minutes. If you didn't
                            request this code, please ignore this email.
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

export default ResourceOTPCode;
