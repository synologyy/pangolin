import { OpenAPITags, registry } from "@server/openApi";
import z from "zod";
import { applyBlueprint as applyBlueprintFunc } from "@server/lib/blueprints/applyBlueprint";
import { NextFunction, Request, Response } from "express";
import logger from "@server/logger";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import { fromZodError } from "zod-validation-error";
import response from "@server/lib/response";
import { type Blueprint, blueprints, db, loginPage } from "@server/db";
import { parse as parseYaml } from "yaml";

const applyBlueprintSchema = z
    .object({
        name: z.string().min(1).max(255),
        contents: z
            .string()
            .min(1)
            .superRefine((contents, ctx) => {
                try {
                    parseYaml(contents);
                } catch (error) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Invalid YAML: ${error instanceof Error ? error.message : "Unknown error"}`
                    });
                }
            })
    })
    .strict();

const applyBlueprintParamsSchema = z
    .object({
        orgId: z.string()
    })
    .strict();

export type CreateBlueprintResponse = Blueprint;

registry.registerPath({
    method: "post",
    path: "/org/{orgId}/blueprint",
    description:
        "Create and Apply a base64 encoded blueprint to an organization",
    tags: [OpenAPITags.Org],
    request: {
        params: applyBlueprintParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: applyBlueprintSchema
                }
            }
        }
    },
    responses: {}
});

export async function createAndApplyBlueprint(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = applyBlueprintParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromZodError(parsedParams.error)
                )
            );
        }

        const { orgId } = parsedParams.data;

        const parsedBody = applyBlueprintSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromZodError(parsedBody.error)
                )
            );
        }

        const { contents, name } = parsedBody.data;

        logger.debug(`Received blueprint: ${contents}`);

        // try {
        //     // then parse the json
        //     const blueprintParsed = parseYaml(contents);

        //     // Update the blueprint in the database
        //     await applyBlueprintFunc(orgId, blueprintParsed);

        //     await db.transaction(async (trx) => {
        //         const newBlueprint = await trx
        //             .insert(blueprints)
        //             .values({
        //                 orgId,
        //                 name,
        //                 contents
        //                 // createdAt
        //             })
        //             .returning();
        //     });
        // } catch (error) {
        //     logger.error(`Failed to update database from config: ${error}`);

        //     return next(
        //         createHttpError(
        //             HttpCode.BAD_REQUEST,
        //             `Failed to update database from config: ${error}`
        //         )
        //     );
        // }

        return response(res, {
            data: null,
            success: true,
            error: false,
            message: "Blueprint applied successfully",
            status: HttpCode.CREATED
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
