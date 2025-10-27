import { ActionsEnum } from "@server/auth/actions";
import { Request, Response, NextFunction } from "express";

export function logActionAudit(action: ActionsEnum) {
    return async function (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<any> {
        next();
    };
}
