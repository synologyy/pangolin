import { cookies } from "next/headers";
import ValidateOidcToken from "@app/components/ValidateOidcToken";
import { cache } from "react";
import { priv } from "@app/lib/api";
import { AxiosResponse } from "axios";
import { GetIdpResponse } from "@server/routers/idp";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function Page(props: {
    params: Promise<{ orgId: string; idpId: string }>;
    searchParams: Promise<{
        code: string;
        state: string;
    }>;
}) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    const t = await getTranslations();

    const allCookies = await cookies();
    const stateCookie = allCookies.get("p_oidc_state")?.value;


    const idpRes = await cache(
        async () => await priv.get<AxiosResponse<GetIdpResponse>>(`/idp/${params.idpId}`)
    )();

    const foundIdp = idpRes.data?.data?.idp;

    if (!foundIdp) {
        return <div>{t('idpErrorNotFound')}</div>;
    }

    return (
        <>
            <ValidateOidcToken
                orgId={params.orgId}
                idpId={params.idpId}
                code={searchParams.code}
                expectedState={searchParams.state}
                stateCookie={stateCookie}
                idp={{ name: foundIdp.name }}
            />
        </>
    );
}
