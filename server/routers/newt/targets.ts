import { Target } from "@server/db";
import { sendToClient } from "../ws";
import logger from "@server/logger";

export async function addTargets(
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
}

export async function removeTargets(
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

    await sendToClient(newtId, {
        type: `newt/${protocol}/remove`,
        data: {
            targets: payloadTargets
        }
    });
}
