import { z } from "zod";


export const subdomainSchema = z
    .string()
    .regex(
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
        "Invalid subdomain format"
    )
    .min(1, "Subdomain must be at least 1 character long")
    .max(63, "Subdomain must not exceed 63 characters")
    .transform((val) => val.toLowerCase());

export const tlsNameSchema = z
    .string()
    .regex(
        /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/,
        "Invalid subdomain format"
    ).max(253, "Domain must not exceed 253 characters")
  .refine((val) => {
    const labels = val.split('.');
    return labels.every((label) => label.length <= 63);
  }, "Each part of the domain must not exceed 63 characters")
    .transform((val) => val.toLowerCase());