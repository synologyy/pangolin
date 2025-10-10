import { rateLimitService } from "#private/lib/rateLimit";
import { cleanup as wsCleanup } from "#private/routers/ws";

async function cleanup() {
    await rateLimitService.cleanup();
    await wsCleanup();

    process.exit(0);
}

export async function initCleanup() {
    // Handle process termination
    process.on("SIGTERM", () => cleanup());
    process.on("SIGINT", () => cleanup());
}