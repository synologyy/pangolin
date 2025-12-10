"use client";

import UserContext from "@app/contexts/userContext";
import { GetUserResponse } from "@server/routers/user";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface UserProviderProps {
    children: React.ReactNode;
    user: GetUserResponse;
}

export function UserProvider({ children, user: u }: UserProviderProps) {
    const [user, setUser] = useState<GetUserResponse>(u);

    const t = useTranslations();

    const updateUser = (updatedUser: Partial<GetUserResponse>) => {
        if (!user) {
            throw new Error(t("userErrorNoUpdate"));
        }
        setUser((prev) => {
            if (!prev) {
                return prev;
            }
            return {
                ...prev,
                ...updatedUser
            };
        });
    };

    return (
        <UserContext.Provider value={{ user: user, updateUser: updateUser }}>
            {children}
        </UserContext.Provider>
    );
}

export default UserProvider;
