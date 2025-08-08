import { alphabet, generateRandomString } from "oslo/crypto";

export async function generateBackupCodes(): Promise<string[]> {
    const codes = [];
    for (let i = 0; i < 10; i++) {
        const code = generateRandomString(6, alphabet("0-9", "A-Z", "a-z"));
        codes.push(code);
    }
    return codes;
}
