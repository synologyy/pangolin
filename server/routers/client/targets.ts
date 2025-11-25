import { sendToClient } from "#dynamic/routers/ws";
import { db, olms } from "@server/db";
import { Alias, SubnetProxyTarget } from "@server/lib/ip";
import { eq } from "drizzle-orm";

export async function addTargets(newtId: string, targets: SubnetProxyTarget[]) {
    await sendToClient(newtId, {
        type: `newt/wg/targets/add`,
        data: targets
    });
}

export async function removeTargets(
    newtId: string,
    targets: SubnetProxyTarget[]
) {
    await sendToClient(newtId, {
        type: `newt/wg/targets/remove`,
        data: targets
    });
}

export async function updateTargets(
    newtId: string,
    targets: {
        oldTargets: SubnetProxyTarget[];
        newTargets: SubnetProxyTarget[];
    }
) {
    await sendToClient(newtId, {
        type: `newt/wg/targets/update`,
        data: targets
    });
}

export async function addPeerData(
    clientId: number,
    siteId: number,
    remoteSubnets: string[],
    aliases: Alias[],
    olmId?: string
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
        type: `olm/wg/peer/data/add`,
        data: {
            siteId: siteId,
            remoteSubnets: remoteSubnets,
            aliases: aliases
        }
    });
}

export async function removePeerData(
    clientId: number,
    siteId: number,
    remoteSubnets: string[],
    aliases: Alias[],
    olmId?: string
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
        type: `olm/wg/peer/data/remove`,
        data: {
            siteId: siteId,
            remoteSubnets: remoteSubnets,
            aliases: aliases
        }
    });
}

export async function updatePeerData(
    clientId: number,
    siteId: number,
    remoteSubnets: {
        oldRemoteSubnets: string[],
        newRemoteSubnets: string[]
    },
    aliases: {
        oldAliases: Alias[],
        newAliases: Alias[]
    },
    olmId?: string
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
        type: `olm/wg/peer/data/update`,
        data: {
            siteId: siteId,
            ...remoteSubnets,
            ...aliases
        }
    });
}
