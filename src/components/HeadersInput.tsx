"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";


interface HeadersInputProps {
    value?: { name: string, value: string }[] | null;
    onChange: (value: { name: string, value: string }[] | null) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
}

export function HeadersInput({ 
    value = [], 
    onChange, 
    placeholder = `X-Example-Header: example-value
X-Another-Header: another-value`,
    rows = 4,
    className
}: HeadersInputProps) {
    const [internalValue, setInternalValue] = useState("");

    // Convert header objects array to newline-separated string for display
    const convertToNewlineSeparated = (headers: { name: string, value: string }[] | null): string => {
        if (!headers || headers.length === 0) return "";
        
        return headers
            .map(header => `${header.name}: ${header.value}`)
            .join('\n');
    };

    // Convert newline-separated string to header objects array
    const convertToHeadersArray = (newlineSeparated: string): { name: string, value: string }[] | null => {
        if (!newlineSeparated || newlineSeparated.trim() === "") return [];
        
        return newlineSeparated
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.includes(':'))
            .map(line => {
                const colonIndex = line.indexOf(':');
                const name = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                
                // Ensure header name conforms to HTTP header requirements
                // Header names should be case-insensitive, contain only ASCII letters, digits, and hyphens
                const normalizedName = name.replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase();
                
                return { name: normalizedName, value };
            })
            .filter(header => header.name.length > 0); // Filter out headers with invalid names
    };

    // Update internal value when external value changes
    useEffect(() => {
        setInternalValue(convertToNewlineSeparated(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInternalValue(newValue);
        
        // Convert back to header objects array for the parent
        const headersArray = convertToHeadersArray(newValue);
        onChange(headersArray);
    };

    return (
        <Textarea
            value={internalValue}
            onChange={handleChange}
            placeholder={placeholder}
            rows={rows}
            className={className}
        />
    );
}
