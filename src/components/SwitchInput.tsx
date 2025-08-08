import React from "react";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";

interface SwitchComponentProps {
    id: string;
    label?: string;
    description?: string;
    checked?: boolean;
    defaultChecked?: boolean;
    disabled?: boolean;
    onCheckedChange: (checked: boolean) => void;
}

export function SwitchInput({
    id,
    label,
    description,
    disabled,
    checked,
    defaultChecked = false,
    onCheckedChange
}: SwitchComponentProps) {
    return (
        <div>
            <div className="flex items-center space-x-2 mb-2">
                <Switch
                    id={id}
                    checked={checked}
                    defaultChecked={defaultChecked}
                    onCheckedChange={onCheckedChange}
                    disabled={disabled}
                />
                {label && <Label htmlFor={id}>{label}</Label>}
            </div>
            {description && (
                <span className="text-muted-foreground text-sm">
                    {description}
                </span>
            )}
        </div>
    );
}
