import { z } from "zod";

export const MaintenanceSchema = z.object({
    enabled: z.boolean().optional(),
    type: z.enum(["forced", "automatic"]).optional(),
    title: z.string().max(255).nullable().optional(),
    message: z.string().max(2000).nullable().optional(),
    "estimated-time": z.string().max(100).nullable().optional()
});
