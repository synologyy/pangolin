import {
    GetResourceAuthInfoResponse,
    GetExchangeTokenResponse
} from "@server/routers/resource";
import ResourceAuthPortal from "@app/components/ResourceAuthPortal";
import { internal, priv } from "@app/lib/api";
import { AxiosResponse } from "axios";
import { authCookieHeader } from "@app/lib/api/cookies";
import { cache } from "react";
import { verifySession } from "@app/lib/auth/verifySession";
import { redirect } from "next/navigation";
import ResourceNotFound from "@app/components/ResourceNotFound";
import ResourceAccessDenied from "@app/components/ResourceAccessDenied";
import AccessToken from "@app/components/AccessToken";
import { pullEnv } from "@app/lib/pullEnv";
import { LoginFormIDP } from "@app/components/LoginForm";
import { ListIdpsResponse } from "@server/routers/idp";
import AutoLoginHandler from "@app/components/AutoLoginHandler";

export const dynamic = "force-dynamic";

export default async function ResourceAuthPage(props: {
    params: Promise<{ resourceGuid: number }>;
    searchParams: Promise<{
        redirect: string | undefined;
        token: string | undefined;
    }>;
}) {
    const params = await props.params;
    const searchParams = await props.searchParams;

    const env = pullEnv();

    const authHeader = await authCookieHeader();

    let authInfo: GetResourceAuthInfoResponse | undefined;
    try {
        const res = await internal.get<
            AxiosResponse<GetResourceAuthInfoResponse>
        >(`/resource/${params.resourceGuid}/auth`, authHeader);

        if (res && res.status === 200) {
            authInfo = res.data.data;
        }
    } catch (e) {}

    const getUser = cache(verifySession);
    const user = await getUser({ skipCheckVerifyEmail: true });

    if (!authInfo) {
        return (
            <div className="w-full max-w-md">
                <ResourceNotFound />
            </div>
        );
    }

    let redirectUrl = authInfo.url;
    if (searchParams.redirect) {
        try {
            const serverResourceHost = new URL(authInfo.url).host;
            const redirectHost = new URL(searchParams.redirect).host;
            const redirectPort = new URL(searchParams.redirect).port;
            const serverResourceHostWithPort = `${serverResourceHost}:${redirectPort}`;

            if (serverResourceHost === redirectHost) {
                redirectUrl = searchParams.redirect;
            } else if (serverResourceHostWithPort === redirectHost) {
                redirectUrl = searchParams.redirect;
            }
        } catch (e) {}
    }

    const hasAuth =
        authInfo.password ||
        authInfo.pincode ||
        authInfo.sso ||
        authInfo.whitelist;
    const isSSOOnly =
        authInfo.sso &&
        !authInfo.password &&
        !authInfo.pincode &&
        !authInfo.whitelist;

    if (user && !user.emailVerified && env.flags.emailVerificationRequired) {
        redirect(
            `/auth/verify-email?redirect=/auth/resource/${authInfo.resourceGuid}`
        );
    }

    if (!hasAuth) {
        // no authentication so always go straight to the resource
        redirect(redirectUrl);
    }

    // convert the dashboard token into a resource session token
    let userIsUnauthorized = false;
    if (user && authInfo.sso) {
        let redirectToUrl: string | undefined;
        try {
            const res = await priv.post<
                AxiosResponse<GetExchangeTokenResponse>
            >(
                `/resource/${authInfo.resourceId}/get-exchange-token`,
                {},
                await authCookieHeader()
            );

            if (res.data.data.requestToken) {
                const paramName = env.server.resourceSessionRequestParam;
                // append the param with the token to the redirect url
                const fullUrl = new URL(redirectUrl);
                fullUrl.searchParams.append(
                    paramName,
                    res.data.data.requestToken
                );
                redirectToUrl = fullUrl.toString();
            }
        } catch (e) {
            userIsUnauthorized = true;
        }

        if (redirectToUrl) {
            redirect(redirectToUrl);
        }
    }

    if (searchParams.token) {
        return (
            <div className="w-full max-w-md">
                <AccessToken
                    token={searchParams.token}
                    resourceId={authInfo.resourceId}
                />
            </div>
        );
    }

    const idpsRes = await cache(
        async () => await priv.get<AxiosResponse<ListIdpsResponse>>("/idp")
    )();
    const loginIdps = idpsRes.data.data.idps.map((idp) => ({
        idpId: idp.idpId,
        name: idp.name
    })) as LoginFormIDP[];

    if (authInfo.skipToIdpId && authInfo.skipToIdpId !== null) {
        const idp = loginIdps.find((idp) => idp.idpId === authInfo.skipToIdpId);
        if (idp) {
            return (
                <AutoLoginHandler
                    resourceId={authInfo.resourceId}
                    skipToIdpId={authInfo.skipToIdpId}
                    redirectUrl={redirectUrl}
                />
            );
        }
    }

    return (
        <>
            {userIsUnauthorized && isSSOOnly ? (
                <div className="w-full max-w-md">
                    <ResourceAccessDenied />
                </div>
            ) : (
                <div className="w-full max-w-md">
                    <ResourceAuthPortal
                        methods={{
                            password: authInfo.password,
                            pincode: authInfo.pincode,
                            sso: authInfo.sso && !userIsUnauthorized,
                            whitelist: authInfo.whitelist
                        }}
                        resource={{
                            name: authInfo.resourceName,
                            id: authInfo.resourceId
                        }}
                        redirect={redirectUrl}
                        idps={loginIdps}
                    />
                </div>
            )}
        </>
    );
}
