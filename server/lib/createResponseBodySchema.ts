import z, { type ZodSchema } from "zod";

export function createResponseBodySchema<T extends ZodSchema>(dataSchema: T) {
    return z.object({
        data: dataSchema.nullable(),
        success: z.boolean(),
        error: z.boolean(),
        message: z.string(),
        status: z.number()
    });
}

export default createResponseBodySchema;
