"use client";

import { useState } from "react";
import {
    Credenza,
    CredenzaBody,
    CredenzaClose,
    CredenzaContent,
    CredenzaDescription,
    CredenzaFooter,
    CredenzaHeader,
    CredenzaTitle
} from "@app/components/Credenza";
import { Button } from "@app/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@app/components/ui/alert";
import { InfoIcon, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { InfoSection, InfoSectionContent, InfoSections, InfoSectionTitle } from "@app/components/InfoSection";
import CopyToClipboard from "@app/components/CopyToClipboard";
import CopyTextBox from "@app/components/CopyTextBox";
import { QRCodeCanvas } from "qrcode.react";

type CredentialType = "site-wireguard" | "site-newt" | "client-olm" | "remote-exit-node";

interface RegenerateCredentialsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: CredentialType;
    onConfirmRegenerate: () => Promise<void>;
    dashboardUrl: string;
    credentials?: {
        // For WireGuard sites
        wgConfig?: string;

        Id?: string;
        Secret?: string;
    };
}

export default function RegenerateCredentialsModal({
    open,
    onOpenChange,
    type,
    onConfirmRegenerate,
    dashboardUrl,
    credentials
}: RegenerateCredentialsModalProps) {
    const t = useTranslations();
    const [stage, setStage] = useState<"confirm" | "show">("confirm");
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        try {
            setLoading(true);
            await onConfirmRegenerate();
            setStage("show");
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setStage("confirm");
        onOpenChange(false);
    };

    const getTitle = () => {
        if (stage === "confirm") {
            return t("regeneratecredentials");
        }
        switch (type) {
            case "site-wireguard":
                return t("WgConfiguration");
            case "site-newt":
                return t("siteNewtCredentials");
            case "client-olm":
                return t("clientOlmCredentials");
            case "remote-exit-node":
                return t("remoteExitNodeCreate.generate.title");
        }
    };

    const getDescription = () => {
        if (stage === "confirm") {
            return t("regenerateCredentialsWarning");
        }
        switch (type) {
            case "site-wireguard":
                return t("WgConfigurationDescription");
            case "site-newt":
                return t("siteNewtCredentialsDescription");
            case "client-olm":
                return t("clientOlmCredentialsDescription");
            case "remote-exit-node":
                return t("remoteExitNodeCreate.generate.description");
        }
    };

    return (
        <Credenza open={open} onOpenChange={onOpenChange}>
            <CredenzaContent className="max-h-[80vh] flex flex-col">
                <CredenzaHeader>
                    <CredenzaTitle>{getTitle()}</CredenzaTitle>
                    <CredenzaDescription>{getDescription()}</CredenzaDescription>
                </CredenzaHeader>

                <CredenzaBody className="overflow-y-auto px-4">
                    {stage === "confirm" ? (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle className="font-semibold">
                                {t("warning")}
                            </AlertTitle>
                            <AlertDescription>
                                {t("regenerateCredentialsConfirmation")}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            {credentials?.wgConfig && (
                                <div className="space-y-4">
                                    <div className="flex flex-col items-center gap-4">
                                        <CopyTextBox text={credentials.wgConfig} />
                                        <div className="relative w-fit border rounded-md">
                                            <div className="bg-white p-6 rounded-md">
                                                <QRCodeCanvas
                                                    value={credentials.wgConfig}
                                                    size={168}
                                                    className="mx-auto"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Alert variant="neutral">
                                        <InfoIcon className="h-4 w-4" />
                                        <AlertTitle className="font-semibold">
                                            {t("copyandsavethesecredentials")}
                                        </AlertTitle>
                                        <AlertDescription>
                                            {t("copyandsavethesecredentialsdescription")}
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            )}

                            {credentials?.Id && credentials.Secret && (
                                <div className="space-y-4">
                                    <InfoSections cols={1}>
                                        <InfoSection>
                                            <InfoSectionTitle>
                                                {t("endpoint")}
                                            </InfoSectionTitle>
                                            <InfoSectionContent>
                                                <CopyToClipboard text={dashboardUrl} />
                                            </InfoSectionContent>
                                        </InfoSection>
                                        <InfoSection>
                                            <InfoSectionTitle>
                                                {t("Id")}
                                            </InfoSectionTitle>
                                            <InfoSectionContent>
                                                <CopyToClipboard text={credentials?.Id} />
                                            </InfoSectionContent>
                                        </InfoSection>
                                        <InfoSection>
                                            <InfoSectionTitle>
                                                {t("SecretKey")}
                                            </InfoSectionTitle>
                                            <InfoSectionContent>
                                                <CopyToClipboard text={credentials?.Secret} />
                                            </InfoSectionContent>
                                        </InfoSection>
                                    </InfoSections>
                                    <Alert variant="neutral">
                                        <InfoIcon className="h-4 w-4" />
                                        <AlertTitle className="font-semibold">
                                            {t("copyandsavethesecredentials")}
                                        </AlertTitle>
                                        <AlertDescription>
                                            {t("copyandsavethesecredentialsdescription")}
                                        </AlertDescription>
                                    </Alert>
                                </div>

                            )}
                        </>
                    )}
                </CredenzaBody>

                <CredenzaFooter>
                    {stage === "confirm" ? (
                        <>
                            <CredenzaClose asChild>
                                <Button variant="outline">{t("cancel")}</Button>
                            </CredenzaClose>
                            <Button
                                onClick={handleConfirm}
                                loading={loading}
                                disabled={loading}
                                variant="destructive"
                            >
                                {t("confirm")}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={handleClose} className="w-full">
                            {t("close")}
                        </Button>
                    )}
                </CredenzaFooter>
            </CredenzaContent>
        </Credenza>
    );
}