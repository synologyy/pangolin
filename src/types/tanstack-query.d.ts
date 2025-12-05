import "@tanstack/react-query";
import type { AxiosInstance } from "axios";

interface Meta extends Record<string, unknown> {
    api: AxiosInstance;
}

declare module "@tanstack/react-query" {
    interface Register {
        queryMeta: Meta;
        mutationMeta: Meta;
    }
}
