import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import axios from "axios";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import config from "@server/lib/config";

const proxyRouter = Router();

/**
 * Proxy function that forwards requests to the remote cloud server
 */
async function proxyToRemote(
    req: Request,
    res: Response,
    next: NextFunction,
    endpoint: string
): Promise<any> {
    try {
        const remoteConfig = config.getRawConfig().hybrid;
        
        if (!remoteConfig?.endpoint) {
            logger.error("Remote endpoint not configured in hybrid.endpoint config");
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    "Remote endpoint not configured"
                )
            );
        }

        const remoteUrl = `${remoteConfig.endpoint.replace(/\/$/, '')}/api/v1/gerbil/${endpoint}`;
        
        logger.debug(`Proxying request to remote server: ${remoteUrl}`);

        // Forward the request to the remote server
        const response = await axios({
            method: req.method as any,
            url: remoteUrl,
            data: req.body,
            headers: {
                'Content-Type': 'application/json',
            },
            params: req.query,
            timeout: 30000, // 30 second timeout
            validateStatus: () => true // Don't throw on non-2xx status codes
        });

        // Forward the response status and data
        return res.status(response.status).json(response.data);
        
    } catch (error) {
        logger.error("Error proxying request to remote server:", error);
        
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                return next(
                    createHttpError(
                        HttpCode.SERVICE_UNAVAILABLE,
                        "Remote server is unavailable"
                    )
                );
            }
            if (error.code === 'ECONNABORTED') {
                return next(
                    createHttpError(
                        HttpCode.REQUEST_TIMEOUT,
                        "Request to remote server timed out"
                    )
                );
            }
        }
        
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Error communicating with remote server"
            )
        );
    }
}

// Proxy endpoints for each gerbil route
proxyRouter.post("/get-config", (req, res, next) => 
    proxyToRemote(req, res, next, "get-config")
);

proxyRouter.post("/receive-bandwidth", (req, res, next) => 
    proxyToRemote(req, res, next, "receive-bandwidth")
);

proxyRouter.post("/update-hole-punch", (req, res, next) => 
    proxyToRemote(req, res, next, "update-hole-punch")
);

proxyRouter.post("/get-all-relays", (req, res, next) => 
    proxyToRemote(req, res, next, "get-all-relays")
);

export default proxyRouter;
