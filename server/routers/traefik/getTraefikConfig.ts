import { Request, Response } from "express";
import { db, exitNodes } from "@server/db";
import { and, eq, inArray, or, isNull, ne } from "drizzle-orm";
import logger from "@server/logger";
import HttpCode from "@server/types/HttpCode";
import config from "@server/lib/config";
import { orgs, resources, sites, Target, targets } from "@server/db";
import { build } from "@server/build";

let currentExitNodeId: number;
const redirectHttpsMiddlewareName = "redirect-to-https";
const badgerMiddlewareName = "badger";

export async function traefikConfigProvider(
    _: Request,
    res: Response
): Promise<any> {
    try {
        // First query to get resources with site and org info
        // Get the current exit node name from config
        if (!currentExitNodeId) {
            if (config.getRawConfig().gerbil.exit_node_name) {
                const exitNodeName =
                    config.getRawConfig().gerbil.exit_node_name!;
                const [exitNode] = await db
                    .select({
                        exitNodeId: exitNodes.exitNodeId
                    })
                    .from(exitNodes)
                    .where(eq(exitNodes.name, exitNodeName));
                if (exitNode) {
                    currentExitNodeId = exitNode.exitNodeId;
                }
            } else {
                const [exitNode] = await db
                    .select({
                        exitNodeId: exitNodes.exitNodeId
                    })
                    .from(exitNodes)
                    .limit(1);

                if (exitNode) {
                    currentExitNodeId = exitNode.exitNodeId;
                }
            }
        }

        let traefikConfig = await getTraefikConfig(currentExitNodeId, config.getRawConfig().traefik.site_types);

        traefikConfig.http.middlewares[badgerMiddlewareName] = {
            plugin: {
                [badgerMiddlewareName]: {
                    apiBaseUrl: new URL(
                        "/api/v1",
                        `http://${
                            config.getRawConfig().server.internal_hostname
                        }:${config.getRawConfig().server.internal_port}`
                    ).href,
                    userSessionCookieName:
                        config.getRawConfig().server.session_cookie_name,

                    // deprecated
                    accessTokenQueryParam:
                        config.getRawConfig().server
                            .resource_access_token_param,

                    resourceSessionRequestParam:
                        config.getRawConfig().server
                            .resource_session_request_param
                }
            }
        };

        return res.status(HttpCode.OK).json(traefikConfig);
    } catch (e) {
        logger.error(`Failed to build Traefik config: ${e}`);
        return res.status(HttpCode.INTERNAL_SERVER_ERROR).json({
            error: "Failed to build Traefik config"
        });
    }
}

export async function getTraefikConfig(exitNodeId: number, siteTypes: string[]): Promise<any> {
    // Define extended target type with site information
    type TargetWithSite = Target & {
        site: {
            siteId: number;
            type: string;
            subnet: string | null;
            exitNodeId: number | null;
        };
    };

    // Get all resources with related data
    const allResources = await db.transaction(async (tx) => {
        // Get resources with their targets and sites in a single optimized query
        // Start from sites on this exit node, then join to targets and resources
        const resourcesWithTargetsAndSites = await tx
            .select({
                // Resource fields
                resourceId: resources.resourceId,
                fullDomain: resources.fullDomain,
                ssl: resources.ssl,
                http: resources.http,
                proxyPort: resources.proxyPort,
                protocol: resources.protocol,
                subdomain: resources.subdomain,
                domainId: resources.domainId,
                enabled: resources.enabled,
                stickySession: resources.stickySession,
                tlsServerName: resources.tlsServerName,
                setHostHeader: resources.setHostHeader,
                enableProxy: resources.enableProxy,
                // Target fields
                targetId: targets.targetId,
                targetEnabled: targets.enabled,
                ip: targets.ip,
                method: targets.method,
                port: targets.port,
                internalPort: targets.internalPort,
                // Site fields
                siteId: sites.siteId,
                siteType: sites.type,
                subnet: sites.subnet,
                exitNodeId: sites.exitNodeId
            })
            .from(sites)
            .innerJoin(targets, eq(targets.siteId, sites.siteId))
            .innerJoin(resources, eq(resources.resourceId, targets.resourceId))
            .where(
                and(
                    eq(targets.enabled, true),
                    eq(resources.enabled, true),
                    or(
                        eq(sites.exitNodeId, exitNodeId),
                        isNull(sites.exitNodeId)
                    ),
                    inArray(sites.type, siteTypes),
                )
            );

        // Group by resource and include targets with their unique site data
        const resourcesMap = new Map();

        resourcesWithTargetsAndSites.forEach((row) => {
            const resourceId = row.resourceId;

            if (!resourcesMap.has(resourceId)) {
                resourcesMap.set(resourceId, {
                    resourceId: row.resourceId,
                    fullDomain: row.fullDomain,
                    ssl: row.ssl,
                    http: row.http,
                    proxyPort: row.proxyPort,
                    protocol: row.protocol,
                    subdomain: row.subdomain,
                    domainId: row.domainId,
                    enabled: row.enabled,
                    stickySession: row.stickySession,
                    tlsServerName: row.tlsServerName,
                    setHostHeader: row.setHostHeader,
                    enableProxy: row.enableProxy,
                    targets: []
                });
            }

            // Add target with its associated site data
            resourcesMap.get(resourceId).targets.push({
                resourceId: row.resourceId,
                targetId: row.targetId,
                ip: row.ip,
                method: row.method,
                port: row.port,
                internalPort: row.internalPort,
                enabled: row.targetEnabled,
                site: {
                    siteId: row.siteId,
                    type: row.siteType,
                    subnet: row.subnet,
                    exitNodeId: row.exitNodeId
                }
            });
        });

        return Array.from(resourcesMap.values());
    });

    if (!allResources.length) {
        return {};
    }

    const config_output: any = {
        http: {
            middlewares: {
                [redirectHttpsMiddlewareName]: {
                    redirectScheme: {
                        scheme: "https"
                    }
                }
            }
        }
    };

    for (const resource of allResources) {
        const targets = resource.targets;

        const routerName = `${resource.resourceId}-router`;
        const serviceName = `${resource.resourceId}-service`;
        const fullDomain = `${resource.fullDomain}`;
        const transportName = `${resource.resourceId}-transport`;
        const hostHeaderMiddlewareName = `${resource.resourceId}-host-header-middleware`;

        if (!resource.enabled) {
            continue;
        }

        if (resource.http) {
            if (!resource.domainId) {
                continue;
            }

            if (!resource.fullDomain) {
                logger.error(
                    `Resource ${resource.resourceId} has no fullDomain`
                );
                continue;
            }

            // add routers and services empty objects if they don't exist
            if (!config_output.http.routers) {
                config_output.http.routers = {};
            }

            if (!config_output.http.services) {
                config_output.http.services = {};
            }

            const domainParts = fullDomain.split(".");
            let wildCard;
            if (domainParts.length <= 2) {
                wildCard = `*.${domainParts.join(".")}`;
            } else {
                wildCard = `*.${domainParts.slice(1).join(".")}`;
            }

            if (!resource.subdomain) {
                wildCard = resource.fullDomain;
            }

            const configDomain = config.getDomain(resource.domainId);

            let certResolver: string, preferWildcardCert: boolean;
            if (!configDomain) {
                certResolver = config.getRawConfig().traefik.cert_resolver;
                preferWildcardCert =
                    config.getRawConfig().traefik.prefer_wildcard_cert;
            } else {
                certResolver = configDomain.cert_resolver;
                preferWildcardCert = configDomain.prefer_wildcard_cert;
            }

            let tls = {};
            if (build == "oss") {
                tls = {
                    certResolver: certResolver,
                    ...(preferWildcardCert
                        ? {
                              domains: [
                                  {
                                      main: wildCard
                                  }
                              ]
                          }
                        : {})
                };
            }

            const additionalMiddlewares =
                config.getRawConfig().traefik.additional_middlewares || [];

            config_output.http.routers![routerName] = {
                entryPoints: [
                    resource.ssl
                        ? config.getRawConfig().traefik.https_entrypoint
                        : config.getRawConfig().traefik.http_entrypoint
                ],
                middlewares: [badgerMiddlewareName, ...additionalMiddlewares],
                service: serviceName,
                rule: `Host(\`${fullDomain}\`)`,
                priority: 100,
                ...(resource.ssl ? { tls } : {})
            };

            if (resource.ssl) {
                config_output.http.routers![routerName + "-redirect"] = {
                    entryPoints: [
                        config.getRawConfig().traefik.http_entrypoint
                    ],
                    middlewares: [redirectHttpsMiddlewareName],
                    service: serviceName,
                    rule: `Host(\`${fullDomain}\`)`,
                    priority: 100
                };
            }

            config_output.http.services![serviceName] = {
                loadBalancer: {
                    servers: (targets as TargetWithSite[])
                        .filter((target: TargetWithSite) => {
                            if (!target.enabled) {
                                return false;
                            }
                            if (
                                target.site.type === "local" ||
                                target.site.type === "wireguard"
                            ) {
                                if (
                                    !target.ip ||
                                    !target.port ||
                                    !target.method
                                ) {
                                    return false;
                                }
                            } else if (target.site.type === "newt") {
                                if (
                                    !target.internalPort ||
                                    !target.method ||
                                    !target.site.subnet
                                ) {
                                    return false;
                                }
                            }
                            return true;
                        })
                        .map((target: TargetWithSite) => {
                            if (
                                target.site.type === "local" ||
                                target.site.type === "wireguard"
                            ) {
                                return {
                                    url: `${target.method}://${target.ip}:${target.port}`
                                };
                            } else if (target.site.type === "newt") {
                                const ip = target.site.subnet!.split("/")[0];
                                return {
                                    url: `${target.method}://${ip}:${target.internalPort}`
                                };
                            }
                        }),
                    ...(resource.stickySession
                        ? {
                              sticky: {
                                  cookie: {
                                      name: "p_sticky", // TODO: make this configurable via config.yml like other cookies
                                      secure: resource.ssl,
                                      httpOnly: true
                                  }
                              }
                          }
                        : {})
                }
            };

            // Add the serversTransport if TLS server name is provided
            if (resource.tlsServerName) {
                if (!config_output.http.serversTransports) {
                    config_output.http.serversTransports = {};
                }
                config_output.http.serversTransports![transportName] = {
                    serverName: resource.tlsServerName,
                    //unfortunately the following needs to be set. traefik doesn't merge the default serverTransport settings
                    // if defined in the static config and here. if not set, self-signed certs won't work
                    insecureSkipVerify: true
                };
                config_output.http.services![
                    serviceName
                ].loadBalancer.serversTransport = transportName;
            }

            // Add the host header middleware
            if (resource.setHostHeader) {
                if (!config_output.http.middlewares) {
                    config_output.http.middlewares = {};
                }
                config_output.http.middlewares[hostHeaderMiddlewareName] = {
                    headers: {
                        customRequestHeaders: {
                            Host: resource.setHostHeader
                        }
                    }
                };
                if (!config_output.http.routers![routerName].middlewares) {
                    config_output.http.routers![routerName].middlewares = [];
                }
                config_output.http.routers![routerName].middlewares = [
                    ...config_output.http.routers![routerName].middlewares,
                    hostHeaderMiddlewareName
                ];
            }
        } else {
            // Non-HTTP (TCP/UDP) configuration
            if (!resource.enableProxy) {
                continue;
            }

            const protocol = resource.protocol.toLowerCase();
            const port = resource.proxyPort;

            if (!port) {
                continue;
            }

            if (!config_output[protocol]) {
                config_output[protocol] = {
                    routers: {},
                    services: {}
                };
            }

            config_output[protocol].routers[routerName] = {
                entryPoints: [`${protocol}-${port}`],
                service: serviceName,
                ...(protocol === "tcp" ? { rule: "HostSNI(`*`)" } : {})
            };

            config_output[protocol].services[serviceName] = {
                loadBalancer: {
                    servers: (targets as TargetWithSite[])
                        .filter((target: TargetWithSite) => {
                            if (!target.enabled) {
                                return false;
                            }
                            if (
                                target.site.type === "local" ||
                                target.site.type === "wireguard"
                            ) {
                                if (!target.ip || !target.port) {
                                    return false;
                                }
                            } else if (target.site.type === "newt") {
                                if (!target.internalPort || !target.site.subnet) {
                                    return false;
                                }
                            }
                            return true;
                        })
                        .map((target: TargetWithSite) => {
                            if (
                                target.site.type === "local" ||
                                target.site.type === "wireguard"
                            ) {
                                return {
                                    address: `${target.ip}:${target.port}`
                                };
                            } else if (target.site.type === "newt") {
                                const ip = target.site.subnet!.split("/")[0];
                                return {
                                    address: `${ip}:${target.internalPort}`
                                };
                            }
                        }),
                    ...(resource.stickySession
                        ? {
                              sticky: {
                                  ipStrategy: {
                                      depth: 0,
                                      sourcePort: true
                                  }
                              }
                          }
                        : {})
                }
            };
        }
    }
    return config_output;
}
