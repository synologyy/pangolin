import type { Metadata } from "next";
import "./globals.css";
import { Fira_Sans, Inter, Noto_Sans_Mono, Roboto_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@app/providers/ThemeProvider";

export const metadata: Metadata = {
    title: `Dashboard - Pangolin`,
    description: "",
};

const font = Inter({ subsets: ["latin"] });
// const font = Noto_Sans_Mono({ subsets: ["latin"] });

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html suppressHydrationWarning>
            <body className={`${font.className} pb-3`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    {children}
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
