import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import config from "@server/lib/config";
import logger from "@server/logger";
import {
    errorHandlerMiddleware,
    notFoundMiddleware
} from "@server/middlewares";
import { authenticated, unauthenticated } from "@server/routers/external";
import { router as wsRouter, handleWSUpgrade } from "@server/routers/ws";
import { logIncomingMiddleware } from "./middlewares/logIncoming";
import { csrfProtectionMiddleware } from "./middlewares/csrfProtection";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import createHttpError from "http-errors";
import HttpCode from "./types/HttpCode";
import requestTimeoutMiddleware from "./middlewares/requestTimeout";
import { createStore } from "./lib/rateLimitStore";

const dev = config.isDev;
const externalPort = config.getRawConfig().server.external_port;

export function createApiServer() {
    const apiServer = express();
    const prefix = `/api/v1`;

    const trustProxy = config.getRawConfig().server.trust_proxy;
    if (trustProxy) {
        apiServer.set("trust proxy", trustProxy);
    }

    const corsConfig = config.getRawConfig().server.cors;

    const options = {
        ...(corsConfig?.origins
            ? { origin: corsConfig.origins }
            : {
                  origin: (origin: any, callback: any) => {
                      callback(null, true);
                  }
              }),
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

    // Add request timeout middleware
    apiServer.use(requestTimeoutMiddleware(60000)); // 60 second timeout

    if (!dev) {
        apiServer.use(
            rateLimit({
                windowMs:
                    config.getRawConfig().rate_limits.global.window_minutes *
                    60 *
                    1000,
                max: config.getRawConfig().rate_limits.global.max_requests,
                keyGenerator: (req) => `apiServerGlobal:${req.ip}:${req.path}`,
                handler: (req, res, next) => {
                    const message = `Rate limit exceeded. You can make ${config.getRawConfig().rate_limits.global.max_requests} requests every ${config.getRawConfig().rate_limits.global.window_minutes} minute(s).`;
                    return next(
                        createHttpError(HttpCode.TOO_MANY_REQUESTS, message)
                    );
                },
                store: createStore()
            })
        );
    }

    // API routes
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
