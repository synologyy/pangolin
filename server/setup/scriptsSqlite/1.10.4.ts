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

        const webauthnCredentials = db.prepare(`SELECT credentialId, publicKey FROM 'webauthnCredentials'`).all() as { 
            credentialId: string; publicKey: string 
        }[];

        for (const webauthnCredential of webauthnCredentials) {
            const credentialId = isoBase64URL.fromBuffer(new Uint8Array(Buffer.from(webauthnCredential.credentialId, 'base64')));
                db.prepare(
                    `UPDATE 'webauthnCredentials' SET 'credentialId' = ? WHERE 'credentialId' = ?`
                ).run(credentialId, webauthnCredential.credentialId);

            const publicKey = isoBase64URL.fromBuffer(new Uint8Array(Buffer.from(webauthnCredential.publicKey, 'base64')));
                db.prepare(
                    `UPDATE 'webauthnCredentials' SET 'publicKey' = ? WHERE 'credentialId' = ?`
                ).run(publicKey, webauthnCredential.credentialId);
            }
        })();

    console.log(`${version} migration complete`);
}
