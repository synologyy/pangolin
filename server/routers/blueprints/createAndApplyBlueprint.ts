import { OpenAPITags, registry } from "@server/openApi";
import z from "zod";
import { applyBlueprint } from "@server/lib/blueprints/applyBlueprint";
import { NextFunction, Request, Response } from "express";
import logger from "@server/logger";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import { fromZodError } from "zod-validation-error";
import response from "@server/lib/response";
import { type Blueprint, blueprints, db, loginPage } from "@server/db";
import { parse as parseYaml } from "yaml";
import { ConfigSchema } from "@server/lib/blueprints/types";
import { BlueprintSource } from "./types";

const applyBlueprintSchema = z
    .object({
        name: z.string().min(1).max(255),
        contents: z
            .string()
            .min(1)
            .superRefine((val, ctx) => {
                try {
                    parseYaml(val);
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

        logger.debug(`Received blueprint:`, contents);

        const parsedConfig = parseYaml(contents);
        // apply the validation in advance so that error concerning the format are ruled out first
        const validationResult = ConfigSchema.safeParse(parsedConfig);
        if (!validationResult.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromZodError(validationResult.error)
                )
            );
        }

        let blueprintSucceeded: boolean;
        let blueprintMessage: string;

        try {
            await applyBlueprint(orgId, parsedConfig);
            blueprintSucceeded = true;
            blueprintMessage = "success";
        } catch (error) {
            blueprintSucceeded = false;
            blueprintMessage = `Failed to update blueprint from config: ${error}`;
            logger.error(blueprintMessage);
        }

        let blueprint: Blueprint | null = null;
        await db.transaction(async (trx) => {
            const newBlueprint = await trx
                .insert(blueprints)
                .values({
                    orgId,
                    name,
                    contents,
                    createdAt: Math.floor(Date.now() / 1000),
                    succeeded: blueprintSucceeded,
                    message: blueprintMessage,
                    source: "UI" as BlueprintSource
                })
                .returning();

            blueprint = newBlueprint[0];
        });

        if (!blueprint) {
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    "Failed to create resource"
                )
            );
        }

        return response(res, {
            data: blueprint,
            success: true,
            error: false,
            message: blueprintSucceeded
                ? "Blueprint applied with success"
                : `Blueprint applied with errors: ${blueprintMessage}`,
            status: HttpCode.CREATED
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
