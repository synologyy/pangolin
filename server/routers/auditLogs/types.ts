export type QueryActionAuditLogResponse = {
    log: {
        orgId: string;
        action: string;
        actorType: string;
        timestamp: number;
        actor: string;
    }[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
    };
};
