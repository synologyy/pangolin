export type Env = {
    app: {
        environment: string;
        version: string;
        dashboardUrl: string;
    };
    server: {
        externalPort: string;
        nextPort: string;
        sessionCookieName: string;
        resourceAccessTokenParam: string;
        resourceSessionRequestParam: string;
        resourceAccessTokenHeadersId: string;
        resourceAccessTokenHeadersToken: string;
    };
    email: {
        emailEnabled: boolean;
    };
    flags: {
        disableSignupWithoutInvite: boolean;
        disableUserCreateOrg: boolean;
        emailVerificationRequired: boolean;
        allowRawResources: boolean;
        disableLocalSites: boolean;
        disableBasicWireguardSites: boolean;
        enableClients: boolean;
        hideSupporterKey: boolean;
    }
};
