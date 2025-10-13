/*
 * This file is part of a proprietary work.
 *
 * Copyright (c) 2025 Fossorial, Inc.
 * All rights reserved.
 *
 * This file is licensed under the Fossorial Commercial License.
 * You may not use this file except in compliance with the License.
 * Unauthorized use, copying, modification, or distribution is strictly prohibited.
 *
 * This file is not licensed under the AGPLv3.
 */

import { z } from "zod";
import { __DIRNAME } from "@server/lib/consts";
import { SupporterKey } from "@server/db";
import { fromError } from "zod-validation-error";
import {
    privateConfigSchema,
    readPrivateConfigFile
} from "#private/lib/readConfigFile";
import { build } from "@server/build";

export class PrivateConfig {
    private rawPrivateConfig!: z.infer<typeof privateConfigSchema>;

    supporterData: SupporterKey | null = null;

    supporterHiddenUntil: number | null = null;

    isDev: boolean = process.env.ENVIRONMENT !== "prod";

    constructor() {
        const privateEnvironment = readPrivateConfigFile();

        const {
            data: parsedPrivateConfig,
            success: privateSuccess,
            error: privateError
        } = privateConfigSchema.safeParse(privateEnvironment);

        if (!privateSuccess) {
            const errors = fromError(privateError);
            throw new Error(`Invalid private configuration file: ${errors}`);
        }

        if (parsedPrivateConfig.branding?.colors) {
            process.env.BRANDING_COLORS = JSON.stringify(
                parsedPrivateConfig.branding?.colors
            );
        }

        if (parsedPrivateConfig.branding?.logo?.light_path) {
            process.env.BRANDING_LOGO_LIGHT_PATH =
                parsedPrivateConfig.branding?.logo?.light_path;
        }
        if (parsedPrivateConfig.branding?.logo?.dark_path) {
            process.env.BRANDING_LOGO_DARK_PATH =
                parsedPrivateConfig.branding?.logo?.dark_path || undefined;
        }

        if (build != "oss") {
            if (parsedPrivateConfig.branding?.logo?.light_path) {
                process.env.BRANDING_LOGO_LIGHT_PATH =
                    parsedPrivateConfig.branding?.logo?.light_path;
            }
            if (parsedPrivateConfig.branding?.logo?.dark_path) {
                process.env.BRANDING_LOGO_DARK_PATH =
                    parsedPrivateConfig.branding?.logo?.dark_path || undefined;
            }

            process.env.BRANDING_LOGO_AUTH_WIDTH = parsedPrivateConfig.branding
                ?.logo?.auth_page?.width
                ? parsedPrivateConfig.branding?.logo?.auth_page?.width.toString()
                : undefined;
            process.env.BRANDING_LOGO_AUTH_HEIGHT = parsedPrivateConfig.branding
                ?.logo?.auth_page?.height
                ? parsedPrivateConfig.branding?.logo?.auth_page?.height.toString()
                : undefined;

            process.env.BRANDING_LOGO_NAVBAR_WIDTH = parsedPrivateConfig
                .branding?.logo?.navbar?.width
                ? parsedPrivateConfig.branding?.logo?.navbar?.width.toString()
                : undefined;
            process.env.BRANDING_LOGO_NAVBAR_HEIGHT = parsedPrivateConfig
                .branding?.logo?.navbar?.height
                ? parsedPrivateConfig.branding?.logo?.navbar?.height.toString()
                : undefined;

            process.env.BRANDING_FAVICON_PATH =
                parsedPrivateConfig.branding?.favicon_path;

            process.env.BRANDING_APP_NAME =
                parsedPrivateConfig.branding?.app_name || "Pangolin";

            if (parsedPrivateConfig.branding?.footer) {
                process.env.BRANDING_FOOTER = JSON.stringify(
                    parsedPrivateConfig.branding?.footer
                );
            }

            process.env.LOGIN_PAGE_TITLE_TEXT =
                parsedPrivateConfig.branding?.login_page?.title_text || "";
            process.env.LOGIN_PAGE_SUBTITLE_TEXT =
                parsedPrivateConfig.branding?.login_page?.subtitle_text || "";

            process.env.SIGNUP_PAGE_TITLE_TEXT =
                parsedPrivateConfig.branding?.signup_page?.title_text || "";
            process.env.SIGNUP_PAGE_SUBTITLE_TEXT =
                parsedPrivateConfig.branding?.signup_page?.subtitle_text || "";

            process.env.RESOURCE_AUTH_PAGE_HIDE_POWERED_BY =
                parsedPrivateConfig.branding?.resource_auth_page
                    ?.hide_powered_by === true
                    ? "true"
                    : "false";
            process.env.RESOURCE_AUTH_PAGE_SHOW_LOGO =
                parsedPrivateConfig.branding?.resource_auth_page?.show_logo ===
                true
                    ? "true"
                    : "false";
            process.env.RESOURCE_AUTH_PAGE_TITLE_TEXT =
                parsedPrivateConfig.branding?.resource_auth_page?.title_text ||
                "";
            process.env.RESOURCE_AUTH_PAGE_SUBTITLE_TEXT =
                parsedPrivateConfig.branding?.resource_auth_page
                    ?.subtitle_text || "";

            if (parsedPrivateConfig.branding?.background_image_path) {
                process.env.BACKGROUND_IMAGE_PATH =
                    parsedPrivateConfig.branding?.background_image_path;
            }

            if (parsedPrivateConfig.server.reo_client_id) {
                process.env.REO_CLIENT_ID =
                    parsedPrivateConfig.server.reo_client_id;
            }

            if (parsedPrivateConfig.stripe?.s3Bucket) {
                process.env.S3_BUCKET = parsedPrivateConfig.stripe.s3Bucket;
            }
            if (parsedPrivateConfig.stripe?.localFilePath) {
                process.env.LOCAL_FILE_PATH =
                    parsedPrivateConfig.stripe.localFilePath;
            }
            if (parsedPrivateConfig.stripe?.s3Region) {
                process.env.S3_REGION = parsedPrivateConfig.stripe.s3Region;
            }
            if (parsedPrivateConfig.flags.use_pangolin_dns) {
                process.env.USE_PANGOLIN_DNS =
                    parsedPrivateConfig.flags.use_pangolin_dns.toString();
            }
        }

        this.rawPrivateConfig = parsedPrivateConfig;
    }

    public getRawPrivateConfig() {
        return this.rawPrivateConfig;
    }
}

export const privateConfig = new PrivateConfig();

export default privateConfig;
