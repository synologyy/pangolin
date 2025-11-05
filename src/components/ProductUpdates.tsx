"use client";

import { useEnvContext } from "@app/hooks/useEnvContext";
import { useLocalStorage } from "@app/hooks/useLocalStorage";
import { cn } from "@app/lib/cn";
import { versionsQueries } from "@app/lib/queries";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BellIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface ProductUpdatesProps {}

export default function ProductUpdates({}: ProductUpdatesProps) {
    return (
        <div className="flex flex-col gap-1 relative z-1 overflow-clip">
            {/* <small className="text-xs text-muted-foreground flex items-center gap-1">
                <BellIcon className="flex-none size-3" />
                <span>3 more updates</span>
            </small> */}
            <NewVersionAvailable />
        </div>
    );
}

function NewVersionAvailable() {
    const { env } = useEnvContext();
    const t = useTranslations();
    const { data: version } = useQuery(versionsQueries.latestVersion());

    const [ignoredVersionUpdate, setIgnoredVersionUpdate] = useLocalStorage<
        string | null
    >("ignored-version", null);

    const showNewVersionPopup =
        version?.data &&
        ignoredVersionUpdate !== version.data.pangolin.latestVersion &&
        env.app.version !== version.data.pangolin.latestVersion;

    if (!showNewVersionPopup) return null;

    return (
        <div
            className={cn(
                "rounded-md border bg-muted p-2 py-3 w-full flex items-start gap-2 text-sm",
                "animate-in slide-in-from-bottom duration-300"
            )}
        >
            {version?.data && (
                <>
                    <div className="rounded-md bg-muted-foreground/20 p-2">
                        <BellIcon className="flex-none size-4" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <p className="font-medium">
                            {t("pangolinUpdateAvailable")}
                        </p>
                        <small className="text-muted-foreground">
                            {t("pangolinUpdateAvailableInfo", {
                                version: version.data.pangolin.latestVersion
                            })}
                        </small>
                        <a
                            href={version.data.pangolin.releaseNotes}
                            target="_blank"
                            className="inline-flex items-center gap-0.5 text-xs font-medium"
                        >
                            <span>
                                {t("pangolinUpdateAvailableReleaseNotes")}
                            </span>
                            <ArrowRight className="flex-none size-3" />
                        </a>
                    </div>
                    <button
                        className="p-1 cursor-pointer"
                        onClick={() =>
                            setIgnoredVersionUpdate(
                                version.data?.pangolin.latestVersion ?? null
                            )
                        }
                    >
                        <XIcon className="size-4 flex-none" />
                    </button>
                </>
            )}
        </div>
    );
}
