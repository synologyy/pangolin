import fs from "fs";
import yaml from "js-yaml";
import { configFilePath1, configFilePath2 } from "./consts";
import { z } from "zod";
import stoi from "./stoi";
import { build } from "@server/build";
import { setAdminCredentials } from "@cli/commands/setAdminCredentials";

const portSchema = z.number().positive().gt(0).lte(65535);

const getEnvOrYaml = (envVar: string) => (valFromYaml: any) => {
    return process.env[envVar] ?? valFromYaml;
};

export const configSchema = z
    .object({
        app: z.object({
            dashboard_url: z
                .string()
                .url()
                .optional()
                .pipe(z.string().url())
                .transform((url) => url.toLowerCase()),
            log_level: z
                .enum(["debug", "info", "warn", "error"])
                .optional()
                .default("info"),
            save_logs: z.boolean().optional().default(false),
            log_failed_attempts: z.boolean().optional().default(false)
        }),
        hybrid: z
            .object({
                id: z.string().optional(),
                secret: z.string().optional(),
                endpoint: z.string().optional(),
                redirect_endpoint: z.string().optional()
            })
            .optional(),
        domains: z
            .record(
                z.string(),
                z.object({
                    base_domain: z
                        .string()
                        .nonempty("base_domain must not be empty")
                        .transform((url) => url.toLowerCase()),
                    cert_resolver: z.string().optional().default("letsencrypt"),
                    prefer_wildcard_cert: z.boolean().optional().default(false)
                })
            )
            .optional(),
        server: z.object({
            integration_port: portSchema
                .optional()
                .default(3003)
                .transform(stoi)
                .pipe(portSchema.optional()),
            external_port: portSchema
                .optional()
                .default(3000)
                .transform(stoi)
                .pipe(portSchema),
            internal_port: portSchema
                .optional()
                .default(3001)
                .transform(stoi)
                .pipe(portSchema),
            next_port: portSchema
                .optional()
                .default(3002)
                .transform(stoi)
                .pipe(portSchema),
            internal_hostname: z
                .string()
                .optional()
                .default("pangolin")
                .transform((url) => url.toLowerCase()),
            session_cookie_name: z
                .string()
                .optional()
                .default("p_session_token"),
            resource_access_token_param: z
                .string()
                .optional()
                .default("p_token"),
            resource_access_token_headers: z
                .object({
                    id: z.string().optional().default("P-Access-Token-Id"),
                    token: z.string().optional().default("P-Access-Token")
                })
                .optional()
                .default({}),
            resource_session_request_param: z
                .string()
                .optional()
                .default("resource_session_request_param"),
            dashboard_session_length_hours: z
                .number()
                .positive()
                .gt(0)
                .optional()
                .default(720),
            resource_session_length_hours: z
                .number()
                .positive()
                .gt(0)
                .optional()
                .default(720),
            cors: z
                .object({
                    origins: z.array(z.string()).optional(),
                    methods: z.array(z.string()).optional(),
                    allowed_headers: z.array(z.string()).optional(),
                    credentials: z.boolean().optional()
                })
                .optional(),
            trust_proxy: z.number().int().gte(0).optional().default(1),
            secret: z
                .string()
                .optional()
                .transform(getEnvOrYaml("SERVER_SECRET"))
                .pipe(z.string().min(8))
        }),
        postgres: z
            .object({
                connection_string: z.string(),
                replicas: z
                    .array(
                        z.object({
                            connection_string: z.string()
                        })
                    )
                    .optional()
            })
            .optional(),
        traefik: z
            .object({
                http_entrypoint: z.string().optional().default("web"),
                https_entrypoint: z.string().optional().default("websecure"),
                additional_middlewares: z.array(z.string()).optional(),
                cert_resolver: z.string().optional().default("letsencrypt"),
                prefer_wildcard_cert: z.boolean().optional().default(false),
                certificates_path: z.string().default("./certificates"),
                monitor_interval: z.number().default(5000),
                dynamic_cert_config_path: z
                    .string()
                    .optional()
                    .default("./dynamic/cert_config.yml"),
                dynamic_router_config_path: z
                    .string()
                    .optional()
                    .default("./dynamic/router_config.yml"),
                staticDomains: z.array(z.string()).optional().default([])
            })
            .optional()
            .default({}),
        gerbil: z
            .object({
                exit_node_name: z.string().optional(),
                start_port: portSchema
                    .optional()
                    .default(51820)
                    .transform(stoi)
                    .pipe(portSchema),
                base_endpoint: z
                    .string()
                    .optional()
                    .pipe(z.string())
                    .transform((url) => url.toLowerCase()),
                use_subdomain: z.boolean().optional().default(false),
                subnet_group: z.string().optional().default("100.89.137.0/20"),
                block_size: z.number().positive().gt(0).optional().default(24),
                site_block_size: z
                    .number()
                    .positive()
                    .gt(0)
                    .optional()
                    .default(30)
            })
            .optional()
            .default({}),
        orgs: z
            .object({
                block_size: z.number().positive().gt(0).optional().default(24),
                subnet_group: z.string().optional().default("100.90.128.0/24")
            })
            .optional()
            .default({
                block_size: 24,
                subnet_group: "100.90.128.0/24"
            }),
        rate_limits: z
            .object({
                global: z
                    .object({
                        window_minutes: z
                            .number()
                            .positive()
                            .gt(0)
                            .optional()
                            .default(1),
                        max_requests: z
                            .number()
                            .positive()
                            .gt(0)
                            .optional()
                            .default(500)
                    })
                    .optional()
                    .default({}),
                auth: z
                    .object({
                        window_minutes: z
                            .number()
                            .positive()
                            .gt(0)
                            .optional()
                            .default(1),
                        max_requests: z
                            .number()
                            .positive()
                            .gt(0)
                            .optional()
                            .default(500)
                    })
                    .optional()
                    .default({})
            })
            .optional()
            .default({}),
        email: z
            .object({
                smtp_host: z.string().optional(),
                smtp_port: portSchema.optional(),
                smtp_user: z.string().optional(),
                smtp_pass: z
                    .string()
                    .optional()
                    .transform(getEnvOrYaml("EMAIL_SMTP_PASS")),
                smtp_secure: z.boolean().optional(),
                smtp_tls_reject_unauthorized: z.boolean().optional(),
                no_reply: z.string().email().optional()
            })
            .optional(),
        flags: z
            .object({
                require_email_verification: z.boolean().optional(),
                disable_signup_without_invite: z.boolean().optional(),
                disable_user_create_org: z.boolean().optional(),
                allow_raw_resources: z.boolean().optional(),
                enable_integration_api: z.boolean().optional(),
                disable_local_sites: z.boolean().optional(),
                disable_basic_wireguard_sites: z.boolean().optional(),
                disable_config_managed_domains: z.boolean().optional(),
                enable_clients: z.boolean().optional().default(true)
            })
            .optional(),
        dns: z
            .object({
                nameservers: z
                    .array(z.string().optional().optional())
                    .optional()
                    .default(["ns1.fossorial.io", "ns2.fossorial.io"]),
                cname_extension: z.string().optional().default("fossorial.io")
            })
            .optional()
            .default({
                nameservers: ["ns1.fossorial.io", "ns2.fossorial.io"],
                cname_extension: "fossorial.io"
            })
    })
    .refine(
        (data) => {
            const keys = Object.keys(data.domains || {});
            if (data.flags?.disable_config_managed_domains) {
                return true;
            }
            if (keys.length === 0) {
                return false;
            }
            return true;
        },
        {
            message: "At least one domain must be defined"
        }
    );

export function readConfigFile() {
    const loadConfig = (configPath: string) => {
        try {
            const yamlContent = fs.readFileSync(configPath, "utf8");
            const config = yaml.load(yamlContent);
            return config;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(
                    `Error loading configuration file: ${error.message}`
                );
            }
            throw error;
        }
    };

    let environment: any;
    if (fs.existsSync(configFilePath1)) {
        environment = loadConfig(configFilePath1);
    } else if (fs.existsSync(configFilePath2)) {
        environment = loadConfig(configFilePath2);
    }

    if (!environment) {
        throw new Error(
            "No configuration file found. Please create one. https://docs.digpangolin.com/self-host/advanced/config-file"
        );
    }

    return environment;
}
