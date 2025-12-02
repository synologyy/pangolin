import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { durationToMs } from "./durationToMs";
import { build } from "@server/build";
import { remote } from "./api";
import type ResponseT from "@server/types/Response";
import type { ListSitesResponse } from "@server/routers/site";
import type { AxiosInstance, AxiosResponse } from "axios";

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

export const siteQueries = {
    listPerOrg: ({ orgId, api }: { orgId: string; api: AxiosInstance }) =>
        queryOptions({
            queryKey: ["SITE_PER_ORG", orgId] as const,
            queryFn: async ({ signal }) => {
                const res = await api.get<AxiosResponse<ListSitesResponse>>(
                    `/org/${orgId}/sites`
                );
                return res.data.data.sites;
            }
        })
};
