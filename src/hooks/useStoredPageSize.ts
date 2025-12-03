import { useState, useCallback } from "react";

const STORAGE_KEYS = {
    PAGE_SIZE: "datatable-page-size",
    getTablePageSize: (tableId: string) => `datatable-${tableId}-page-size`
};

const getStoredPageSize = (tableId: string, defaultSize = 20): number => {
    if (typeof window === "undefined") return defaultSize;

    try {
        const key = STORAGE_KEYS.getTablePageSize(tableId);
        const stored = localStorage.getItem(key);
        if (stored) {
            const parsed = parseInt(stored, 10);
            if (parsed > 0 && parsed <= 1000) {
                return parsed;
            }
        }
    } catch (error) {
        console.warn("Failed to read page size from localStorage:", error);
    }
    return defaultSize;
};

const setStoredPageSize = (pageSize: number, tableId: string): void => {
    if (typeof window === "undefined") return;

    try {
        const key = STORAGE_KEYS.getTablePageSize(tableId);
        localStorage.setItem(key, pageSize.toString());
    } catch (error) {
        console.warn("Failed to save page size to localStorage:", error);
    }
};

// export function useStore
export function useStoredPageSize(tableId: string, defaultPageSize?: number) {
    const [pageSize, setSize] = useState(() =>
        getStoredPageSize(tableId, defaultPageSize)
    );

    const setPageSize = useCallback(
        (updaterOrValue: number | ((old: number) => number)) => {
            if (typeof updaterOrValue === "function") {
                setSize((oldValue) => {
                    const newValue = updaterOrValue(oldValue);
                    setStoredPageSize(newValue, tableId);
                    return newValue;
                });
            } else {
                setSize(updaterOrValue);
                setStoredPageSize(updaterOrValue, tableId);
            }
        },
        [tableId]
    );

    return [pageSize, setPageSize] as const;
}
