type PatternConfig = {
    name: string;
    regex: RegExp;
};

const patterns: PatternConfig[] = [
    { name: "Invite Token", regex: /^\/invite\?token=[a-zA-Z0-9-]+$/ },
    { name: "Setup", regex: /^\/setup$/ },
    { name: "Resource Auth Portal", regex: /^\/auth\/resource\/\d+$/ }
];

export function cleanRedirect(input: string, fallback: string = "/"): string {
    if (!input || typeof input !== "string") {
        return fallback;
    }
    const isAccepted = patterns.some((pattern) => pattern.regex.test(input));
    return isAccepted ? input : fallback;
}
