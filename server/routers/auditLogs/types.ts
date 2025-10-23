export type QueryActionAuditLogResponse = {
    log: {
        orgId: string;
        action: string;
        actorType: string;
        actorId: string;
        timestamp: number;
        actor: string;
    }[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
    };
};

export type QueryRequestAuditLogResponse = {
    log: {
        timestamp: number;
        action: boolean;
        reason: number;
        orgId: string | null;
        actorType: string | null;
        actor: string | null;
        actorId: string | null;
        resourceId: number | null;
        resourceNiceId: string | null;
        resourceName: string | null;
        ip: string | null;
        location: string | null;
        userAgent: string | null;
        metadata: string | null;
        headers: string | null;
        query: string | null;
        originalRequestURL: string | null;
        scheme: string | null;
        host: string | null;
        path: string | null;
        method: string | null;
        tls: boolean | null;
    }[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
    };
};

export type QueryAccessAuditLogResponse = {
    log: {
        orgId: string;
        action: string;
        type: string;
        resourceId: number | null;
        resourceName: string | null;
        resourceNiceId: string | null;
        ip: string | null;
        location: string | null;
        userAgent: string | null;
        metadata: string | null;
        actorType: string;
        actorId: string;
        timestamp: number;
        actor: string;
    }[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
    };
};
