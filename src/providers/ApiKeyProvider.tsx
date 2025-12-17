"use client";

import ApiKeyContext from "@app/contexts/apiKeyContext";
import { GetApiKeyResponse } from "@server/routers/apiKeys";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface ApiKeyProviderProps {
    children: React.ReactNode;
    apiKey: GetApiKeyResponse;
}

export function ApiKeyProvider({ children, apiKey: ak }: ApiKeyProviderProps) {
    const [apiKey, setApiKey] = useState<GetApiKeyResponse>(ak);

    const t = useTranslations();

    const updateApiKey = (updatedApiKey: Partial<GetApiKeyResponse>) => {
        if (!apiKey) {
            throw new Error(t("apiKeysErrorNoUpdate"));
        }
        setApiKey((prev) => {
            if (!prev) {
                return prev;
            }
            return {
                ...prev,
                ...updatedApiKey
            };
        });
    };

    return (
        <ApiKeyContext.Provider value={{ apiKey, updateApiKey }}>
            {children}
        </ApiKeyContext.Provider>
    );
}

export default ApiKeyProvider;
