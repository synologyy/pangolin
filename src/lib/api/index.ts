import { Env } from "@app/lib/types/env";
import axios, { AxiosInstance } from "axios";

function getCsrfCookie() {
    if (typeof document === "undefined") {
        return undefined;
    }
    const match = document.cookie.match(/(?:^|; )p_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
}

let apiInstance: AxiosInstance | null = null;

export function createApiClient({ env }: { env: Env }): AxiosInstance {
    if (apiInstance) {
        return apiInstance;
    }

    if (typeof window === "undefined") {
        // @ts-ignore
        return;
    }

    let baseURL;
    const suffix = "api/v1";

    if (window.location.port === env.server.nextPort) {
        // this means the user is addressing the server directly
        baseURL = `${window.location.protocol}//${window.location.hostname}:${env.server.externalPort}/${suffix}`;
        axios.defaults.withCredentials = true;
    } else {
        // user is accessing through a proxy
        baseURL = window.location.origin + `/${suffix}`;
    }

    if (!baseURL) {
        throw new Error("Failed to create api client, invalid environment");
    }

    apiInstance = axios.create({
        baseURL,
        timeout: 10000,
        headers: {
            "Content-Type": "application/json"
        }
    });

    apiInstance.interceptors.request.use((config) => {
        const token = getCsrfCookie();
        if (token) {
            (config.headers as any)["X-CSRF-Token"] = token;
        }
        return config;
    });

    return apiInstance;
}

// we can pull from env var here becuase it is only used in the server
export const internal = axios.create({
    baseURL: `http://localhost:${process.env.SERVER_EXTERNAL_PORT}/api/v1`,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": "x-csrf-protection"
    }
});

export const priv = axios.create({
    baseURL: `http://localhost:${process.env.SERVER_INTERNAL_PORT}/api/v1`,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json"
    }
});

export * from "./formatAxiosError";

