/*
 * This file is part of a proprietary work.
 *
 * Copyright (c) 2025 Fossorial, Inc.
 * All rights reserved.
 *
 * This file is licensed under the Fossorial Commercial License.
 * You may not use this file except in compliance with the License.
 * Unauthorized use, copying, modification, or distribution is strictly prohibited.
 *
 * This file is not licensed under the AGPLv3.
 */

import { ActionsEnum } from "@server/auth/actions";
import { actionAuditLog, db } from "@server/db";
import logger from "@server/logger";
import HttpCode from "@server/types/HttpCode";
import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";

export function logActionAudit(action: ActionsEnum) {
    return async function (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<any> {
        try {
            let orgId;
            let actorType;
            let actor;
            let actorId;

            const user = req.user;
            if (user) {
                const userOrg = req.userOrg;
                orgId = userOrg?.orgId;
                actorType = "user";
                actor = user.username;
                actorId = user.userId;
            }
            const apiKey = req.apiKey;
            if (apiKey) {
                const apiKeyOrg = req.apiKeyOrg;
                orgId = apiKeyOrg?.orgId;
                actorType = "apiKey";
                actor = apiKey.name;
                actorId = apiKey.apiKeyId;
            }

            if (!orgId) {
                logger.warn("logActionAudit: No organization context found");
                return next();
            }

            if (!actorType || !actor || !actorId) {
                logger.warn("logActionAudit: Incomplete actor information");
                return next();
            }

            const timestamp = Math.floor(Date.now() / 1000);

            let metadata = null;
            if (req.params) {
                metadata = JSON.stringify(req.params);
            }

            await db.insert(actionAuditLog).values({
                timestamp,
                orgId,
                actorType,
                actor,
                actorId,
                action,
                metadata
            });

            return next();
        } catch (error) {
            logger.error(error);
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    "Error verifying logging action"
                )
            );
        }
    };
}
