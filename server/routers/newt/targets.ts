import { Target } from "@server/db";
import { sendToClient } from "../ws";

export function addTargets(
    newtId: string,
    targets: Target[],
    protocol: string,
    port: number | null = null
) {
    //create a list of udp and tcp targets
    const payloadTargets = targets.map((target) => {
        return `${target.internalPort ? target.internalPort + ":" : ""}${
            target.ip
        }:${target.port}`;
    });

    sendToClient(newtId, {
        type: `newt/${protocol}/add`,
        data: {
            targets: payloadTargets
        }
    });

    const payloadTargetsResources = targets.map((target) => {
        return `${port ? port + ":" : ""}${
            target.ip
        }:${target.port}`;
    });

    sendToClient(newtId, {
        type: `newt/wg/${protocol}/add`,
        data: {
            targets: [payloadTargetsResources[0]] // We can only use one target for WireGuard right now
        }
    });
}

export function removeTargets(
    newtId: string,
    targets: Target[],
    protocol: string,
    port: number | null = null
) {
    //create a list of udp and tcp targets
    const payloadTargets = targets.map((target) => {
        return `${target.internalPort ? target.internalPort + ":" : ""}${
            target.ip
        }:${target.port}`;
    });

    sendToClient(newtId, {
        type: `newt/${protocol}/remove`,
        data: {
            targets: payloadTargets
        }
    });

    const payloadTargetsResources = targets.map((target) => {
        return `${port ? port + ":" : ""}${
            target.ip
        }:${target.port}`;
    });

    sendToClient(newtId, {
        type: `newt/wg/${protocol}/remove`,
        data: {
            targets: [payloadTargetsResources[0]] // We can only use one target for WireGuard right now
        }
    });
}
