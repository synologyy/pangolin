import { db, HostMeta } from "@server/db";
import { hostMeta } from "@server/db";
import { v4 as uuidv4 } from "uuid";

let gotHostMeta: HostMeta | undefined;

export async function setHostMeta() {
    const [existing] = await db.select().from(hostMeta).limit(1);

    if (existing && existing.hostMetaId) {
        return;
    }

    const id = uuidv4();

    await db
        .insert(hostMeta)
        .values({ hostMetaId: id, createdAt: new Date().getTime() });
}

export async function getHostMeta() {
    if (gotHostMeta) {
        return gotHostMeta;
    }
    const [meta] = await db.select().from(hostMeta).limit(1);
    gotHostMeta = meta;
    return meta;
}
