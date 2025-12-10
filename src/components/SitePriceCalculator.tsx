import { useState } from "react";
import { Button } from "@app/components/ui/button";
import { MinusCircle, PlusCircle } from "lucide-react";
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
import { useTranslations } from "next-intl";

type SitePriceCalculatorProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "license" | "additional-sites";
};

export function SitePriceCalculator({
    isOpen,
    onOpenChange,
    mode
}: SitePriceCalculatorProps) {
    const [siteCount, setSiteCount] = useState(3);
    const pricePerSite = 5;
    const licenseFlatRate = 125;

    const incrementSites = () => {
        setSiteCount((prev) => prev + 1);
    };

    const decrementSites = () => {
        setSiteCount((prev) => (prev > 1 ? prev - 1 : 1));
    };

    function continueToPayment() {
        if (mode === "license") {
            // open in new tab
            window.open(
                `https://payment.fossorial.io/buy/dab98d3d-9976-49b1-9e55-1580059d833f?quantity=${siteCount}`,
                "_blank"
            );
        } else {
            window.open(
                `https://payment.fossorial.io/buy/2b881c36-ea5d-4c11-8652-9be6810a054f?quantity=${siteCount}`,
                "_blank"
            );
        }
    }

    const totalCost =
        mode === "license"
            ? licenseFlatRate + siteCount * pricePerSite
            : siteCount * pricePerSite;

    const t = useTranslations();

    return (
        <Credenza open={isOpen} onOpenChange={onOpenChange}>
            <CredenzaContent>
                <CredenzaHeader>
                    <CredenzaTitle>
                        {mode === "license"
                            ? t("licensePurchase")
                            : t("licensePurchaseSites")}
                    </CredenzaTitle>
                    <CredenzaDescription>
                        {t("licensePurchaseDescription", {
                            selectedMode: mode
                        })}
                    </CredenzaDescription>
                </CredenzaHeader>
                <CredenzaBody>
                    <div className="space-y-6">
                        <div className="flex flex-col items-center space-y-4">
                            <div className="text-sm font-medium text-muted-foreground">
                                {t("numberOfSites")}
                            </div>
                            <div className="flex items-center space-x-4">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={decrementSites}
                                    disabled={siteCount <= 1}
                                    aria-label={t("sitestCountDecrease")}
                                >
                                    <MinusCircle className="h-5 w-5" />
                                </Button>
                                <span className="text-3xl w-12 text-center">
                                    {siteCount}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={incrementSites}
                                    aria-label={t("sitestCountIncrease")}
                                >
                                    <PlusCircle className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <p className="text-muted-foreground text-sm mt-2 text-center">
                                {t("licensePricingPage")}
                                <a
                                    href="https://docs.fossorial.io/pricing"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                >
                                    {t("pricingPage")}
                                </a>
                                .
                            </p>
                        </div>
                    </div>
                </CredenzaBody>
                <CredenzaFooter>
                    <CredenzaClose asChild>
                        <Button variant="outline">{t("cancel")}</Button>
                    </CredenzaClose>
                    <Button onClick={continueToPayment}>
                        {t("pricingPortal")}
                    </Button>
                </CredenzaFooter>
            </CredenzaContent>
        </Credenza>
    );
}
