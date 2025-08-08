import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import {
    domains,
    orgDomains,
    orgs,
    Resource,
    resources,
    roleResources,
    roles,
    userResources
} from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import { eq, and } from "drizzle-orm";
import stoi from "@server/lib/stoi";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";
import { subdomainSchema } from "@server/lib/schemas";
import config from "@server/lib/config";
import { OpenAPITags, registry } from "@server/openApi";
import { build } from "@server/build";

const createResourceParamsSchema = z
    .object({
        siteId: z.string().transform(stoi).pipe(z.number().int().positive()),
        orgId: z.string()
    })
    .strict();

const createHttpResourceSchema = z
    .object({
        name: z.string().min(1).max(255),
        subdomain: z.string().nullable().optional(),
        siteId: z.number(),
        http: z.boolean(),
        protocol: z.enum(["tcp", "udp"]),
        domainId: z.string()
    })
    .strict()
    .refine(
        (data) => {
            if (data.subdomain) {
                return subdomainSchema.safeParse(data.subdomain).success;
            }
            return true;
        },
        { message: "Invalid subdomain" }
    );

const createRawResourceSchema = z
    .object({
        name: z.string().min(1).max(255),
        siteId: z.number(),
        http: z.boolean(),
        protocol: z.enum(["tcp", "udp"]),
        proxyPort: z.number().int().min(1).max(65535),
        enableProxy: z.boolean().default(true)
    })
    .strict()
    .refine(
        (data) => {
            if (!config.getRawConfig().flags?.allow_raw_resources) {
                if (data.proxyPort !== undefined) {
                    return false;
                }
            }
            return true;
        },
        {
            message: "Raw resources are not allowed"
        }
    );

export type CreateResourceResponse = Resource;

registry.registerPath({
    method: "put",
    path: "/org/{orgId}/site/{siteId}/resource",
    description: "Create a resource.",
    tags: [OpenAPITags.Org, OpenAPITags.Resource],
    request: {
        params: createResourceParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: createHttpResourceSchema.or(createRawResourceSchema)
                }
            }
        }
    },
    responses: {}
});

export async function createResource(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        // Validate request params
        const parsedParams = createResourceParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { siteId, orgId } = parsedParams.data;

        if (req.user && !req.userOrgRoleId) {
            return next(
                createHttpError(HttpCode.FORBIDDEN, "User does not have a role")
            );
        }

        // get the org
        const org = await db
            .select()
            .from(orgs)
            .where(eq(orgs.orgId, orgId))
            .limit(1);

        if (org.length === 0) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Organization with ID ${orgId} not found`
                )
            );
        }

        if (typeof req.body.http !== "boolean") {
            return next(
                createHttpError(HttpCode.BAD_REQUEST, "http field is required")
            );
        }

        const { http } = req.body;

        if (http) {
            return await createHttpResource(
                { req, res, next },
                { siteId, orgId }
            );
        } else {
            if (
                !config.getRawConfig().flags?.allow_raw_resources &&
                build == "oss"
            ) {
                return next(
                    createHttpError(
                        HttpCode.BAD_REQUEST,
                        "Raw resources are not allowed"
                    )
                );
            }
            return await createRawResource(
                { req, res, next },
                { siteId, orgId }
            );
        }
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}

async function createHttpResource(
    route: {
        req: Request;
        res: Response;
        next: NextFunction;
    },
    meta: {
        siteId: number;
        orgId: string;
    }
) {
    const { req, res, next } = route;
    const { siteId, orgId } = meta;

    const parsedBody = createHttpResourceSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    const { name, domainId } = parsedBody.data;
    let subdomain = parsedBody.data.subdomain;

    const [domainRes] = await db
        .select()
        .from(domains)
        .where(eq(domains.domainId, domainId))
        .leftJoin(
            orgDomains,
            and(eq(orgDomains.orgId, orgId), eq(orgDomains.domainId, domainId))
        );

    if (!domainRes || !domainRes.domains) {
        return next(
            createHttpError(
                HttpCode.NOT_FOUND,
                `Domain with ID ${domainId} not found`
            )
        );
    }

    if (domainRes.orgDomains && domainRes.orgDomains.orgId !== orgId) {
        return next(
            createHttpError(
                HttpCode.FORBIDDEN,
                `Organization does not have access to domain with ID ${domainId}`
            )
        );
    }

    if (!domainRes.domains.verified) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                `Domain with ID ${domainRes.domains.domainId} is not verified`
            )
        );
    }

    let fullDomain = "";
    if (domainRes.domains.type == "ns") {
        if (subdomain) {
            fullDomain = `${subdomain}.${domainRes.domains.baseDomain}`;
        } else {
            fullDomain = domainRes.domains.baseDomain;
        }
    } else if (domainRes.domains.type == "cname") {
        fullDomain = domainRes.domains.baseDomain;
    } else if (domainRes.domains.type == "wildcard") {
        if (subdomain) {
            // the subdomain cant have a dot in it
            const parsedSubdomain = subdomainSchema.safeParse(subdomain);
            if (!parsedSubdomain.success) {
                return next(
                    createHttpError(
                        HttpCode.BAD_REQUEST,
                        fromError(parsedSubdomain.error).toString()
                    )
                );
            }
            fullDomain = `${subdomain}.${domainRes.domains.baseDomain}`;
        } else {
            fullDomain = domainRes.domains.baseDomain;
        }
    }

    if (fullDomain === domainRes.domains.baseDomain) {
        subdomain = null;
    }

    fullDomain = fullDomain.toLowerCase();

    logger.debug(`Full domain: ${fullDomain}`);

    // make sure the full domain is unique
    const existingResource = await db
        .select()
        .from(resources)
        .where(eq(resources.fullDomain, fullDomain));

    if (existingResource.length > 0) {
        return next(
            createHttpError(
                HttpCode.CONFLICT,
                "Resource with that domain already exists"
            )
        );
    }

    let resource: Resource | undefined;

    await db.transaction(async (trx) => {
        const newResource = await trx
            .insert(resources)
            .values({
                siteId,
                fullDomain,
                domainId,
                orgId,
                name,
                subdomain,
                http: true,
                protocol: "tcp",
                ssl: true
            })
            .returning();

        const adminRole = await db
            .select()
            .from(roles)
            .where(and(eq(roles.isAdmin, true), eq(roles.orgId, orgId)))
            .limit(1);

        if (adminRole.length === 0) {
            return next(
                createHttpError(HttpCode.NOT_FOUND, `Admin role not found`)
            );
        }

        await trx.insert(roleResources).values({
            roleId: adminRole[0].roleId,
            resourceId: newResource[0].resourceId
        });

        if (req.user && req.userOrgRoleId != adminRole[0].roleId) {
            // make sure the user can access the resource
            await trx.insert(userResources).values({
                userId: req.user?.userId!,
                resourceId: newResource[0].resourceId
            });
        }

        resource = newResource[0];
    });

    if (!resource) {
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to create resource"
            )
        );
    }

    return response<CreateResourceResponse>(res, {
        data: resource,
        success: true,
        error: false,
        message: "Http resource created successfully",
        status: HttpCode.CREATED
    });
}

async function createRawResource(
    route: {
        req: Request;
        res: Response;
        next: NextFunction;
    },
    meta: {
        siteId: number;
        orgId: string;
    }
) {
    const { req, res, next } = route;
    const { siteId, orgId } = meta;

    const parsedBody = createRawResourceSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    const { name, http, protocol, proxyPort, enableProxy } = parsedBody.data;

    // if http is false check to see if there is already a resource with the same port and protocol
    const existingResource = await db
        .select()
        .from(resources)
        .where(
            and(
                eq(resources.protocol, protocol),
                eq(resources.proxyPort, proxyPort!)
            )
        );

    if (existingResource.length > 0) {
        return next(
            createHttpError(
                HttpCode.CONFLICT,
                "Resource with that protocol and port already exists"
            )
        );
    }

    let resource: Resource | undefined;

    await db.transaction(async (trx) => {
        const newResource = await trx
            .insert(resources)
            .values({
                siteId,
                orgId,
                name,
                http,
                protocol,
                proxyPort,
                enableProxy
            })
            .returning();

        const adminRole = await db
            .select()
            .from(roles)
            .where(and(eq(roles.isAdmin, true), eq(roles.orgId, orgId)))
            .limit(1);

        if (adminRole.length === 0) {
            return next(
                createHttpError(HttpCode.NOT_FOUND, `Admin role not found`)
            );
        }

        await trx.insert(roleResources).values({
            roleId: adminRole[0].roleId,
            resourceId: newResource[0].resourceId
        });

        if (req.user && req.userOrgRoleId != adminRole[0].roleId) {
            // make sure the user can access the resource
            await trx.insert(userResources).values({
                userId: req.user?.userId!,
                resourceId: newResource[0].resourceId
            });
        }

        resource = newResource[0];
    });

    if (!resource) {
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to create resource"
            )
        );
    }

    return response<CreateResourceResponse>(res, {
        data: resource,
        success: true,
        error: false,
        message: "Non-http resource created successfully",
        status: HttpCode.CREATED
    });
}
