import { Request, Response } from "express";
import { db, exitNodes } from "@server/db";
import { and, eq, inArray, or, isNull, ne, isNotNull } from "drizzle-orm";
import logger from "@server/logger";
import HttpCode from "@server/types/HttpCode";
import config from "@server/lib/config";
import { orgs, resources, sites, Target, targets } from "@server/db";
import { build } from "@server/build";

let currentExitNodeId: number;
const redirectHttpsMiddlewareName = "redirect-to-https";
const badgerMiddlewareName = "badger";

export async function getCurrentExitNodeId(): Promise<number> {
    if (!currentExitNodeId) {
        if (config.getRawConfig().gerbil.exit_node_name) {
            const exitNodeName = config.getRawConfig().gerbil.exit_node_name!;
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
    return currentExitNodeId;
}

export async function traefikConfigProvider(
    _: Request,
    res: Response
): Promise<any> {
    try {
        // First query to get resources with site and org info
        // Get the current exit node name from config
        await getCurrentExitNodeId();

        const traefikConfig = await getTraefikConfig(
            currentExitNodeId,
            config.getRawConfig().traefik.site_types
        );

        if (traefikConfig?.http?.middlewares) {
            // BECAUSE SOMETIMES THE CONFIG CAN BE EMPTY IF THERE IS NOTHING
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
        }

        return res.status(HttpCode.OK).json(traefikConfig);
    } catch (e) {
        logger.error(`Failed to build Traefik config: ${e}`);
        return res.status(HttpCode.INTERNAL_SERVER_ERROR).json({
            error: "Failed to build Traefik config"
        });
    }
}


function validatePathRewriteConfig(
    path: string | null,
    pathMatchType: string | null,
    rewritePath: string | null,
    rewritePathType: string | null
): { isValid: boolean; error?: string } {
    // If no path matching is configured, no rewriting is possible
    if (!path || !pathMatchType) {
        if (rewritePath || rewritePathType) {
            return {
                isValid: false,
                error: "Path rewriting requires path matching to be configured"
            };
        }
        return { isValid: true };
    }

    if ((rewritePath && !rewritePathType) || (!rewritePath && rewritePathType)) {
        return {
            isValid: false,
            error: "Both rewritePath and rewritePathType must be specified together"
        };
    }

    if (!rewritePath || !rewritePathType) {
        return { isValid: true };
    }

    const validPathMatchTypes = ["exact", "prefix", "regex"];
    if (!validPathMatchTypes.includes(pathMatchType)) {
        return {
            isValid: false,
            error: `Invalid pathMatchType: ${pathMatchType}. Must be one of: ${validPathMatchTypes.join(", ")}`
        };
    }

    const validRewritePathTypes = ["exact", "prefix", "regex", "stripPrefix"];
    if (!validRewritePathTypes.includes(rewritePathType)) {
        return {
            isValid: false,
            error: `Invalid rewritePathType: ${rewritePathType}. Must be one of: ${validRewritePathTypes.join(", ")}`
        };
    }

    if (pathMatchType === "regex") {
        try {
            new RegExp(path);
        } catch (e) {
            return {
                isValid: false,
                error: `Invalid regex pattern in path: ${path}`
            };
        }
    }

    if (rewritePathType === "regex") {
        // For regex rewrite type, we don't validate the replacement pattern
        // as it may contain capture groups like $1, $2, etc.
        // The regex engine will handle validation at runtime
    }

    // Validate path formats for non-regex types
    if (pathMatchType !== "regex" && !path.startsWith("/")) {
        return {
            isValid: false,
            error: "Path must start with '/' for exact and prefix matching"
        };
    }

    // Additional validation for stripPrefix
    if (rewritePathType === "stripPrefix") {
        if (pathMatchType !== "prefix") {
            logger.warn(`stripPrefix rewrite type is most effective with prefix path matching. Current match type: ${pathMatchType}`);
        }
        // For stripPrefix, rewritePath is optional (can be empty to just strip)
        if (rewritePath && !rewritePath.startsWith("/") && rewritePath !== "") {
            return {
                isValid: false,
                error: "stripPrefix rewritePath must start with '/' or be empty"
            };
        }
    }

    return { isValid: true };
}


function createPathRewriteMiddleware(
    middlewareName: string,
    path: string,
    pathMatchType: string,
    rewritePath: string,
    rewritePathType: string
): { [key: string]: any } {
    const middlewares: { [key: string]: any } = {};

    switch (rewritePathType) {
        case "exact":
            // Replace the entire path with the exact rewrite path
            middlewares[middlewareName] = {
                replacePathRegex: {
                    regex: "^.*$",
                    replacement: rewritePath
                }
            };
            break;

        case "prefix":
            // Replace matched prefix with new prefix, preserve the rest
            switch (pathMatchType) {
                case "prefix":
                    middlewares[middlewareName] = {
                        replacePathRegex: {
                            regex: `^${escapeRegex(path)}(.*)`,
                            replacement: `${rewritePath}$1`
                        }
                    };
                    break;
                case "exact":
                    middlewares[middlewareName] = {
                        replacePathRegex: {
                            regex: `^${escapeRegex(path)}$`,
                            replacement: rewritePath
                        }
                    };
                    break;
                case "regex":
                    // For regex path matching with prefix rewrite, we assume the regex has capture groups
                    middlewares[middlewareName] = {
                        replacePathRegex: {
                            regex: path,
                            replacement: rewritePath
                        }
                    };
                    break;
            }
            break;

        case "regex":
            // Use advanced regex replacement - works with any match type
            let regexPattern: string;
            if (pathMatchType === "regex") {
                regexPattern = path;
            } else if (pathMatchType === "prefix") {
                regexPattern = `^${escapeRegex(path)}(.*)`;
            } else { // exact
                regexPattern = `^${escapeRegex(path)}$`;
            }

            middlewares[middlewareName] = {
                replacePathRegex: {
                    regex: regexPattern,
                    replacement: rewritePath
                }
            };
            break;

        case "stripPrefix":
            // Strip the matched prefix and optionally add new path
            if (pathMatchType === "prefix") {
                middlewares[middlewareName] = {
                    stripPrefix: {
                        prefixes: [path]
                    }
                };

                // If rewritePath is provided and not empty, add it as a prefix after stripping
                if (rewritePath && rewritePath !== "" && rewritePath !== "/") {
                    const addPrefixMiddlewareName = `${middlewareName.replace('-rewrite', '')}-add-prefix-middleware`;
                    middlewares[addPrefixMiddlewareName] = {
                        addPrefix: {
                            prefix: rewritePath
                        }
                    };
                    // Return both middlewares with a special flag to indicate chaining
                    return { 
                        middlewares, 
                        chain: [middlewareName, addPrefixMiddlewareName] 
                    };
                }
            } else {
                // For exact and regex matches, use replacePathRegex to strip
                let regexPattern: string;
                if (pathMatchType === "exact") {
                    regexPattern = `^${escapeRegex(path)}$`;
                } else if (pathMatchType === "regex") {
                    regexPattern = path;
                } else {
                    // This shouldn't happen due to earlier validation, but handle gracefully
                    regexPattern = `^${escapeRegex(path)}`;
                }

                const replacement = rewritePath || "/";
                middlewares[middlewareName] = {
                    replacePathRegex: {
                        regex: regexPattern,
                        replacement: replacement
                    }
                };
            }
            break;

        default:
            logger.error(`Unknown rewritePathType: ${rewritePathType}`);
            throw new Error(`Unknown rewritePathType: ${rewritePathType}`);
    }

    return { middlewares };
}

export async function getTraefikConfig(
    exitNodeId: number,
    siteTypes: string[]
): Promise<any> {
    // Define extended target type with site information
    type TargetWithSite = Target & {
        site: {
            siteId: number;
            type: string;
            subnet: string | null;
            exitNodeId: number | null;
            online: boolean;
        };
    };

    // Get resources with their targets and sites in a single optimized query
    // Start from sites on this exit node, then join to targets and resources
    const resourcesWithTargetsAndSites = await db
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
            headers: resources.headers,
            // Target fields
            targetId: targets.targetId,
            targetEnabled: targets.enabled,
            ip: targets.ip,
            method: targets.method,
            port: targets.port,
            internalPort: targets.internalPort,
            path: targets.path,
            pathMatchType: targets.pathMatchType,
            rewritePath: targets.rewritePath,
            rewritePathType: targets.rewritePathType,
            // Site fields
            siteId: sites.siteId,
            siteType: sites.type,
            siteOnline: sites.online,
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
                or(eq(sites.exitNodeId, exitNodeId), isNull(sites.exitNodeId)),
                inArray(sites.type, siteTypes),
                config.getRawConfig().traefik.allow_raw_resources
                    ? isNotNull(resources.http) // ignore the http check if allow_raw_resources is true
                    : eq(resources.http, true)
            )
        );

    // Group by resource and include targets with their unique site data
    const resourcesMap = new Map();

    resourcesWithTargetsAndSites.forEach((row) => {
        const resourceId = row.resourceId;
        const targetPath = sanitizePath(row.path) || ""; // Handle null/undefined paths
        const pathMatchType = row.pathMatchType || "";
        const rewritePath = row.rewritePath || "";
        const rewritePathType = row.rewritePathType || "";

        // Create a unique key combining resourceId, path config, and rewrite config
        const pathKey = [targetPath, pathMatchType, rewritePath, rewritePathType]
            .filter(Boolean)
            .join("-");
        const mapKey = [resourceId, pathKey].filter(Boolean).join("-");

        if (!resourcesMap.has(mapKey)) {
            const validation = validatePathRewriteConfig(
                row.path,
                row.pathMatchType,
                row.rewritePath,
                row.rewritePathType
            );

            if (!validation.isValid) {
                logger.error(`Invalid path rewrite configuration for resource ${resourceId}: ${validation.error}`);
                return; 
            }

            resourcesMap.set(mapKey, {
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
                targets: [],
                headers: row.headers,
                path: row.path, // the targets will all have the same path
                pathMatchType: row.pathMatchType, // the targets will all have the same pathMatchType
                rewritePath: row.rewritePath,
                rewritePathType: row.rewritePathType
            });
        }

        // Add target with its associated site data
        resourcesMap.get(mapKey).targets.push({
            resourceId: row.resourceId,
            targetId: row.targetId,
            ip: row.ip,
            method: row.method,
            port: row.port,
            internalPort: row.internalPort,
            enabled: row.targetEnabled,
            rewritePath: row.rewritePath,
            rewritePathType: row.rewritePathType,
            site: {
                siteId: row.siteId,
                type: row.siteType,
                subnet: row.subnet,
                exitNodeId: row.exitNodeId,
                online: row.siteOnline
            }
        });
    });

    // make sure we have at least one resource
    if (resourcesMap.size === 0) {
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

    // get the key and the resource
    for (const [key, resource] of resourcesMap.entries()) {
        const targets = resource.targets;

        const routerName = `${key}-router`;
        const serviceName = `${key}-service`;
        const fullDomain = `${resource.fullDomain}`;
        const transportName = `${key}-transport`;
        const headersMiddlewareName = `${key}-headers-middleware`;

        if (!resource.enabled) {
            continue;
        }

        if (resource.http) {
            if (!resource.domainId || !resource.fullDomain) {
                continue;
            }

            // Initialize routers and services if they don't exist
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

            const routerMiddlewares = [
                badgerMiddlewareName,
                ...additionalMiddlewares
            ];

            // Handle path rewriting middleware
            if (resource.rewritePath && 
                resource.path && 
                resource.pathMatchType && 
                resource.rewritePathType) {

                const rewriteMiddlewareName = `${resource.id}-${key}-rewrite`;

                try {
                    const rewriteResult = createPathRewriteMiddleware(
                        rewriteMiddlewareName,
                        resource.path,
                        resource.pathMatchType,
                        resource.rewritePath,
                        resource.rewritePathType
                    );

                    // Initialize middlewares object if it doesn't exist
                    if (!config_output.http.middlewares) {
                        config_output.http.middlewares = {};
                    }

                    // Add the middleware(s) to the config
                    Object.assign(config_output.http.middlewares, rewriteResult.middlewares);

                    // Add middleware(s) to the router middleware chain
                    if (rewriteResult.chain) {
                        // For chained middlewares (like stripPrefix + addPrefix)
                        routerMiddlewares.push(...rewriteResult.chain);
                    } else {
                        // Single middleware
                        routerMiddlewares.push(rewriteMiddlewareName);
                    }

                    logger.info(`Created path rewrite middleware for ${key}: ${resource.pathMatchType}(${resource.path}) -> ${resource.rewritePathType}(${resource.rewritePath})`);
                } catch (error) {
                    logger.error(`Failed to create path rewrite middleware for ${key}: ${error}`);
                    // Continue without the rewrite middleware rather than failing completely
                }
            }

            // Handle custom headers middleware
            if (resource.headers || resource.setHostHeader) {
                // if there are headers, parse them into an object
                const headersObj: { [key: string]: string } = {};
                if (resource.headers) {
                    let headersArr: { name: string; value: string }[] = [];
                    try {
                        headersArr = JSON.parse(resource.headers) as {
                            name: string;
                            value: string;
                        }[];
                    } catch (e) {
                        logger.warn(
                            `Failed to parse headers for resource ${resource.resourceId}: ${e}`
                        );
                    }

                    headersArr.forEach((header) => {
                        headersObj[header.name] = header.value;
                    });
                }

                if (resource.setHostHeader) {
                    headersObj["Host"] = resource.setHostHeader;
                }

                // check if the object is not empty
                if (Object.keys(headersObj).length > 0) {
                    // Add the headers middleware
                    if (!config_output.http.middlewares) {
                        config_output.http.middlewares = {};
                    }
                    config_output.http.middlewares[headersMiddlewareName] = {
                        headers: {
                            customRequestHeaders: headersObj
                        }
                    };

                    routerMiddlewares.push(headersMiddlewareName);
                }
            }

            let rule = `Host(\`${fullDomain}\`)`;
            let priority = 100;
            if (resource.path && resource.pathMatchType) {
                priority += 1;
                // add path to rule based on match type
                let path = resource.path;
                // if the path doesn't start with a /, add it
                if (!path.startsWith("/")) {
                    path = `/${path}`;
                }
                if (resource.pathMatchType === "exact") {
                    rule += ` && Path(\`${path}\`)`;
                } else if (resource.pathMatchType === "prefix") {
                    rule += ` && PathPrefix(\`${path}\`)`;
                } else if (resource.pathMatchType === "regex") {
                    rule += ` && PathRegexp(\`${resource.path}\`)`; // this is the raw path because it's a regex
                }
            }

            config_output.http.routers![routerName] = {
                entryPoints: [
                    resource.ssl
                        ? config.getRawConfig().traefik.https_entrypoint
                        : config.getRawConfig().traefik.http_entrypoint
                ],
                middlewares: routerMiddlewares,
                service: serviceName,
                rule: rule,
                priority: priority,
                ...(resource.ssl ? { tls } : {})
            };

            if (resource.ssl) {
                config_output.http.routers![routerName + "-redirect"] = {
                    entryPoints: [
                        config.getRawConfig().traefik.http_entrypoint
                    ],
                    middlewares: [redirectHttpsMiddlewareName],
                    service: serviceName,
                    rule: rule,
                    priority: priority
                };
            }

            config_output.http.services![serviceName] = {
                loadBalancer: {
                    servers: (() => {
                        // Check if any sites are online
                        // THIS IS SO THAT THERE IS SOME IMMEDIATE FEEDBACK
                        // EVEN IF THE SITES HAVE NOT UPDATED YET FROM THE
                        // RECEIVE BANDWIDTH ENDPOINT.

                        // TODO: HOW TO HANDLE ^^^^^^ BETTER
                        const anySitesOnline = (
                            targets as TargetWithSite[]
                        ).some((target: TargetWithSite) => target.site.online);

                        return (
                            (targets as TargetWithSite[])
                            .filter((target: TargetWithSite) => {
                                if (!target.enabled) {
                                    return false;
                                }

                                    // If any sites are online, exclude offline sites
                                if (anySitesOnline && !target.site.online) {
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
                                        const ip =
                                            target.site.subnet!.split("/")[0];
                                    return {
                                        url: `${target.method}://${ip}:${target.internalPort}`
                                    };
                                }
                            })
                                // filter out duplicates
                                .filter(
                                    (v, i, a) =>
                                        a.findIndex(
                                            (t) => t && v && t.url === v.url
                                        ) === i
                                )
                        );
                    })(),
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
                    servers: (() => {
                        // Check if any sites are online
                        const anySitesOnline = (
                            targets as TargetWithSite[]
                        ).some((target: TargetWithSite) => target.site.online);

                        return (targets as TargetWithSite[])
                            .filter((target: TargetWithSite) => {
                                if (!target.enabled) {
                                    return false;
                                }

                                // If any sites are online, exclude offline sites
                                if (anySitesOnline && !target.site.online) {
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
                                    if (
                                        !target.internalPort ||
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
                                        address: `${target.ip}:${target.port}`
                                    };
                                } else if (target.site.type === "newt") {
                                    const ip =
                                        target.site.subnet!.split("/")[0];
                                    return {
                                        address: `${ip}:${target.internalPort}`
                                    };
                                }
                            });
                    })(),
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

function sanitizePath(path: string | null | undefined): string | undefined {
    if (!path) return undefined;
    
    // For path rewriting, we need to be more careful about sanitization
    // Only limit length and ensure it's a valid path structure
    if (path.length > 50) {
        path = path.substring(0, 50);
        logger.warn(`Path truncated to 50 characters: ${path}`);
    }
    
    // Don't remove special characters as they might be part of regex patterns
    // Just ensure it's not empty after trimming
    return path.trim() || undefined;
}

function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}