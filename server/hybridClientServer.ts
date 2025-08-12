import next from "next";
import express from "express";
import { parse } from "url";
import logger from "@server/logger";
import config from "@server/lib/config";
import { WebSocketClient, createWebSocketClient } from "./routers/ws/client";
import { addPeer, deletePeer } from "./routers/gerbil/peers";
import { db, exitNodes } from "./db";
import { TraefikConfigManager } from "./lib/remoteTraefikConfig";

export async function createHybridClientServer() {
    const monitor = new TraefikConfigManager();

    await monitor.start();

    if (
        !config.getRawConfig().hybrid?.id ||
        !config.getRawConfig().hybrid?.secret ||
        !config.getRawConfig().hybrid?.endpoint
    ) {
        throw new Error("Hybrid configuration is not defined");
    }

    // Create client
    const client = createWebSocketClient(
        "remoteExitNode", // or 'olm'
        config.getRawConfig().hybrid!.id!,
        config.getRawConfig().hybrid!.secret!,
        config.getRawConfig().hybrid!.endpoint!,
        {
            reconnectInterval: 5000,
            pingInterval: 30000,
            pingTimeout: 10000
        }
    );

    // Register message handlers
    client.registerHandler("remote/peers/add", async (message) => {
        const { pubKey, allowedIps } = message.data;

        // TODO: we are getting the exit node twice here
        // NOTE: there should only be one gerbil registered so...
        const [exitNode] = await db.select().from(exitNodes).limit(1);
        await addPeer(exitNode.exitNodeId, {
            publicKey: pubKey,
            allowedIps: allowedIps || []
        });
    });

    client.registerHandler("remote/peers/remove", async (message) => {
        const { pubKey } = message.data;

        // TODO: we are getting the exit node twice here
        // NOTE: there should only be one gerbil registered so...
        const [exitNode] = await db.select().from(exitNodes).limit(1);
        await deletePeer(exitNode.exitNodeId, pubKey);
    });

    client.registerHandler("remote/traefik/reload", async (message) => {
        await monitor.HandleTraefikConfig();
    });

    // Listen to connection events
    client.on("connect", () => {
        console.log("Connected to WebSocket server");
    });

    client.on("disconnect", () => {
        console.log("Disconnected from WebSocket server");
    });

    client.on("message", (message) => {
        console.log("Received message:", message.type, message.data);
    });

    // Connect to the server
    try {
        await client.connect();
        console.log("Connection initiated");
    } catch (error) {
        console.error("Failed to connect:", error);
    }

    client.sendMessageInterval("heartbeat", { timestamp: Date.now() }, 10000);
}
