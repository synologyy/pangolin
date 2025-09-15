"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

interface HeadersInputProps {
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
}

export function HeadersInput({ 
    value = "", 
    onChange, 
    placeholder = `X-Example-Header: example-value
X-Another-Header: another-value`,
    rows = 4,
    className
}: HeadersInputProps) {
    const [internalValue, setInternalValue] = useState("");

    // Convert comma-separated to newline-separated for display
    const convertToNewlineSeparated = (commaSeparated: string): string => {
        if (!commaSeparated || commaSeparated.trim() === "") return "";
        
        return commaSeparated
            .split(',')
            .map(header => header.trim())
            .filter(header => header.length > 0)
            .join('\n');
    };

    // Convert newline-separated to comma-separated for output
    const convertToCommaSeparated = (newlineSeparated: string): string => {
        if (!newlineSeparated || newlineSeparated.trim() === "") return "";
        
        return newlineSeparated
            .split('\n')
            .map(header => header.trim())
            .filter(header => header.length > 0)
            .join(', ');
    };

    // Update internal value when external value changes
    useEffect(() => {
        setInternalValue(convertToNewlineSeparated(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInternalValue(newValue);
        
        // Convert back to comma-separated format for the parent
        const commaSeparatedValue = convertToCommaSeparated(newValue);
        onChange(commaSeparatedValue);
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
