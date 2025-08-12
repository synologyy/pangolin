import { Router } from "express";
import * as gerbil from "@server/routers/gerbil";
import * as traefik from "@server/routers/traefik";
import * as resource from "./resource";
import * as badger from "./badger";
import * as auth from "@server/routers/auth";
import * as supporterKey from "@server/routers/supporterKey";
import * as license from "@server/routers/license";
import * as idp from "@server/routers/idp";
import proxyRouter from "@server/routers/gerbil/proxy";
import config from "@server/lib/config";
import HttpCode from "@server/types/HttpCode";
import {
    verifyResourceAccess,
    verifySessionUserMiddleware
} from "@server/middlewares";

// Root routes
const internalRouter = Router();

internalRouter.get("/", (_, res) => {
    res.status(HttpCode.OK).json({ message: "Healthy" });
});

internalRouter.get("/traefik-config", traefik.traefikConfigProvider);

internalRouter.get(
    "/resource-session/:resourceId/:token",
    auth.checkResourceSession
);

internalRouter.post(
    `/resource/:resourceId/get-exchange-token`,
    verifySessionUserMiddleware,
    verifyResourceAccess,
    resource.getExchangeToken
);

internalRouter.get(
    `/supporter-key/visible`,
    supporterKey.isSupporterKeyVisible
);

internalRouter.get(`/license/status`, license.getLicenseStatus);

internalRouter.get("/idp", idp.listIdps);

internalRouter.get("/idp/:idpId", idp.getIdp);

// Gerbil routes
const gerbilRouter = Router();
internalRouter.use("/gerbil", gerbilRouter);

if (config.getRawConfig().hybrid) {
    // Use proxy router to forward requests to remote cloud server
    gerbilRouter.use("/", proxyRouter);
} else {
    // Use local gerbil endpoints
    gerbilRouter.post("/get-config", gerbil.getConfig);
    gerbilRouter.post("/receive-bandwidth", gerbil.receiveBandwidth);
    gerbilRouter.post("/update-hole-punch", gerbil.updateHolePunch);
    gerbilRouter.post("/get-all-relays", gerbil.getAllRelays);
}

// Badger routes
const badgerRouter = Router();
internalRouter.use("/badger", badgerRouter);

badgerRouter.post("/verify-session", badger.verifyResourceSession);
badgerRouter.post("/exchange-session", badger.exchangeSession);

export default internalRouter;
