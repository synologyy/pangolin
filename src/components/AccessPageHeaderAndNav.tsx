"use client";

import { HorizontalTabs } from "@app/components/HorizontalTabs";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { useTranslations } from "next-intl";

interface AccessPageHeaderAndNavProps {
    children: React.ReactNode;
    hasInvitations: boolean;
}

export default function AccessPageHeaderAndNav({
    children,
    hasInvitations
}: AccessPageHeaderAndNavProps) {
    const t = useTranslations();

    const navItems = [
        {
            title: t("users"),
            href: `/{orgId}/settings/access/users`
        },
        {
            title: t("roles"),
            href: `/{orgId}/settings/access/roles`
        }
    ];

    if (hasInvitations) {
        navItems.push({
            title: t("invite"),
            href: `/{orgId}/settings/access/invitations`
        });
    }

    return (
        <>
            <SettingsSectionTitle
                title={t("accessUsersRoles")}
                description={t("accessUsersRolesDescription")}
            />

            <HorizontalTabs items={navItems}>{children}</HorizontalTabs>
        </>
    );
}
