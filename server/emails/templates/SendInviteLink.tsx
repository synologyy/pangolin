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
import ButtonLink from "./components/ButtonLink";

interface SendInviteLinkProps {
    email: string;
    inviteLink: string;
    orgName: string;
    inviterName?: string;
    expiresInDays: string;
}

export const SendInviteLink = ({
    email,
    inviteLink,
    orgName,
    inviterName,
    expiresInDays
}: SendInviteLinkProps) => {
    const previewText = `${inviterName} invited you to join ${orgName}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind config={themeColors}>
                <Body className="font-sans bg-gray-50">
                    <EmailContainer>
                        <EmailLetterHead />

                        {/* <EmailHeading> */}
                        {/*     You're Invited to Join {orgName} */}
                        {/* </EmailHeading> */}

                        <EmailGreeting>Hi there,</EmailGreeting>

                        <EmailText>
                            You've been invited to join{" "}
                            <strong>{orgName}</strong>
                            {inviterName ? ` by ${inviterName}` : ""}. Click the
                            button below to accept your invitation and get
                            started.
                        </EmailText>

                        <EmailSection>
                            <ButtonLink href={inviteLink}>
                                Accept Invitation
                            </ButtonLink>
                        </EmailSection>

                        {/* <EmailText> */}
                        {/*     If you're having trouble clicking the button, copy */}
                        {/*     and paste the URL below into your web browser: */}
                        {/*     <br /> */}
                        {/*     <span className="break-all">{inviteLink}</span> */}
                        {/* </EmailText> */}

                        <EmailText>
                            This invite expires in {expiresInDays}{" "}
                            {expiresInDays === "1" ? "day" : "days"}. If the
                            link has expired, please contact the owner of the
                            organization to request a new invitation.
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

export default SendInviteLink;
