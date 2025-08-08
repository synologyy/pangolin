import { Request, Response, NextFunction } from 'express';
import logger from '@server/logger';
import createHttpError from 'http-errors';
import HttpCode from '@server/types/HttpCode';

export function requestTimeoutMiddleware(timeoutMs: number = 30000) {
    return (req: Request, res: Response, next: NextFunction) => {
        // Set a timeout for the request
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                logger.error(`Request timeout: ${req.method} ${req.url} from ${req.ip}`);
                return next(
                    createHttpError(
                        HttpCode.REQUEST_TIMEOUT,
                        'Request timeout - operation took too long to complete'
                    )
                );
            }
        }, timeoutMs);

        // Clear timeout when response finishes
        res.on('finish', () => {
            clearTimeout(timeout);
        });

        // Clear timeout when response closes
        res.on('close', () => {
            clearTimeout(timeout);
        });

        next();
    };
}

export default requestTimeoutMiddleware;
