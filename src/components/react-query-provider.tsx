"use client";
import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { QueryClient } from "@tanstack/react-query";

export type ReactQueryProviderProps = {
    children: React.ReactNode;
};

export function ReactQueryProvider({ children }: ReactQueryProviderProps) {
    const [queryClient] = React.useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        retry: 2, // retry twice by default
                        staleTime: 5 * 60 * 1_000 // 5 minutes
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
