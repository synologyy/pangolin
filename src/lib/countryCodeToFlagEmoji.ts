export function countryCodeToFlagEmoji(isoAlpha2: string) {
    const codePoints = [...isoAlpha2.toUpperCase()].map(
        (char) => 0x1f1e6 + char.charCodeAt(0) - 65
    );
    return String.fromCodePoint(...codePoints);
}
