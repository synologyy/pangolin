import { sendToClient } from "#dynamic/routers/ws";
import { SubnetProxyTarget } from "@server/lib/ip";

export async function addTarget(newtId: string, target: SubnetProxyTarget) {
    await sendToClient(newtId, {
        type: `newt/wg/target/add`,
        data: target
    });
}

export async function removeTarget(newtId: string, target: SubnetProxyTarget) {
    await sendToClient(newtId, {
        type: `newt/wg/target/remove`,
        data: target
    });
}

export async function updateTarget(
    newtId: string,
    oldTarget: SubnetProxyTarget,
    newTarget: SubnetProxyTarget
) {
    await sendToClient(newtId, {
        type: `newt/wg/target/update`,
        data: {
            oldTarget,
            newTarget
        }
    });
}