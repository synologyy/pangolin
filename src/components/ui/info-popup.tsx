"use client";

import React from "react";
import { Info } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface InfoPopupProps {
    text?: string;
    info?: string;
    trigger?: React.ReactNode;
    children?: React.ReactNode;
}

export function InfoPopup({ text, info, trigger, children }: InfoPopupProps) {
    const defaultTrigger = (
        <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full p-0"
        >
            <Info className="h-4 w-4" />
            <span className="sr-only">Show info</span>
        </Button>
    );

    return (
        <div className="flex items-center space-x-2">
            {text && <span>{text}</span>}
            <Popover>
                <PopoverTrigger asChild>
                    {trigger ?? defaultTrigger}
                </PopoverTrigger>
                <PopoverContent className="w-80">
                    {children ||
                        (info && (
                            <p className="text-sm text-muted-foreground">
                                {info}
                            </p>
                        ))}
                </PopoverContent>
            </Popover>
        </div>
    );
}
