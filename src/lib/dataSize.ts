export function parseDataSize(sizeStr: string): number {
    if (typeof sizeStr !== "string") return 0;

    const match = /^\s*([\d.]+)\s*([KMGT]?B)\s*$/i.exec(sizeStr);
    if (!match) return 0;

    const [, numStr, unitRaw] = match;
    const num = parseFloat(numStr);
    if (isNaN(num)) return 0;

    const unit = unitRaw.toUpperCase();
    const multipliers = {
        B: 1,
        KB: 1024,
        MB: 1024 ** 2,
        GB: 1024 ** 3,
        TB: 1024 ** 4
    } as const;

    return num * (multipliers[unit as keyof typeof multipliers] ?? 1);
}
