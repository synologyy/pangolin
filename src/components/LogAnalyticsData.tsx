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
import { LoaderIcon, RefreshCw, XIcon } from "lucide-react";
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
import { countryCodeToFlagEmoji } from "@app/lib/countryCodeToFlagEmoji";
import { useTheme } from "next-themes";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "./ui/tooltip";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from "./ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
        refetch: refreshAnalytics,
        isLoading: isLoadingAnalytics // only `true` when there is no data yet
    } = useQuery(
        logQueries.requestAnalytics({
            orgId: props.orgId,
            api,
            filters
        })
    );

    const percentBlocked = stats
        ? new Intl.NumberFormat(navigator.language, {
              maximumFractionDigits: 2
          }).format((stats.totalBlocked / stats.totalRequests) * 100)
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
                                        newSearch.delete("resourceId");
                                        if (newValue !== "all") {
                                            newSearch.set(
                                                "resourceId",
                                                newValue
                                            );
                                        }

                                        router.replace(
                                            `${path}?${newSearch.toString()}`
                                        );
                                    }}
                                    value={
                                        filters.resourceId?.toString() ?? "all"
                                    }
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
                                        <SelectItem value="all">
                                            All resources
                                        </SelectItem>
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

            <Card className="w-full h-full flex flex-col gap-8">
                <CardHeader>
                    <h3 className="font-medium">{t("requestsByDay")}</h3>
                </CardHeader>
                <CardContent>
                    <RequestChart
                        data={stats?.requestsPerDay ?? []}
                        isLoading={isLoadingAnalytics}
                    />
                </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-5">
                <Card className="w-full h-full">
                    <CardHeader>
                        <h3 className="font-medium">
                            {t("requestsByCountry")}
                        </h3>
                    </CardHeader>
                    <CardContent>
                        <WorldMap
                            data={stats?.requestsPerCountry ?? []}
                            label={{
                                singular: "request",
                                plural: "requests"
                            }}
                        />
                    </CardContent>
                </Card>

                <Card className="w-full h-full">
                    <CardHeader>
                        <h3 className="font-medium">{t("topCountries")}</h3>
                    </CardHeader>
                    <CardContent className="flex h-full flex-col gap-4">
                        <TopCountriesList
                            countries={stats?.requestsPerCountry ?? []}
                            total={stats?.totalRequests ?? 0}
                            isLoading={isLoadingAnalytics}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

type RequestChartProps = {
    data: {
        day: string;
        allowedCount: number;
        blockedCount: number;
        totalCount: number;
    }[];
    isLoading: boolean;
};

function RequestChart(props: RequestChartProps) {
    const t = useTranslations();

    const numberFormatter = new Intl.NumberFormat(navigator.language, {
        maximumFractionDigits: 1,
        notation: "compact",
        compactDisplay: "short"
    });

    const chartConfig = {
        blockedCount: {
            label: t("blocked"),
            color: "var(--chart-5)"
        },
        allowedCount: {
            label: t("allowed"),
            color: "var(--chart-2)"
        }
    } satisfies ChartConfig;

    return (
        <ChartContainer
            config={chartConfig}
            className="min-h-[200px] w-full h-80"
        >
            <AreaChart accessibilityLayer data={props.data}>
                <ChartLegend content={<ChartLegendContent />} />
                <ChartTooltip
                    content={
                        <ChartTooltipContent
                            hideLabel
                            formatter={(value, name, item, index) => {
                                const formattedDate = new Date(
                                    item.payload.day
                                ).toLocaleDateString(navigator.language, {
                                    dateStyle: "medium"
                                });

                                const value_str = numberFormatter.format(
                                    value as number
                                );

                                const config =
                                    chartConfig[
                                        name as keyof typeof chartConfig
                                    ];

                                return (
                                    <div className="flex gap-2 items-start text-sm flex-col w-full">
                                        {index === 0 && (
                                            <span>{formattedDate}</span>
                                        )}

                                        <div className="ml-auto flex items-baseline justify-between gap-4 self-stretch w-full font-mono font-medium tabular-nums text-card-foreground text-xs">
                                            <div className="flex gap-1 items-center">
                                                <div
                                                    className="size-2.5 flex-none rounded-[2px] bg-(--color-bg)"
                                                    style={
                                                        {
                                                            "--color-bg": `var(--color-${name})`
                                                        } as React.CSSProperties
                                                    }
                                                />
                                                <span className="text-muted-foreground">
                                                    {config.label}
                                                </span>
                                            </div>
                                            <div className="flex gap-0.5">
                                                <span>{value_str}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }}
                        />
                    }
                />

                <CartesianGrid vertical={false} />
                <YAxis
                    tickLine={false}
                    axisLine={false}
                    domain={[
                        0,
                        Math.max(...props.data.map((datum) => datum.totalCount))
                    ]}
                    allowDataOverflow
                    type="number"
                    tickFormatter={(value) => {
                        return numberFormatter.format(value);
                    }}
                />
                <XAxis
                    dataKey="day"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={(value) => {
                        return new Date(value).toLocaleDateString(
                            navigator.language,
                            {
                                dateStyle: "medium"
                            }
                        );
                    }}
                />

                <defs>
                    <linearGradient
                        id="fillAllowed"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="5%"
                            stopColor="var(--color-allowedCount)"
                            stopOpacity={0.8}
                        />
                        <stop
                            offset="95%"
                            stopColor="var(--color-allowedCount)"
                            stopOpacity={0.1}
                        />
                    </linearGradient>
                    <linearGradient
                        id="fillBlocked"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="5%"
                            stopColor="var(--color-blockedCount)"
                            stopOpacity={0.8}
                        />
                        <stop
                            offset="95%"
                            stopColor="var(--color-blockedCount)"
                            stopOpacity={0.1}
                        />
                    </linearGradient>
                </defs>

                <Area
                    dataKey="allowedCount"
                    stroke="var(--color-allowedCount)"
                    fill="url(#fillAllowed)"
                    radius={4}
                />
                <Area
                    dataKey="blockedCount"
                    stroke="var(--color-blockedCount)"
                    fill="url(#fillBlocked)"
                    radius={4}
                />
            </AreaChart>
        </ChartContainer>
    );
}

type TopCountriesListProps = {
    countries: {
        code: string;
        count: number;
    }[];
    total: number;
    isLoading: boolean;
};

function TopCountriesList(props: TopCountriesListProps) {
    const t = useTranslations();
    const displayNames = new Intl.DisplayNames(navigator.language, {
        type: "region",
        fallback: "code"
    });

    const numberFormatter = new Intl.NumberFormat(navigator.language, {
        maximumFractionDigits: 1,
        notation: "compact",
        compactDisplay: "short"
    });
    const percentFormatter = new Intl.NumberFormat(navigator.language, {
        maximumFractionDigits: 0,
        style: "percent"
    });

    return (
        <div className="h-full flex flex-col gap-2">
            {props.countries.length > 0 && (
                <div className="grid grid-cols-7 text-sm text-muted-foreground font-medium h-4">
                    <div className="col-span-5">{t("countries")}</div>
                    <div className="text-end">{t("total")}</div>
                    <div className="text-end">%</div>
                </div>
            )}
            {/* `aspect-475/335` is the same aspect ratio as the world map component */}
            <ol className="w-full overflow-auto grid gap-1 aspect-475/335">
                {props.countries.length === 0 && (
                    <div className="flex items-center justify-center size-full text-muted-foreground font-mono gap-1">
                        {props.isLoading ? (
                            <>
                                <LoaderIcon className="size-4 animate-spin" />{" "}
                                {t("loading")}
                            </>
                        ) : (
                            t("noData")
                        )}
                    </div>
                )}
                {props.countries.map((country) => {
                    const percent = country.count / props.total;
                    return (
                        <li
                            key={country.code}
                            className="grid grid-cols-7 rounded-xs hover:bg-muted relative items-center text-sm"
                        >
                            <div
                                className={cn(
                                    "absolute bg-[#f36117]/40 top-0 bottom-0 left-0 rounded-xs"
                                )}
                                style={{
                                    width: `${percent * 100}%`
                                }}
                            />
                            <div className="col-span-5 px-2 py-1 relative z-1">
                                <span className="inline-flex gap-2 items-center">
                                    {countryCodeToFlagEmoji(country.code)}{" "}
                                    {displayNames.of(country.code)}
                                </span>
                            </div>
                            <TooltipProvider>
                                <div className="text-end">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button className="inline">
                                                {numberFormatter.format(
                                                    country.count
                                                )}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <strong>
                                                {Intl.NumberFormat(
                                                    navigator.language
                                                ).format(country.count)}
                                            </strong>{" "}
                                            {country.count === 1
                                                ? t("request")
                                                : t("requests")}
                                        </TooltipContent>
                                    </Tooltip>
                                </div>

                                <div className="text-end">
                                    {percentFormatter.format(percent)}
                                </div>
                            </TooltipProvider>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
