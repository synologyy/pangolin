"use client";

import { Button } from "@app/components/ui/button";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeSwitcher() {
    const { setTheme, theme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    const t = useTranslations();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <Button variant="ghost" size="sm" className="h-8">
                <Sun className="h-4 w-4 mr-2" />
                Light
            </Button>
        );
    }

    function cycleTheme() {
        const currentTheme = theme || "system";

        if (currentTheme === "light") {
            setTheme("dark");
        } else if (currentTheme === "dark") {
            setTheme("system");
        } else {
            setTheme("light");
        }
    }

    function getThemeIcon() {
        const currentTheme = theme || "system";

        if (currentTheme === "light") {
            return <Sun className="h-4 w-4" />;
        } else if (currentTheme === "dark") {
            return <Moon className="h-4 w-4" />;
        } else {
            // When theme is "system", show icon based on resolved theme
            if (resolvedTheme === "light") {
                return <Sun className="h-4 w-4" />;
            } else if (resolvedTheme === "dark") {
                return <Moon className="h-4 w-4" />;
            } else {
                // Fallback to laptop icon if resolvedTheme is not available
                return <Laptop className="h-4 w-4" />;
            }
        }
    }

    function getThemeText() {
        const currentTheme = theme || "system";
        const translated = t(currentTheme);
        return translated.charAt(0).toUpperCase() + translated.slice(1);
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={cycleTheme}
            title={`Current theme: ${theme || "system"}. Click to cycle themes.`}
        >
            {getThemeIcon()}
            <span className="ml-2">{getThemeText()}</span>
        </Button>
    );
}
