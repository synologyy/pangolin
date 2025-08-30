
export type DomainType = "organization" | "provided" | "provided-search";

export const SINGLE_LABEL_RE = /^[a-z0-9-]+$/i; // provided-search (no dots)
export const MULTI_LABEL_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/i; // ns/wildcard
export const SINGLE_LABEL_STRICT_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i; // start/end alnum


export function sanitizeInputRaw(input: string): string {
  if (!input) return "";
  return input.toLowerCase().replace(/[^a-z0-9.-]/g, "");
}

export function finalizeSubdomainSanitize(input: string): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "")   // allow only valid chars
    .replace(/\.{2,}/g, ".")       // collapse multiple dots
    .replace(/^-+|-+$/g, "")       // strip leading/trailing hyphens
    .replace(/^\.+|\.+$/g, "");    // strip leading/trailing dots
}




export function validateByDomainType(subdomain: string, domainType: { type: "provided-search" | "organization"; domainType?: "ns" | "cname" | "wildcard" } ): boolean {
  if (!domainType) return false;

  if (domainType.type === "provided-search") {
    return SINGLE_LABEL_RE.test(subdomain);
  }

  if (domainType.type === "organization") {
    if (domainType.domainType === "cname") {
      return subdomain === "";
    } else if (domainType.domainType === "ns" || domainType.domainType === "wildcard") {
      if (subdomain === "") return true;
      if (!MULTI_LABEL_RE.test(subdomain)) return false;
      const labels = subdomain.split(".");
      return labels.every(l => l.length >= 1 && l.length <= 63 && SINGLE_LABEL_RE.test(l));
    }
  }
  return false;
}



export const isValidSubdomainStructure = (input: string): boolean => {
  const regex = /^(?!-)([a-zA-Z0-9-]{1,63})(?<!-)$/;

  if (!input) return false;
  if (input.includes("..")) return false;

  return input.split(".").every(label => regex.test(label));
};



