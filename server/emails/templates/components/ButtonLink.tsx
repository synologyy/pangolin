import React from "react";

export default function ButtonLink({
    href,
    children,
    className = ""
}: {
    href: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <a
            href={href}
            className={`inline-block bg-primary text-white font-semibold px-8 py-3 rounded-lg text-center no-underline ${className}`}
            style={{
                backgroundColor: "#F97316",
                textDecoration: "none"
            }}
        >
            {children}
        </a>
    );
}
