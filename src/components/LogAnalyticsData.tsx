"use client";

import { useEnvContext } from "@app/hooks/useEnvContext";
import { createApiClient } from "@app/lib/api";
import {
    logAnalyticsFiltersSchema,
    logQueries,
    resourceQueries
} from "@app/lib/queries";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { RefreshCw, XIcon } from "lucide-react";
import { DateRangePicker, type DateTimeValue } from "./DateTimePicker";
import { Button } from "./ui/button";
import { cn } from "@app/lib/cn";
import { useTranslations } from "next-intl";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "./ui/select";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import {
    InfoSection,
    InfoSectionContent,
    InfoSections,
    InfoSectionTitle
} from "./InfoSection";
import { WorldMap } from "./WorldMap";

export type AnalyticsContentProps = {
    orgId: string;
};

export function LogAnalyticsData(props: AnalyticsContentProps) {
    const searchParams = useSearchParams();
    const path = usePathname();
    const t = useTranslations();

    const filters = logAnalyticsFiltersSchema.parse(
        Object.fromEntries(searchParams.entries())
    );

    const isEmptySearchParams =
        !filters.resourceId && !filters.timeStart && !filters.timeEnd;

    const env = useEnvContext();
    const [api] = useState(() => createApiClient(env));
    const router = useRouter();

    const dateRange = {
        startDate: filters.timeStart ? new Date(filters.timeStart) : undefined,
        endDate: filters.timeEnd ? new Date(filters.timeEnd) : undefined
    };

    const { data: resources = [], isFetching: isFetchingResources } = useQuery(
        resourceQueries.listNamesPerOrg(props.orgId, api)
    );

    const {
        data: stats,
        isFetching: isFetchingAnalytics,
        refetch: refreshAnalytics
    } = useQuery(
        logQueries.requestAnalytics({
            orgId: props.orgId,
            api,
            filters
        })
    );

    const percentBlocked = stats
        ? new Intl.NumberFormat(navigator.language, {
              maximumFractionDigits: 5
          }).format(stats.totalBlocked / stats.totalRequests)
        : null;
    const totalRequests = stats
        ? new Intl.NumberFormat(navigator.language, {
              maximumFractionDigits: 0
          }).format(stats.totalRequests)
        : null;

    function handleTimeRangeUpdate(start: DateTimeValue, end: DateTimeValue) {
        const newSearch = new URLSearchParams(searchParams);
        const timeRegex =
            /^(?<hours>\d{1,2})\:(?<minutes>\d{1,2})(\:(?<seconds>\d{1,2}))?$/;

        if (start.date) {
            const startDate = new Date(start.date);
            if (start.time) {
                const time = timeRegex.exec(start.time);
                const groups = time?.groups ?? {};
                startDate.setHours(Number(groups.hours));
                startDate.setMinutes(Number(groups.minutes));
                if (groups.seconds) {
                    startDate.setSeconds(Number(groups.seconds));
                }
            }
            newSearch.set("timeStart", startDate.toISOString());
        }
        if (end.date) {
            const endDate = new Date(end.date);

            if (end.time) {
                const time = timeRegex.exec(end.time);
                const groups = time?.groups ?? {};
                endDate.setHours(Number(groups.hours));
                endDate.setMinutes(Number(groups.minutes));
                if (groups.seconds) {
                    endDate.setSeconds(Number(groups.seconds));
                }
            }

            console.log({
                endDate
            });
            newSearch.set("timeEnd", endDate.toISOString());
        }
        router.replace(`${path}?${newSearch.toString()}`);
    }
    function getDateTime(date: Date) {
        return `${date.getHours()}:${date.getMinutes()}`;
    }

    return (
        <div className="flex flex-col gap-5">
            <Card className="">
                <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-start lg:items-end sm:justify-between sm:space-y-0 pb-4">
                    <div className="flex flex-col lg:flex-row items-start lg:items-end w-full sm:mr-2 gap-2">
                        <DateRangePicker
                            startValue={{
                                date: dateRange.startDate,
                                time: dateRange.startDate
                                    ? getDateTime(dateRange.startDate)
                                    : undefined
                            }}
                            endValue={{
                                date: dateRange.endDate,
                                time: dateRange.endDate
                                    ? getDateTime(dateRange.endDate)
                                    : undefined
                            }}
                            onRangeChange={handleTimeRangeUpdate}
                            className="flex-wrap gap-2"
                        />

                        <Separator className="w-px h-6 self-end relative bottom-1.5 hidden lg:block" />

                        <div className="flex items-end gap-2">
                            <div className="flex flex-col items-start gap-2 w-48">
                                <Label htmlFor="resourceId">
                                    {t("filterByResource")}
                                </Label>
                                <Select
                                    onValueChange={(newValue) => {
                                        const newSearch = new URLSearchParams(
                                            searchParams
                                        );
                                        newSearch.set("resourceId", newValue);

                                        router.replace(
                                            `${path}?${newSearch.toString()}`
                                        );
                                    }}
                                    value={filters.resourceId?.toString()}
                                >
                                    <SelectTrigger
                                        id="resourceId"
                                        className="w-full"
                                    >
                                        <SelectValue
                                            placeholder={t("selectResource")}
                                        />
                                    </SelectTrigger>
                                    <SelectContent className="w-full">
                                        {resources.map((resource) => (
                                            <SelectItem
                                                key={resource.resourceId}
                                                value={resource.resourceId.toString()}
                                            >
                                                {resource.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {!isEmptySearchParams && (
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        router.replace(path);
                                    }}
                                    className="gap-2"
                                >
                                    <XIcon className="size-4" />
                                    {t("resetFilters")}
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-start gap-2 sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => refreshAnalytics()}
                            disabled={isFetchingAnalytics}
                            className=" relative top-6 lg:static gap-2"
                        >
                            <RefreshCw
                                className={cn(
                                    "size-4",
                                    isFetchingAnalytics && "animate-spin"
                                )}
                            />
                            {t("refresh")}
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader className="flex flex-col gap-4">
                    <InfoSections cols={2}>
                        <InfoSection>
                            <InfoSectionTitle className="text-muted-foreground">
                                {t("totalRequests")}
                            </InfoSectionTitle>
                            <InfoSectionContent>
                                {totalRequests ?? "--"}
                            </InfoSectionContent>
                        </InfoSection>
                        <InfoSection>
                            <InfoSectionTitle className="text-muted-foreground">
                                {t("totalBlocked")}
                            </InfoSectionTitle>
                            <InfoSectionContent>
                                <span>{stats?.totalBlocked ?? "--"}</span>
                                &nbsp;(
                                <span>{percentBlocked ?? "--"}</span>
                                <span className="text-muted-foreground">%</span>
                                )
                            </InfoSectionContent>
                        </InfoSection>
                    </InfoSections>
                </CardHeader>
            </Card>

            <div className="flex flex-col lg:flex-row items-stretch gap-5">
                <Card className="w-full">
                    <CardHeader className="flex flex-col gap-4">
                        <h3 className="font-medium">
                            {t("requestsByCountry")}
                        </h3>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <WorldMap
                            data={
                                stats?.requestsPerCountry.map((item) => ({
                                    count: item.total,
                                    code: item.country_code ?? "US"
                                })) ?? []
                            }
                            label={{
                                singular: "request",
                                plural: "requests"
                            }}
                        />
                    </CardContent>
                </Card>

                <Card className="w-full">
                    <CardHeader className="flex flex-col gap-4">
                        <h3 className="font-medium">{t("topCountries")}</h3>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {/* ... */}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
