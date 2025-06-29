import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import config from "@server/lib/config";
import logger from "@server/logger";
import {
    errorHandlerMiddleware,
    notFoundMiddleware,
    rateLimitMiddleware
} from "@server/middlewares";
import { authenticated, unauthenticated } from "@server/routers/external";
import { router as wsRouter, handleWSUpgrade } from "@server/routers/ws";
import { logIncomingMiddleware } from "./middlewares/logIncoming";
import { csrfProtectionMiddleware } from "./middlewares/csrfProtection";
import helmet from "helmet";

const dev = config.isDev;
const externalPort = config.getRawConfig().server.external_port;

export function createApiServer() {
    const apiServer = express();

    if (config.getRawConfig().server.trust_proxy) {
        apiServer.set("trust proxy", 1);
    }

    const corsConfig = config.getRawConfig().server.cors;
    const fallbackOrigin = config.getRawConfig().app.dashboard_url;

    const options = {
        origin: corsConfig?.origins ?? (fallbackOrigin ? [fallbackOrigin] : false),
        ...(corsConfig?.methods && { methods: corsConfig.methods }),
        ...(corsConfig?.allowed_headers && {
            allowedHeaders: corsConfig.allowed_headers
        }),
        credentials: !(corsConfig?.credentials === false)
    };

    logger.debug("Using CORS options", options);

    apiServer.use(cors(options));

    if (!dev) {
        apiServer.use(helmet());
        apiServer.use(csrfProtectionMiddleware);
    }

    apiServer.use(cookieParser());
    apiServer.use(express.json());

    if (!dev) {
        apiServer.use(
            rateLimitMiddleware({
                windowMin:
                    config.getRawConfig().rate_limits.global.window_minutes,
                max: config.getRawConfig().rate_limits.global.max_requests,
                type: "IP_AND_PATH"
            })
        );
    }

    // API routes
    const prefix = `/api/v1`;
    apiServer.use(logIncomingMiddleware);
    apiServer.use(prefix, unauthenticated);
    apiServer.use(prefix, authenticated);

    // WebSocket routes
    apiServer.use(prefix, wsRouter);

    // Error handling
    apiServer.use(notFoundMiddleware);
    apiServer.use(errorHandlerMiddleware);

    // Create HTTP server
    const httpServer = apiServer.listen(externalPort, (err?: any) => {
        if (err) throw err;
        logger.info(
            `API server is running on http://localhost:${externalPort}`
        );
    });

    // Handle WebSocket upgrades
    handleWSUpgrade(httpServer);

    return httpServer;
}
