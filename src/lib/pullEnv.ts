import { Env } from "./types/env";

export function pullEnv(): Env {
    return {
        server: {
            nextPort: process.env.NEXT_PORT as string,
            externalPort: process.env.SERVER_EXTERNAL_PORT as string,
            sessionCookieName: process.env.SESSION_COOKIE_NAME as string,
            resourceAccessTokenParam: process.env
                .RESOURCE_ACCESS_TOKEN_PARAM as string,
            resourceSessionRequestParam: process.env
                .RESOURCE_SESSION_REQUEST_PARAM as string,
            resourceAccessTokenHeadersId: process.env
                .RESOURCE_ACCESS_TOKEN_HEADERS_ID as string,
            resourceAccessTokenHeadersToken: process.env
                .RESOURCE_ACCESS_TOKEN_HEADERS_TOKEN as string
        },
        app: {
            environment: process.env.ENVIRONMENT as string,
            version: process.env.APP_VERSION as string,
            dashboardUrl: process.env.DASHBOARD_URL as string
        },
        email: {
            emailEnabled: process.env.EMAIL_ENABLED === "true" ? true : false
        },
        flags: {
            disableUserCreateOrg:
                process.env.DISABLE_USER_CREATE_ORG === "true" ? true : false,
            disableSignupWithoutInvite:
                process.env.DISABLE_SIGNUP_WITHOUT_INVITE === "true"
                    ? true
                    : false,
            emailVerificationRequired:
                process.env.FLAGS_EMAIL_VERIFICATION_REQUIRED === "true"
                    ? true
                    : false,
            allowRawResources:
                process.env.FLAGS_ALLOW_RAW_RESOURCES === "true" ? true : false,
            disableLocalSites:
                process.env.FLAGS_DISABLE_LOCAL_SITES === "true" ? true : false,
            disableBasicWireguardSites:
                process.env.FLAGS_DISABLE_BASIC_WIREGUARD_SITES === "true"
                    ? true
                    : false,
            enableClients:
                process.env.FLAGS_ENABLE_CLIENTS === "true" ? true : false,
            hideSupporterKey:
                process.env.HIDE_SUPPORTER_KEY === "true" ? true : false
        },
    };
}
