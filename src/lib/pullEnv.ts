import z from "zod";
import { Env } from "./types/env";

const envSchema = z.object({
    // Server configuration
    NEXT_PORT: z.string(),
    SERVER_EXTERNAL_PORT: z.string(),
    SESSION_COOKIE_NAME: z.string(),
    RESOURCE_ACCESS_TOKEN_PARAM: z.string(),
    RESOURCE_SESSION_REQUEST_PARAM: z.string(),
    RESOURCE_ACCESS_TOKEN_HEADERS_ID: z.string(),
    RESOURCE_ACCESS_TOKEN_HEADERS_TOKEN: z.string(),
    REO_CLIENT_ID: z.string().optional(),
    MAXMIND_DB_PATH: z.string().optional(),

    // App configuration
    ENVIRONMENT: z.string(),
    SANDBOX_MODE: z
        .string()
        .default("false")
        .transform((val) => val === "true"),
    APP_VERSION: z.string(),
    DASHBOARD_URL: z.string(),

    // Email configuration
    EMAIL_ENABLED: z
        .string()
        .default("false")
        .transform((val) => val === "true"),

    // Feature flags
    DISABLE_USER_CREATE_ORG: z
        .string()
        .default("false")
        .transform((val) => val === "true"),
    DISABLE_SIGNUP_WITHOUT_INVITE: z
        .string()
        .default("false")
        .transform((val) => val === "true"),
    FLAGS_EMAIL_VERIFICATION_REQUIRED: z
        .string()
        .default("false")
        .transform((val) => val === "true"),
    FLAGS_ALLOW_RAW_RESOURCES: z
        .string()
        .default("false")
        .transform((val) => val === "true"),
    FLAGS_DISABLE_LOCAL_SITES: z
        .string()
        .default("false")
        .transform((val) => val === "true"),
    FLAGS_DISABLE_BASIC_WIREGUARD_SITES: z
        .string()
        .default("false")
        .transform((val) => val === "true"),
    FLAGS_ENABLE_CLIENTS: z
        .string()
        .default("false")
        .transform((val) => val === "true"),
    HIDE_SUPPORTER_KEY: z
        .string()
        .default("false")
        .transform((val) => val === "true"),
    USE_PANGOLIN_DNS: z
        .string()
        .default("false")
        .transform((val) => val === "true"),

    // Branding configuration (all optional)
    BRANDING_APP_NAME: z.string().optional(),
    BACKGROUND_IMAGE_PATH: z.string().optional(),
    BRANDING_LOGO_LIGHT_PATH: z.string().optional(),
    BRANDING_LOGO_DARK_PATH: z.string().optional(),
    BRANDING_LOGO_AUTH_WIDTH: z.coerce.number().optional(),
    BRANDING_LOGO_AUTH_HEIGHT: z.coerce.number().optional(),
    BRANDING_LOGO_NAVBAR_WIDTH: z.coerce.number().optional(),
    BRANDING_LOGO_NAVBAR_HEIGHT: z.coerce.number().optional(),
    LOGIN_PAGE_TITLE_TEXT: z.string().optional(),
    LOGIN_PAGE_SUBTITLE_TEXT: z.string().optional(),
    SIGNUP_PAGE_TITLE_TEXT: z.string().optional(),
    SIGNUP_PAGE_SUBTITLE_TEXT: z.string().optional(),
    RESOURCE_AUTH_PAGE_SHOW_LOGO: z
        .string()
        .transform((val) => val === "true")
        .optional(),
    RESOURCE_AUTH_PAGE_HIDE_POWERED_BY: z
        .string()
        .transform((val) => val === "true")
        .optional(),
    RESOURCE_AUTH_PAGE_TITLE_TEXT: z.string().optional(),
    RESOURCE_AUTH_PAGE_SUBTITLE_TEXT: z.string().optional(),
    BRANDING_FOOTER: z.string().optional()
});

export function pullEnv(): Env {
    const env = envSchema.parse(process.env);

    return {
        server: {
            nextPort: env.NEXT_PORT,
            externalPort: env.SERVER_EXTERNAL_PORT,
            sessionCookieName: env.SESSION_COOKIE_NAME,
            resourceAccessTokenParam: env.RESOURCE_ACCESS_TOKEN_PARAM,
            resourceSessionRequestParam: env.RESOURCE_SESSION_REQUEST_PARAM,
            resourceAccessTokenHeadersId: env.RESOURCE_ACCESS_TOKEN_HEADERS_ID,
            resourceAccessTokenHeadersToken:
                env.RESOURCE_ACCESS_TOKEN_HEADERS_TOKEN,
            reoClientId: env.REO_CLIENT_ID,
            maxmind_db_path: env.MAXMIND_DB_PATH
        },
        app: {
            environment: env.ENVIRONMENT,
            sandbox_mode: env.SANDBOX_MODE,
            version: env.APP_VERSION,
            dashboardUrl: env.DASHBOARD_URL
        },
        email: {
            emailEnabled: env.EMAIL_ENABLED
        },
        flags: {
            disableUserCreateOrg: env.DISABLE_USER_CREATE_ORG,
            disableSignupWithoutInvite: env.DISABLE_SIGNUP_WITHOUT_INVITE,
            emailVerificationRequired: env.FLAGS_EMAIL_VERIFICATION_REQUIRED,
            allowRawResources: env.FLAGS_ALLOW_RAW_RESOURCES,
            disableLocalSites: env.FLAGS_DISABLE_LOCAL_SITES,
            disableBasicWireguardSites: env.FLAGS_DISABLE_BASIC_WIREGUARD_SITES,
            enableClients: env.FLAGS_ENABLE_CLIENTS,
            hideSupporterKey: env.HIDE_SUPPORTER_KEY,
            usePangolinDns: env.USE_PANGOLIN_DNS
        },
        branding: {
            appName: env.BRANDING_APP_NAME,
            background_image_path: env.BACKGROUND_IMAGE_PATH,
            logo: {
                lightPath: env.BRANDING_LOGO_LIGHT_PATH,
                darkPath: env.BRANDING_LOGO_DARK_PATH,
                authPage: {
                    width: env.BRANDING_LOGO_AUTH_WIDTH,
                    height: env.BRANDING_LOGO_AUTH_HEIGHT
                },
                navbar: {
                    width: env.BRANDING_LOGO_NAVBAR_WIDTH,
                    height: env.BRANDING_LOGO_NAVBAR_HEIGHT
                }
            },
            loginPage: {
                titleText: env.LOGIN_PAGE_TITLE_TEXT,
                subtitleText: env.LOGIN_PAGE_SUBTITLE_TEXT
            },
            signupPage: {
                titleText: env.SIGNUP_PAGE_TITLE_TEXT,
                subtitleText: env.SIGNUP_PAGE_SUBTITLE_TEXT
            },
            resourceAuthPage: {
                showLogo: env.RESOURCE_AUTH_PAGE_SHOW_LOGO,
                hidePoweredBy: env.RESOURCE_AUTH_PAGE_HIDE_POWERED_BY,
                titleText: env.RESOURCE_AUTH_PAGE_TITLE_TEXT,
                subtitleText: env.RESOURCE_AUTH_PAGE_SUBTITLE_TEXT
            },
            footer: env.BRANDING_FOOTER
        }
    };
}
