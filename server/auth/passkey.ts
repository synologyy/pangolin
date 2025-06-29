import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { db } from "@server/db";
import { webAuthnCredentials } from "@server/db";
import { eq } from "drizzle-orm";
import config from "@server/lib/config";

const rpID = new URL(config.getRawConfig().app.dashboard_url).hostname;
const rpName = "Pangolin";

const registerChallenges = new Map<string, string>();
const loginChallenges = new Map<string, string>();

export async function startRegistration(userId: string, userName: string) {
    const options = await generateRegistrationOptions({
        rpID,
        rpName,
        userID: userId,
        userName
    });
    registerChallenges.set(userId, options.challenge);
    return options;
}

export async function finishRegistration(userId: string, response: any) {
    const expectedChallenge = registerChallenges.get(userId);
    const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: config.getRawConfig().app.dashboard_url,
        expectedRPID: rpID
    });

    if (!verification.verified || !verification.registrationInfo) {
        return false;
    }
    const { credentialPublicKey, credentialID, counter } =
        verification.registrationInfo;
    await db.insert(webAuthnCredentials).values({
        credentialId: Buffer.from(credentialID).toString("base64url"),
        publicKey: Buffer.from(credentialPublicKey).toString("base64"),
        userId,
        counter
    });
    registerChallenges.delete(userId);
    return true;
}

export async function startLogin(userId: string) {
    const creds = await db
        .select()
        .from(webAuthnCredentials)
        .where(eq(webAuthnCredentials.userId, userId));
    const allowCredentials = creds.map((c) => ({
        id: Buffer.from(c.credentialId, "base64url"),
        type: "public-key" as const
    }));
    const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials
    });
    loginChallenges.set(userId, options.challenge);
    return options;
}

export async function finishLogin(response: any) {
    const credId = Buffer.from(response.rawId, "base64url").toString("base64url");
    const creds = await db
        .select()
        .from(webAuthnCredentials)
        .where(eq(webAuthnCredentials.credentialId, credId));
    if (!creds.length) {
        return { verified: false, userId: null };
    }
    const credential = creds[0];
    const expectedChallenge = loginChallenges.get(credential.userId);
    const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: config.getRawConfig().app.dashboard_url,
        expectedRPID: rpID,
        authenticator: {
            credentialID: Buffer.from(credential.credentialId, "base64url"),
            credentialPublicKey: Buffer.from(credential.publicKey, "base64"),
            counter: credential.counter
        }
    });
    if (verification.verified && verification.authenticationInfo) {
        await db
            .update(webAuthnCredentials)
            .set({ counter: verification.authenticationInfo.newCounter })
            .where(eq(webAuthnCredentials.credentialId, credential.credentialId));
        loginChallenges.delete(credential.userId);
        return { verified: true, userId: credential.userId };
    }
    return { verified: false, userId: credential.userId };
}
