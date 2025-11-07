import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { durationToMs } from "./durationToMs";
import { build } from "@server/build";
import { remote } from "./api";
import type ResponseT from "@server/types/Response";

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

export const productUpdatesQueries = {
    list: queryOptions({
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
        }
    }),
    latestVersion: queryOptions({
        queryKey: ["LATEST_VERSION"] as const,
        queryFn: async ({ signal }) => {
            const data = await remote.get<
                ResponseT<{
                    pangolin: {
                        latestVersion: string;
                        releaseNotes: string;
                    };
                }>
            >("/versions", { signal });
            return data.data;
        },
        placeholderData: keepPreviousData,
        refetchInterval: (query) => {
            if (query.state.data) {
                return durationToMs(30, "minutes");
            }
            return false;
        },
        enabled: build === "oss" || build === "enterprise" // disabled in cloud version
        // because we don't need to listen for new versions there
    })
};
