import { sendToClient } from "#dynamic/routers/ws";
import { SubnetProxyTarget } from "@server/lib/ip";

export async function addTargets(newtId: string, targets: SubnetProxyTarget[]) {
    await sendToClient(newtId, {
        type: `newt/wg/target/add`,
        data: targets
    });
}

export async function removeTargets(
    newtId: string,
    targets: SubnetProxyTarget[]
) {
    await sendToClient(newtId, {
        type: `newt/wg/target/remove`,
        data: targets
    });
}

export async function updateTargets(
    newtId: string,
    targets: {
        oldTargets: SubnetProxyTarget[],
        newTargets: SubnetProxyTarget[]
    }
) {
    await sendToClient(newtId, {
        type: `newt/wg/target/update`,
        data: targets
    });
}
