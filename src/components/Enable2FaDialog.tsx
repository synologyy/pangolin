"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import TwoFactorSetupForm from "./TwoFactorSetupForm";
import { useTranslations } from "next-intl";
import { useUserContext } from "@app/hooks/useUserContext";

type Enable2FaDialogProps = {
    open: boolean;
    setOpen: (val: boolean) => void;
};

export default function Enable2FaDialog({ open, setOpen }: Enable2FaDialogProps) {
    const t = useTranslations();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const formRef = useRef<{ handleSubmit: () => void }>(null);
    const { user, updateUser } = useUserContext();

    function reset() {
        setCurrentStep(1);
        setLoading(false);
    }

    const handleSubmit = () => {
        if (formRef.current) {
            formRef.current.handleSubmit();
        }
    };

    return (
        <Credenza
            open={open}
            onOpenChange={(val) => {
                setOpen(val);
                reset();
            }}
        >
            <CredenzaContent>
                <CredenzaHeader>
                    <CredenzaTitle>
                        {t('otpSetup')}
                    </CredenzaTitle>
                    <CredenzaDescription>
                        {t('otpSetupDescription')}
                    </CredenzaDescription>
                </CredenzaHeader>
                <CredenzaBody>
                    <TwoFactorSetupForm
                        ref={formRef}
                        isDialog={true}
                        submitButtonText={t('submit')}
                        cancelButtonText="Close"
                        showCancelButton={false}
                        onComplete={() => {setOpen(false); updateUser({ twoFactorEnabled: true });}}
                        onStepChange={setCurrentStep}
                        onLoadingChange={setLoading}
                    />
                </CredenzaBody>
                <CredenzaFooter>
                    <CredenzaClose asChild>
                        <Button variant="outline">Close</Button>
                    </CredenzaClose>
                    {(currentStep === 1 || currentStep === 2) && (
                        <Button
                            type="button"
                            loading={loading}
                            disabled={loading}
                            onClick={handleSubmit}
                        >
                            {t('submit')}
                        </Button>
                    )}
                </CredenzaFooter>
            </CredenzaContent>
        </Credenza>
    );
} 