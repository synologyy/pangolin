import axios from "axios";
import config from "@server/lib/config";
import logger from "@server/logger";

export interface TokenResponse {
    success: boolean;
    message?: string;
    data: {
        token: string;
    };
}

/**
 * Token Manager - Handles automatic token refresh for hybrid server authentication
 *
 * Usage throughout the application:
 * ```typescript
 * import { tokenManager } from "@server/lib/tokenManager";
 *
 * // Get the current valid token
 * const token = await tokenManager.getToken();
 *
 * // Force refresh if needed
 * await tokenManager.refreshToken();
 * ```
 *
 * The token manager automatically refreshes tokens every 24 hours by default
 * and is started once in the privateHybridServer.ts file.
 */

export class TokenManager {
    private token: string | null = null;
    private refreshInterval: NodeJS.Timeout | null = null;
    private isRefreshing: boolean = false;
    private refreshIntervalMs: number;

    constructor(refreshIntervalMs: number = 24 * 60 * 60 * 1000) {
        // Default to 24 hours
        this.refreshIntervalMs = refreshIntervalMs;
    }

    /**
     * Start the token manager - gets initial token and sets up refresh interval
     */
    async start(): Promise<void> {
        try {
            await this.refreshToken();
            this.setupRefreshInterval();
            logger.info("Token manager started successfully");
        } catch (error) {
            logger.error("Failed to start token manager:", error);
            throw error;
        }
    }

    /**
     * Stop the token manager and clear refresh interval
     */
    stop(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        logger.info("Token manager stopped");
    }

    /**
     * Get the current valid token
     */
    async getToken(): Promise<string> {
        if (!this.token) {
            if (this.isRefreshing) {
                // Wait for current refresh to complete
                await this.waitForRefresh();
            } else {
                await this.refreshToken();
            }
        }

        if (!this.token) {
            throw new Error("No valid token available");
        }

        return this.token;
    }

    async getAuthHeader() {
        return {
            headers: {
                Authorization: `Bearer ${await this.getToken()}`
            }
        };
    }

    /**
     * Force refresh the token
     */
    async refreshToken(): Promise<void> {
        if (this.isRefreshing) {
            await this.waitForRefresh();
            return;
        }

        this.isRefreshing = true;

        try {
            const hybridConfig = config.getRawConfig().hybrid;

            if (
                !hybridConfig?.id ||
                !hybridConfig?.secret ||
                !hybridConfig?.endpoint
            ) {
                throw new Error("Hybrid configuration is not defined");
            }

            const tokenEndpoint = `${hybridConfig.endpoint}/api/v1/auth/remoteExitNode/get-token`;

            const tokenData = {
                remoteExitNodeId: hybridConfig.id,
                secret: hybridConfig.secret
            };

            logger.debug("Requesting new token from server");

            const response = await axios.post<TokenResponse>(
                tokenEndpoint,
                tokenData,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": "x-csrf-protection"
                    },
                    timeout: 10000 // 10 second timeout
                }
            );

            if (!response.data.success) {
                throw new Error(
                    `Failed to get token: ${response.data.message}`
                );
            }

            if (!response.data.data.token) {
                throw new Error("Received empty token from server");
            }

            this.token = response.data.data.token;
            logger.debug("Token refreshed successfully");
        } catch (error) {
            logger.error("Failed to refresh token:", error);

            if (axios.isAxiosError(error)) {
                if (error.response) {
                    throw new Error(
                        `Failed to get token with status code: ${error.response.status}`
                    );
                } else if (error.request) {
                    throw new Error(
                        "Failed to request new token: No response received"
                    );
                } else {
                    throw new Error(
                        `Failed to request new token: ${error.message}`
                    );
                }
            } else {
                throw new Error(`Failed to get token: ${error}`);
            }
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Set up automatic token refresh interval
     */
    private setupRefreshInterval(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(async () => {
            try {
                logger.debug("Auto-refreshing token");
                await this.refreshToken();
            } catch (error) {
                logger.error("Failed to auto-refresh token:", error);
            }
        }, this.refreshIntervalMs);
    }

    /**
     * Wait for current refresh operation to complete
     */
    private async waitForRefresh(): Promise<void> {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!this.isRefreshing) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }
}

// Export a singleton instance for use throughout the application
export const tokenManager = new TokenManager();
