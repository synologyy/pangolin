import {
    handleNewtRegisterMessage,
    handleReceiveBandwidthMessage,
    handleGetConfigMessage,
    handleDockerStatusMessage,
    handleDockerContainersMessage,
    handleNewtPingRequestMessage
} from "../newt";
import {
    handleOlmRegisterMessage,
    handleOlmRelayMessage,
    handleOlmPingMessage,
    startOfflineChecker
} from "../olm";
import { MessageHandler } from "./ws";

export const messageHandlers: Record<string, MessageHandler> = {
    "newt/wg/register": handleNewtRegisterMessage,
    "olm/wg/register": handleOlmRegisterMessage,
    "newt/wg/get-config": handleGetConfigMessage,
    "newt/receive-bandwidth": handleReceiveBandwidthMessage,
    "olm/wg/relay": handleOlmRelayMessage,
    "olm/ping": handleOlmPingMessage,
    "newt/socket/status": handleDockerStatusMessage,
    "newt/socket/containers": handleDockerContainersMessage,
    "newt/ping/request": handleNewtPingRequestMessage,
};

startOfflineChecker(); // this is to handle the offline check for olms
