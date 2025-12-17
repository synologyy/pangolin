import { db, Transaction } from "@server/db";
import { resources, targets } from "@server/db";
import { eq } from "drizzle-orm";

const currentBannedPorts: number[] = [];

export async function pickPort(
    siteId: number,
    trx: Transaction | typeof db
): Promise<{
    internalPort: number;
    targetIps: string[];
}> {
    // Fetch targets for all resources of this site
    const targetIps: string[] = [];
    const targetInternalPorts: number[] = [];

    const targetsRes = await trx
        .select()
        .from(targets)
        .where(eq(targets.siteId, siteId));

    targetsRes.forEach((target) => {
        targetIps.push(`${target.ip}/32`);
        if (target.internalPort) {
            targetInternalPorts.push(target.internalPort);
        }
    });

    let internalPort!: number;
    // pick a port random port from 40000 to 65535 that is not in use
    for (let i = 0; i < 1000; i++) {
        internalPort = Math.floor(Math.random() * 25535) + 40000;
        if (
            !targetInternalPorts.includes(internalPort) &&
            !currentBannedPorts.includes(internalPort)
        ) {
            break;
        }
    }

    currentBannedPorts.push(internalPort);

    return { internalPort, targetIps };
}

export async function getAllowedIps(siteId: number) {
    // Fetch targets for all resources of this site
    const targetsRes = await db
        .select()
        .from(targets)
        .where(eq(targets.siteId, siteId));

    const targetIps = targetsRes.map((target) => `${target.ip}/32`);

    return targetIps.flat();
}
