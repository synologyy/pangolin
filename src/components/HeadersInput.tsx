"use client";

import { useEffect, useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";

interface HeadersInputProps {
    value?: { name: string; value: string }[] | null;
    onChange: (value: { name: string; value: string }[] | null) => void;
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
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isUserEditingRef = useRef(false);

    // Convert header objects array to newline-separated string for display
    const convertToNewlineSeparated = (
        headers: { name: string; value: string }[] | null
    ): string => {
        if (!headers || headers.length === 0) return "";

        return headers
            .map((header) => `${header.name}: ${header.value}`)
            .join("\n");
    };

    // Convert newline-separated string to header objects array
    const convertToHeadersArray = (
        newlineSeparated: string
    ): { name: string; value: string }[] | null => {
        if (!newlineSeparated || newlineSeparated.trim() === "") return [];

        return newlineSeparated
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && line.includes(":"))
            .map((line) => {
                const colonIndex = line.indexOf(":");
                const name = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();

                // Ensure header name conforms to HTTP header requirements
                // Header names should be case-insensitive, contain only ASCII letters, digits, and hyphens
                const normalizedName = name
                    .replace(/[^a-zA-Z0-9\-]/g, "")
                    .toLowerCase();

                return { name: normalizedName, value };
            })
            .filter((header) => header.name.length > 0); // Filter out headers with invalid names
    };

    // Update internal value when external value changes
    // But only if the user is not currently editing (textarea not focused)
    useEffect(() => {
        if (!isUserEditingRef.current) {
            setInternalValue(convertToNewlineSeparated(value));
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInternalValue(newValue);

        // Mark that user is actively editing
        isUserEditingRef.current = true;

        // Only update parent if the input is in a valid state
        // Valid states: empty/whitespace only, or contains properly formatted headers

        if (newValue.trim() === "") {
            // Empty input is valid - represents no headers
            onChange([]);
        } else {
            // Check if all non-empty lines are properly formatted (contain ':')
            const lines = newValue.split("\n");
            const nonEmptyLines = lines
                .map((line) => line.trim())
                .filter((line) => line.length > 0);

            // If there are no non-empty lines, or all non-empty lines contain ':', it's valid
            const isValid =
                nonEmptyLines.length === 0 ||
                nonEmptyLines.every((line) => line.includes(":"));

            if (isValid) {
                // Safe to convert and update parent
                const headersArray = convertToHeadersArray(newValue);
                onChange(headersArray);
            }
            // If not valid, don't call onChange - let user continue typing
        }
    };

    const handleFocus = () => {
        isUserEditingRef.current = true;
    };

    const handleBlur = () => {
        // Small delay to allow any final change events to process
        setTimeout(() => {
            isUserEditingRef.current = false;
        }, 100);
    };

    return (
        <Textarea
            ref={textareaRef}
            value={internalValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            rows={rows}
            className={className}
        />
    );
}
