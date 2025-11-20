import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { Card, CardContent, CardHeader } from "@app/components/ui/card";
import { getTranslations } from "next-intl/server";

export interface AnalyticsPageProps {}

export default async function AnalyticsPage(props: AnalyticsPageProps) {
    const t = await getTranslations();
    return (
        <>
            <SettingsSectionTitle
                title={t("requestAnalytics")}
                description={t("requestAnalyticsDescription")}
            />

            <div className="container mx-auto max-w-12xl">
                <Card className="">
                    <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pb-4"></CardHeader>
                    <CardContent></CardContent>
                </Card>
            </div>
        </>
    );
}
