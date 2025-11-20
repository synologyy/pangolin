import { sendToClient } from "#dynamic/routers/ws";
import { db, olms } from "@server/db";
import { SubnetProxyTarget } from "@server/lib/ip";
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

export async function addRemoteSubnets(
    clientId: number,
    siteId: number,
    remoteSubnets: string[],
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
        type: `olm/wg/peer/add-remote-subnets`,
        data: {
            siteId: siteId,
            remoteSubnets: remoteSubnets
        }
    });
}

export async function removeRemoteSubnets(
    clientId: number,
    siteId: number,
    remoteSubnets: string[],
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
        type: `olm/wg/peer/remove-remote-subnets`,
        data: {
            siteId: siteId,
            remoteSubnets: remoteSubnets
        }
    });
}

export async function updateRemoteSubnets(
    clientId: number,
    siteId: number,
    remoteSubnets: {
        oldRemoteSubnets: string[],
        newRemoteSubnets: string[]
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
        type: `olm/wg/peer/update-remote-subnets`,
        data: {
            siteId: siteId,
            ...remoteSubnets
        }
    });
}
