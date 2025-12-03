"use client";
import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { QueryClient } from "@tanstack/react-query";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { createApiClient } from "@app/lib/api";
import { durationToMs } from "@app/lib/durationToMs";

export type ReactQueryProviderProps = {
    children: React.ReactNode;
};

export function TanstackQueryProvider({ children }: ReactQueryProviderProps) {
    const api = createApiClient(useEnvContext());
    const [queryClient] = React.useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        retry: 2, // retry twice by default
                        staleTime: durationToMs(5, "minutes"),
                        meta: {
                            api
                        }
                    },
                    mutations: {
                        meta: { api }
                    }
                }
            })
    );
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools position="bottom" />
        </QueryClientProvider>
    );
}
