import { db } from "@server/db";
import { domains, orgDomains } from "@server/db";
import { eq, and } from "drizzle-orm";
import { subdomainSchema } from "@server/lib/schemas";
import { fromError } from "zod-validation-error";

export type DomainValidationResult =
    | {
          success: true;
          fullDomain: string;
          subdomain: string | null;
      }
    | {
          success: false;
          error: string;
      };

/**
 * Validates a domain and constructs the full domain based on domain type and subdomain.
 *
 * @param domainId - The ID of the domain to validate
 * @param orgId - The organization ID to check domain access
 * @param subdomain - Optional subdomain to append (for ns and wildcard domains)
 * @returns DomainValidationResult with success status and either fullDomain/subdomain or error message
 */
export async function validateAndConstructDomain(
    domainId: string,
    orgId: string,
    subdomain?: string | null
): Promise<DomainValidationResult> {
    try {
        // Query domain with organization access check
        const [domainRes] = await db
            .select()
            .from(domains)
            .where(eq(domains.domainId, domainId))
            .leftJoin(
                orgDomains,
                and(
                    eq(orgDomains.orgId, orgId),
                    eq(orgDomains.domainId, domainId)
                )
            );

        // Check if domain exists
        if (!domainRes || !domainRes.domains) {
            return {
                success: false,
                error: `Domain with ID ${domainId} not found`
            };
        }

        // Check if organization has access to domain
        if (domainRes.orgDomains && domainRes.orgDomains.orgId !== orgId) {
            return {
                success: false,
                error: `Organization does not have access to domain with ID ${domainId}`
            };
        }

        // Check if domain is verified
        if (!domainRes.domains.verified) {
            return {
                success: false,
                error: `Domain with ID ${domainId} is not verified`
            };
        }

        // Construct full domain based on domain type
        let fullDomain = "";
        let finalSubdomain = subdomain;

        if (domainRes.domains.type === "ns") {
            if (subdomain) {
                fullDomain = `${subdomain}.${domainRes.domains.baseDomain}`;
            } else {
                fullDomain = domainRes.domains.baseDomain;
            }
        } else if (domainRes.domains.type === "cname") {
            fullDomain = domainRes.domains.baseDomain;
            finalSubdomain = null; // CNAME domains don't use subdomains
        } else if (domainRes.domains.type === "wildcard") {
            if (subdomain !== undefined && subdomain !== null) {
                // Validate subdomain format for wildcard domains
                const parsedSubdomain = subdomainSchema.safeParse(subdomain);
                if (!parsedSubdomain.success) {
                    return {
                        success: false,
                        error: fromError(parsedSubdomain.error).toString()
                    };
                }
                fullDomain = `${subdomain}.${domainRes.domains.baseDomain}`;
            } else {
                fullDomain = domainRes.domains.baseDomain;
            }
        }

        // If the full domain equals the base domain, set subdomain to null
        if (fullDomain === domainRes.domains.baseDomain) {
            finalSubdomain = null;
        }

        // Convert to lowercase
        fullDomain = fullDomain.toLowerCase();

        return {
            success: true,
            fullDomain,
            subdomain: finalSubdomain ?? null
        };
    } catch (error) {
        return {
            success: false,
            error: `An error occurred while validating domain: ${error instanceof Error ? error.message : "Unknown error"}`
        };
    }
}
