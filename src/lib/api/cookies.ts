import { headers } from "next/headers";

export async function authCookieHeader() {
    const otherHeaders = await headers();
    const otherHeadersObject = Object.fromEntries(otherHeaders.entries());

    return {
        headers: {
            cookie:
                otherHeadersObject["cookie"] || otherHeadersObject["Cookie"],
            host: otherHeadersObject["host"] || otherHeadersObject["Host"],
            "user-agent":
                otherHeadersObject["user-agent"] ||
                otherHeadersObject["User-Agent"],
            "x-forwarded-for":
                otherHeadersObject["x-forwarded-for"] ||
                otherHeadersObject["X-Forwarded-For"],
            "x-forwarded-host":
                otherHeadersObject["fx-forwarded-host"] ||
                otherHeadersObject["Fx-Forwarded-Host"],
            "x-forwarded-port":
                otherHeadersObject["x-forwarded-port"] ||
                otherHeadersObject["X-Forwarded-Port"],
            "x-forwarded-proto":
                otherHeadersObject["x-forwarded-proto"] ||
                otherHeadersObject["X-Forwarded-Proto"],
            "x-real-ip":
                otherHeadersObject["x-real-ip"] ||
                otherHeadersObject["X-Real-IP"]
        }
    };
}
