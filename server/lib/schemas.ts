import { z } from "zod";

export const subdomainSchema = z
    .string()
    .regex(
        /^(?!:\/\/)([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/,
        "Invalid subdomain format"
    )
    .min(1, "Subdomain must be at least 1 character long")
    .transform((val) => val.toLowerCase());

export const tlsNameSchema = z
    .string()
    .regex(
        /^(?!:\/\/)([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$|^$/,
        "Invalid subdomain format"
    )
    .transform((val) => val.toLowerCase());

