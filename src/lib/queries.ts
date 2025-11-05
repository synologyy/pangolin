import {
    type InfiniteData,
    type QueryClient,
    keepPreviousData,
    queryOptions,
    type skipToken
} from "@tanstack/react-query";
import { durationToMs } from "./durationToMs";
import { build } from "@server/build";
import { remote } from "./api";
import type ResponseT from "@server/types/Response";

export const versionsQueries = {
    latestVersion: () =>
        queryOptions({
            queryKey: ["LATEST_VERSION"] as const,
            queryFn: async ({ signal }) => {
                const data = await remote.get<
                    ResponseT<{
                        pangolin: {
                            latestVersion: string;
                            releaseNotes: string;
                        };
                    }>
                >("/latest-version");
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
