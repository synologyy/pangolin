import next from "next";
import express from "express";
import { parse } from "url";
import logger from "@server/logger";
import config from "@server/lib/config";
import { createWebSocketClient } from "./routers/ws/client";
import { addPeer, deletePeer } from "./routers/gerbil/peers";
import { db, exitNodes } from "./db";
import { TraefikConfigManager } from "./lib/remoteTraefikConfig";
import { tokenManager } from "./lib/tokenManager";
import { APP_VERSION } from "./lib/consts";

export async function createHybridClientServer() {
    logger.info("Starting hybrid client server...");

    // Start the token manager
    await tokenManager.start();

    const token = await tokenManager.getToken();

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
        token,
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
        logger.info("Connected to WebSocket server");
        client.sendMessage("remoteExitNode/register", {
            remoteExitNodeVersion: APP_VERSION
        });
    });

    client.on("disconnect", () => {
        logger.info("Disconnected from WebSocket server");
    });

    client.on("message", (message) => {
        logger.info("Received message:", message.type, message.data);
    });

    // Connect to the server
    try {
        await client.connect();
        logger.info("Connection initiated");
    } catch (error) {
        logger.error("Failed to connect:", error);
    }

    client.sendMessageInterval(
        "remoteExitNode/ping",
        { timestamp: Date.now() / 1000 },
        60000
    ); // send every minute
}
