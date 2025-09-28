import { APP_PATH } from "@server/lib/consts";
import Database from "better-sqlite3";
import path from "path";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

const version = "1.10.4";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    const location = path.join(APP_PATH, "db", "db.sqlite");
    const db = new Database(location);

   db.transaction(() => {

        const webauthnCredentials = db.prepare(`SELECT credentialId, publicKey, userId, signCount, transports, name, lastUsed, dateCreated FROM 'webauthnCredentials'`).all() as { 
            credentialId: string; publicKey: string; userId: string; signCount: number; transports: string | null; name: string | null; lastUsed: string; dateCreated: string;
        }[];

        for (const webauthnCredential of webauthnCredentials) {
            const newCredentialId = isoBase64URL.fromBuffer(new Uint8Array(Buffer.from(webauthnCredential.credentialId, 'base64')));
            const newPublicKey = isoBase64URL.fromBuffer(new Uint8Array(Buffer.from(webauthnCredential.publicKey, 'base64')));
            
            // Delete the old record
            db.prepare(`DELETE FROM 'webauthnCredentials' WHERE 'credentialId' = ?`).run(webauthnCredential.credentialId);
            
            // Insert the updated record with converted values
            db.prepare(
                `INSERT INTO 'webauthnCredentials' (credentialId, publicKey, userId, signCount, transports, name, lastUsed, dateCreated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
                newCredentialId, 
                newPublicKey, 
                webauthnCredential.userId, 
                webauthnCredential.signCount, 
                webauthnCredential.transports, 
                webauthnCredential.name, 
                webauthnCredential.lastUsed, 
                webauthnCredential.dateCreated
            );
        }
        })();

    console.log(`${version} migration complete`);
}
