import { db } from "@server/db";
import { resources, targets } from "@server/db";
import { eq } from "drizzle-orm";

const currentBannedPorts: number[] = [];

export async function pickPort(siteId: number): Promise<{
    internalPort: number;
    targetIps: string[];
}> {
    const resourcesRes = await db
        .select()
        .from(resources)
        .where(eq(resources.siteId, siteId));

    // TODO: is this all inefficient?
    // Fetch targets for all resources of this site
    const targetIps: string[] = [];
    const targetInternalPorts: number[] = [];
    await Promise.all(
        resourcesRes.map(async (resource) => {
            const targetsRes = await db
                .select()
                .from(targets)
                .where(eq(targets.resourceId, resource.resourceId));
            targetsRes.forEach((target) => {
                targetIps.push(`${target.ip}/32`);
                if (target.internalPort) {
                    targetInternalPorts.push(target.internalPort);
                }
            });
        })
    );

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
    // TODO: is this all inefficient?

    const resourcesRes = await db
        .select()
        .from(resources)
        .where(eq(resources.siteId, siteId));

    // Fetch targets for all resources of this site
    const targetIps = await Promise.all(
        resourcesRes.map(async (resource) => {
            const targetsRes = await db
                .select()
                .from(targets)
                .where(eq(targets.resourceId, resource.resourceId));
            return targetsRes.map((target) => `${target.ip}/32`);
        })
    );
    return targetIps.flat();
}
