import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
    eslint: {
        ignoreDuringBuilds: true
    },
    output: "standalone"
};

export default withNextIntl(nextConfig);
