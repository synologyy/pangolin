export type DomainType = "organization" | "provided" | "provided-search";

export const SINGLE_LABEL_RE = /^[\p{L}\p{N}-]+$/u; // provided-search (no dots)
export const MULTI_LABEL_RE = /^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)*$/u; // ns/wildcard
export const SINGLE_LABEL_STRICT_RE =
    /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u; // start/end alnum

export function sanitizeInputRaw(input: string): string {
    if (!input) return "";
    return input
        .toLowerCase()
        .normalize("NFC") // normalize Unicode
        .replace(/[^\p{L}\p{N}.-]/gu, ""); // allow Unicode letters, numbers, dot, hyphen
}

export function finalizeSubdomainSanitize(input: string): string {
    if (!input) return "";
    return input
        .toLowerCase()
        .normalize("NFC")
        .replace(/[^\p{L}\p{N}.-]/gu, "") // allow Unicode
        .replace(/\.{2,}/g, ".") // collapse multiple dots
        .replace(/^-+|-+$/g, "") // strip leading/trailing hyphens
        .replace(/^\.+|\.+$/g, "") // strip leading/trailing dots
        .replace(/(\.-)|(-\.)/g, "."); // fix illegal dot-hyphen combos
}

export function validateByDomainType(
    subdomain: string,
    domainType: {
        type: "provided-search" | "organization";
        domainType?: "ns" | "cname" | "wildcard";
    }
): boolean {
    if (!domainType) return false;

    if (domainType.type === "provided-search") {
        return SINGLE_LABEL_RE.test(subdomain);
    }

    if (domainType.type === "organization") {
        if (domainType.domainType === "cname") {
            return subdomain === "";
        } else if (
            domainType.domainType === "ns" ||
            domainType.domainType === "wildcard"
        ) {
            if (subdomain === "") return true;
            if (!MULTI_LABEL_RE.test(subdomain)) return false;
            const labels = subdomain.split(".");
            return labels.every(
                (l) =>
                    l.length >= 1 && l.length <= 63 && SINGLE_LABEL_RE.test(l)
            );
        }
    }
    return false;
}

export const isValidSubdomainStructure = (input: string): boolean => {
    const regex = /^(?!-)([\p{L}\p{N}-]{1,63})(?<!-)$/u;

    if (!input) return false;
    if (input.includes("..")) return false;

    return input.split(".").every((label) => regex.test(label));
};
