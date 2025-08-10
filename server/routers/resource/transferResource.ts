import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { newts, resources, sites, targets } from "@server/db";
import { eq } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { addPeer } from "../gerbil/peers";
import { addTargets, removeTargets } from "../newt/targets";
import { getAllowedIps } from "../target/helpers";
import { OpenAPITags, registry } from "@server/openApi";

const transferResourceParamsSchema = z
    .object({
        resourceId: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive())
    })
    .strict();

const transferResourceBodySchema = z
    .object({
        siteId: z.number().int().positive()
    })
    .strict();

registry.registerPath({
    method: "post",
    path: "/resource/{resourceId}/transfer",
    description:
        "Transfer a resource to a different site. This will also transfer the targets associated with the resource.",
    tags: [OpenAPITags.Resource],
    request: {
        params: transferResourceParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: transferResourceBodySchema
                }
            }
        }
    },
    responses: {}
});

export async function transferResource(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = transferResourceParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const parsedBody = transferResourceBodySchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { resourceId } = parsedParams.data;
        const { siteId } = parsedBody.data;

        const [oldResource] = await db
            .select()
            .from(resources)
            .where(eq(resources.resourceId, resourceId))
            .limit(1);

        if (!oldResource) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Resource with ID ${resourceId} not found`
                )
            );
        }

        if (oldResource.siteId === siteId) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    `Resource is already assigned to this site`
                )
            );
        }

        const [newSite] = await db
            .select()
            .from(sites)
            .where(eq(sites.siteId, siteId))
            .limit(1);

        if (!newSite) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Site with ID ${siteId} not found`
                )
            );
        }

        const [oldSite] = await db
            .select()
            .from(sites)
            .where(eq(sites.siteId, oldResource.siteId))
            .limit(1);

        if (!oldSite) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Site with ID ${oldResource.siteId} not found`
                )
            );
        }

        const [updatedResource] = await db
            .update(resources)
            .set({ siteId })
            .where(eq(resources.resourceId, resourceId))
            .returning();

        if (!updatedResource) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Resource with ID ${resourceId} not found`
                )
            );
        }

        const resourceTargets = await db
            .select()
            .from(targets)
            .where(eq(targets.resourceId, resourceId));

        if (resourceTargets.length > 0) {
            ////// REMOVE THE TARGETS FROM THE OLD SITE //////
            if (oldSite.pubKey) {
                if (oldSite.type == "wireguard") {
                    await addPeer(oldSite.exitNodeId!, {
                        publicKey: oldSite.pubKey,
                        allowedIps: await getAllowedIps(oldSite.siteId)
                    });
                } else if (oldSite.type == "newt") {
                    const [newt] = await db
                        .select()
                        .from(newts)
                        .where(eq(newts.siteId, oldSite.siteId))
                        .limit(1);

                    removeTargets(
                        newt.newtId,
                        resourceTargets,
                        updatedResource.protocol,
                        updatedResource.proxyPort
                    );
                }
            }

            ////// ADD THE TARGETS TO THE NEW SITE //////
            if (newSite.pubKey) {
                if (newSite.type == "wireguard") {
                    await addPeer(newSite.exitNodeId!, {
                        publicKey: newSite.pubKey,
                        allowedIps: await getAllowedIps(newSite.siteId)
                    });
                } else if (newSite.type == "newt") {
                    const [newt] = await db
                        .select()
                        .from(newts)
                        .where(eq(newts.siteId, newSite.siteId))
                        .limit(1);

                    addTargets(
                        newt.newtId,
                        resourceTargets,
                        updatedResource.protocol,
                        updatedResource.proxyPort
                    );
                }
            }
        }

        return response(res, {
            data: updatedResource,
            success: true,
            error: false,
            message: "Resource transferred successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
