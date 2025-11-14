import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { pullEnv } from "./src/lib/pullEnv";

// validate env variables on local dev
if (process.env.NODE_ENV === "development") {
    pullEnv();
}

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
    eslint: {
        ignoreDuringBuilds: true
    },
    output: "standalone"
};

export default withNextIntl(nextConfig);
