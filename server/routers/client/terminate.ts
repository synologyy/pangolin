import { sendToClient } from "#dynamic/routers/ws";
import { db, olms } from "@server/db";
import { eq } from "drizzle-orm";

export async function sendTerminateClient(
    clientId: number,
    olmId?: string | null
) {
    if (!olmId) {
        const [olm] = await db
            .select()
            .from(olms)
            .where(eq(olms.clientId, clientId))
            .limit(1);
        if (!olm) {
            throw new Error(`Olm with ID ${clientId} not found`);
        }
        olmId = olm.olmId;
    }

    await sendToClient(olmId, {
        type: `olm/terminate`,
        data: {}
    });
}
