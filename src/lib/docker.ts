import { createApiClient, formatAxiosError } from "@app/lib/api";
import {
    Container,
    GetDockerStatusResponse,
    ListContainersResponse,
    TriggerFetchResponse
} from "@server/routers/site";
import { AxiosResponse } from "axios";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface DockerState {
    isEnabled: boolean;
    isAvailable: boolean;
    socketPath?: string;
    containers: Container[];
}

export class DockerManager {
    private api: any;
    private siteId: number;

    constructor(api: any, siteId: number) {
        this.api = api;
        this.siteId = siteId;
    }

    async checkDockerSocket(): Promise<void> {
        try {
            const res = await this.api.post(
                `/site/${this.siteId}/docker/check`
            );
            console.log("Docker socket check response:", res);
        } catch (error) {
            console.error("Failed to check Docker socket:", error);
        }
    }

    async getDockerSocketStatus(): Promise<GetDockerStatusResponse | null> {
        try {
            const res = await this.api.get(
                `/site/${this.siteId}/docker/status`
            );

            if (res.status === 200) {
                return res.data.data as GetDockerStatusResponse;
            } else {
                console.error("Failed to get Docker status:", res);
                return null;
            }
        } catch (error) {
            console.error("Failed to get Docker status:", error);
            return null;
        }
    }

    async fetchContainers(maxRetries: number = 3): Promise<Container[]> {
        const fetchContainerList = async (): Promise<Container[]> => {
            let attempt = 0;
            while (attempt < maxRetries) {
                try {
                    const res = await this.api.get(
                        `/site/${this.siteId}/docker/containers`
                    );
                    return res.data.data as Container[];
                } catch (error: any) {
                    attempt++;

                    // Check if the error is a 425 (Too Early) status
                    if (error?.response?.status === 425) {
                        if (attempt < maxRetries) {
                            console.log(
                                `Containers not ready yet (attempt ${attempt}/${maxRetries}). Retrying in 250ms...`
                            );
                            await sleep(250);
                            continue;
                        } else {
                            console.warn(
                                "Max retry attempts reached. Containers may still be loading."
                            );
                        }
                    } else {
                        console.error(
                            "Failed to fetch Docker containers:",
                            error
                        );
                        throw error;
                    }
                    break;
                }
            }
            return [];
        };

        try {
            await this.api.post(`/site/${this.siteId}/docker/trigger`);
            return await fetchContainerList();
        } catch (error) {
            console.error("Failed to trigger Docker containers:", error);
            return [];
        }
    }

    async initializeDocker(): Promise<DockerState> {
        console.log(`Initializing Docker for site ID: ${this.siteId}`);

        // For now, assume Docker is enabled for newt sites
        const isEnabled = true;

        if (!isEnabled) {
            return {
                isEnabled: false,
                isAvailable: false,
                containers: []
            };
        }

        // Check and get Docker socket status
        await this.checkDockerSocket();
        const dockerStatus = await this.getDockerSocketStatus();

        const isAvailable = dockerStatus?.isAvailable || false;
        let containers: Container[] = [];

        if (isAvailable) {
            containers = await this.fetchContainers();
        }

        return {
            isEnabled,
            isAvailable,
            socketPath: dockerStatus?.socketPath,
            containers
        };
    }
}
