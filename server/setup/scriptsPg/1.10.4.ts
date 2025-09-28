import { db } from "@server/db/pg/driver";
import { sql } from "drizzle-orm";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

const version = "1.10.4";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    try {
        await db.execute(sql`BEGIN`);

        const webauthnCredentialsQuery = await db.execute(sql`SELECT credentialId, publicKey FROM 'webauthnCredentials'`);

        const webauthnCredentials = webauthnCredentialsQuery.rows as { credentialId: string; publicKey: string }[];

        for (const webauthnCredential of webauthnCredentials) {
            const credentialId = isoBase64URL.fromBuffer(new Uint8Array(Buffer.from(webauthnCredential.credentialId, 'base64')));
            await db.execute(sql`
                UPDATE "webauthnCredentials" SET "credentialId" = ${credentialId} 
                WHERE "credentialId" = ${webauthnCredential.credentialId}
            `);

            const publicKey = isoBase64URL.fromBuffer(new Uint8Array(Buffer.from(webauthnCredential.publicKey, 'base64')));
            await db.execute(sql`
                UPDATE "webauthnCredentials" SET "publicKey" = ${publicKey} 
                WHERE "credentialId" = ${webauthnCredential.credentialId}
            `);
        }

        await db.execute(sql`COMMIT`);
        console.log(`Updated credentialId and publicKey`);
    } catch (e) {
        await db.execute(sql`ROLLBACK`);
        console.log("Unable to update credentialId and publicKey");
        console.log(e);
        throw e;
    }

    console.log(`${version} migration complete`);
}
