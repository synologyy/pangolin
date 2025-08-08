"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@app/components/ui/dropdown-menu";
import { Button } from "@app/components/ui/button";
import { Check, Globe, Languages } from "lucide-react";
import clsx from "clsx";
import { useTransition } from "react";
import { Locale } from "@/i18n/config";
import { setUserLocale } from "@/services/locale";

type Props = {
    defaultValue: string;
    items: Array<{ value: string; label: string }>;
    label: string;
};

export default function LocaleSwitcherSelect({
    defaultValue,
    items,
    label
}: Props) {
    const [isPending, startTransition] = useTransition();

    function onChange(value: string) {
        const locale = value as Locale;
        startTransition(() => {
            setUserLocale(locale);
        });
    }

    const selected = items.find((item) => item.value === defaultValue);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className={clsx(
                        "w-full rounded-sm h-8 gap-2 justify-start font-normal",
                        isPending && "pointer-events-none"
                    )}
                    aria-label={label}
                >
                    <Languages className="h-4 w-4" />
                    <span className="text-left flex-1">
                        {selected?.label ?? label}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[8rem]">
                {items.map((item) => (
                    <DropdownMenuItem
                        key={item.value}
                        onClick={() => onChange(item.value)}
                        className="flex items-center gap-2"
                    >
                        {item.value === defaultValue && (
                            <Check className="h-4 w-4" />
                        )}
                        <span>{item.label}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
