"use client";

import { useQuery } from "@tanstack/react-query";

interface ProductUpdatesSectionProps {}

const data = {};

export default function ProductUpdates({}: ProductUpdatesSectionProps) {
    const versions = useQuery({
        queryKey: []
    });
    return (
        <>
            <small className="text-xs text-muted-foreground flex items-center gap-2">
                3 more updates
            </small>
        </>
    );
}
