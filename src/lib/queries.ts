import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { durationToMs } from "./durationToMs";
import { build } from "@server/build";
import { remote } from "./api";
import type ResponseT from "@server/types/Response";
import z from "zod";
import type { AxiosInstance, AxiosResponse } from "axios";
import type { QueryRequestAnalyticsResponse } from "@server/routers/auditLogs";
import type { ListResourceNamesResponse } from "@server/routers/resource";

export type ProductUpdate = {
    link: string | null;
    build: "enterprise" | "oss" | "saas" | null;
    id: number;
    type: "Update" | "Important" | "New" | "Warning";
    title: string;
    contents: string;
    publishedAt: Date;
    showUntil: Date;
};

export type LatestVersionResponse = {
    pangolin: {
        latestVersion: string;
        releaseNotes: string;
    };
};

export const productUpdatesQueries = {
    list: (enabled: boolean) =>
        queryOptions({
            queryKey: ["PRODUCT_UPDATES"] as const,
            queryFn: async ({ signal }) => {
                const sp = new URLSearchParams({
                    build
                });
                const data = await remote.get<ResponseT<ProductUpdate[]>>(
                    `/product-updates?${sp.toString()}`,
                    { signal }
                );
                return data.data;
            },
            refetchInterval: (query) => {
                if (query.state.data) {
                    return durationToMs(5, "minutes");
                }
                return false;
            },
            enabled
        }),
    latestVersion: (enabled: boolean) =>
        queryOptions({
            queryKey: ["LATEST_VERSION"] as const,
            queryFn: async ({ signal }) => {
                const data = await remote.get<ResponseT<LatestVersionResponse>>(
                    "/versions",
                    { signal }
                );
                return data.data;
            },
            placeholderData: keepPreviousData,
            refetchInterval: (query) => {
                if (query.state.data) {
                    return durationToMs(30, "minutes");
                }
                return false;
            },
            enabled: enabled && (build === "oss" || build === "enterprise") // disabled in cloud version
            // because we don't need to listen for new versions there
        })
};

export const logAnalyticsFiltersSchema = z.object({
    timeStart: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), {
            error: "timeStart must be a valid ISO date string"
        })
        .optional(),
    timeEnd: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), {
            error: "timeEnd must be a valid ISO date string"
        })
        .optional(),
    resourceId: z
        .string()
        .optional()
        .transform(Number)
        .pipe(z.int().positive())
        .optional()
});

export type LogAnalyticsFilters = z.TypeOf<typeof logAnalyticsFiltersSchema>;

export const logQueries = {
    requestAnalytics: ({
        orgId,
        filters,
        api
    }: {
        orgId: string;
        filters: LogAnalyticsFilters;
        api: AxiosInstance;
    }) =>
        queryOptions({
            queryKey: ["REQUEST_LOG_ANALYTICS", orgId, filters] as const,
            queryFn: async ({ signal }) => {
                const res = await api.get<
                    AxiosResponse<QueryRequestAnalyticsResponse>
                >(`/org/${orgId}/logs/analytics`, {
                    params: filters,
                    signal
                });
                return res.data.data;
            }
        })
};

export const resourceQueries = {
    listNamesPerOrg: (orgId: string, api: AxiosInstance) =>
        queryOptions({
            queryKey: ["RESOURCES_NAMES", orgId] as const,
            queryFn: async ({ signal }) => {
                const res = await api.get<
                    AxiosResponse<ListResourceNamesResponse>
                >(`/org/${orgId}/resource-names`, {
                    signal
                });
                return res.data.data;
            }
        })
};
