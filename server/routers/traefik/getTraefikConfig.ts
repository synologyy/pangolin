import { Request, Response } from "express";
import { db, exitNodes } from "@server/db";
import { and, eq, inArray, or, isNull } from "drizzle-orm";
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

        let traefikConfig = await getTraefikConfig(currentExitNodeId);

        traefikConfig.http.middlewares[badgerMiddlewareName] = {
            plugin: {
                [badgerMiddlewareName]: {
                    apiBaseUrl: new URL(
                        "/api/v0",
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

export async function getTraefikConfig(exitNodeId: number): Promise<any> {
    // Get all resources with related data
    const allResources = await db.transaction(async (tx) => {
        // Get the site(s) on this exit node
        const resourcesWithRelations = await tx
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
                // Site fields
                site: {
                    siteId: sites.siteId,
                    type: sites.type,
                    subnet: sites.subnet,
                    exitNodeId: sites.exitNodeId
                },
                enabled: resources.enabled,
                stickySession: resources.stickySession,
                tlsServerName: resources.tlsServerName,
                setHostHeader: resources.setHostHeader,
                enableProxy: resources.enableProxy
            })
            .from(resources)
            .innerJoin(sites, eq(sites.siteId, resources.siteId))
            .where(
                or(eq(sites.exitNodeId, exitNodeId), isNull(sites.exitNodeId))
            );

        // Get all resource IDs from the first query
        const resourceIds = resourcesWithRelations.map((r) => r.resourceId);

        // Second query to get all enabled targets for these resources
        const allTargets =
            resourceIds.length > 0
                ? await tx
                      .select({
                          resourceId: targets.resourceId,
                          targetId: targets.targetId,
                          ip: targets.ip,
                          method: targets.method,
                          port: targets.port,
                          internalPort: targets.internalPort,
                          enabled: targets.enabled
                      })
                      .from(targets)
                      .where(
                          and(
                              inArray(targets.resourceId, resourceIds),
                              eq(targets.enabled, true)
                          )
                      )
                : [];

        // Create a map for fast target lookup by resourceId
        const targetsMap = allTargets.reduce((map, target) => {
            if (!map.has(target.resourceId)) {
                map.set(target.resourceId, []);
            }
            map.get(target.resourceId).push(target);
            return map;
        }, new Map());

        // Combine the data
        return resourcesWithRelations.map((resource) => ({
            ...resource,
            targets: targetsMap.get(resource.resourceId) || []
        }));
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
        const targets = resource.targets as Target[];
        const site = resource.site;

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
                    servers: targets
                        .filter((target: Target) => {
                            if (!target.enabled) {
                                return false;
                            }
                            if (
                                site.type === "local" ||
                                site.type === "wireguard"
                            ) {
                                if (
                                    !target.ip ||
                                    !target.port ||
                                    !target.method
                                ) {
                                    return false;
                                }
                            } else if (site.type === "newt") {
                                if (
                                    !target.internalPort ||
                                    !target.method ||
                                    !site.subnet
                                ) {
                                    return false;
                                }
                            }
                            return true;
                        })
                        .map((target: Target) => {
                            if (
                                site.type === "local" ||
                                site.type === "wireguard"
                            ) {
                                return {
                                    url: `${target.method}://${target.ip}:${target.port}`
                                };
                            } else if (site.type === "newt") {
                                const ip = site.subnet!.split("/")[0];
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
                    servers: targets
                        .filter((target: Target) => {
                            if (!target.enabled) {
                                return false;
                            }
                            if (
                                site.type === "local" ||
                                site.type === "wireguard"
                            ) {
                                if (!target.ip || !target.port) {
                                    return false;
                                }
                            } else if (site.type === "newt") {
                                if (!target.internalPort || !site.subnet) {
                                    return false;
                                }
                            }
                            return true;
                        })
                        .map((target: Target) => {
                            if (
                                site.type === "local" ||
                                site.type === "wireguard"
                            ) {
                                return {
                                    address: `${target.ip}:${target.port}`
                                };
                            } else if (site.type === "newt") {
                                const ip = site.subnet!.split("/")[0];
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
