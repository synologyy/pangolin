import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db, newts } from "@server/db";
import { siteResources, sites, orgs, SiteResource } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import { eq, and } from "drizzle-orm";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";
import { OpenAPITags, registry } from "@server/openApi";
import { addTargets } from "../client/targets";

const createSiteResourceParamsSchema = z
    .object({
        siteId: z.string().transform(Number).pipe(z.number().int().positive()),
        orgId: z.string()
    })
    .strict();

const createSiteResourceSchema = z
    .object({
        name: z.string().min(1).max(255),
        protocol: z.enum(["tcp", "udp"]),
        proxyPort: z.number().int().positive(),
        destinationPort: z.number().int().positive(),
        destinationIp: z.string().ip(),
        enabled: z.boolean().default(true)
    })
    .strict();

export type CreateSiteResourceBody = z.infer<typeof createSiteResourceSchema>;
export type CreateSiteResourceResponse = SiteResource;

registry.registerPath({
    method: "put",
    path: "/org/{orgId}/site/{siteId}/resource",
    description: "Create a new site resource.",
    tags: [OpenAPITags.Client, OpenAPITags.Org],
    request: {
        params: createSiteResourceParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: createSiteResourceSchema
                }
            }
        }
    },
    responses: {}
});

export async function createSiteResource(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = createSiteResourceParamsSchema.safeParse(
            req.params
        );
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const parsedBody = createSiteResourceSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { siteId, orgId } = parsedParams.data;
        const {
            name,
            protocol,
            proxyPort,
            destinationPort,
            destinationIp,
            enabled
        } = parsedBody.data;

        // Verify the site exists and belongs to the org
        const [site] = await db
            .select()
            .from(sites)
            .where(and(eq(sites.siteId, siteId), eq(sites.orgId, orgId)))
            .limit(1);

        if (!site) {
            return next(createHttpError(HttpCode.NOT_FOUND, "Site not found"));
        }

        // check if resource with same protocol and proxy port already exists
        const [existingResource] = await db
            .select()
            .from(siteResources)
            .where(
                and(
                    eq(siteResources.siteId, siteId),
                    eq(siteResources.orgId, orgId),
                    eq(siteResources.protocol, protocol),
                    eq(siteResources.proxyPort, proxyPort)
                )
            )
            .limit(1);
        if (existingResource && existingResource.siteResourceId) {
            return next(
                createHttpError(
                    HttpCode.CONFLICT,
                    "A resource with the same protocol and proxy port already exists"
                )
            );
        }

        // Create the site resource
        const [newSiteResource] = await db
            .insert(siteResources)
            .values({
                siteId,
                orgId,
                name,
                protocol,
                proxyPort,
                destinationPort,
                destinationIp,
                enabled
            })
            .returning();

        const [newt] = await db
            .select()
            .from(newts)
            .where(eq(newts.siteId, site.siteId))
            .limit(1);

        if (!newt) {
            return next(createHttpError(HttpCode.NOT_FOUND, "Newt not found"));
        }

        await addTargets(newt.newtId, destinationIp, destinationPort, protocol);

        logger.info(
            `Created site resource ${newSiteResource.siteResourceId} for site ${siteId}`
        );

        return response(res, {
            data: newSiteResource,
            success: true,
            error: false,
            message: "Site resource created successfully",
            status: HttpCode.CREATED
        });
    } catch (error) {
        logger.error("Error creating site resource:", error);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to create site resource"
            )
        );
    }
}
