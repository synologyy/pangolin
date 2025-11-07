"use client";

import { useEnvContext } from "@app/hooks/useEnvContext";
import { useLocalStorage } from "@app/hooks/useLocalStorage";
import { cn } from "@app/lib/cn";
import { type ProductUpdate, productUpdatesQueries } from "@app/lib/queries";
import { useQueries } from "@tanstack/react-query";
import {
    ArrowRight,
    BellIcon,
    ChevronRightIcon,
    RocketIcon,
    XIcon
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Transition } from "@headlessui/react";
import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { timeAgoFormatter } from "@app/lib/timeAgoFormatter";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "./ui/tooltip";

export default function ProductUpdates({
    isCollapsed
}: {
    isCollapsed?: boolean;
}) {
    const data = useQueries({
        queries: [
            productUpdatesQueries.list,
            productUpdatesQueries.latestVersion
        ],
        combine(result) {
            if (result[0].isLoading || result[1].isLoading) return null;
            return {
                updates: result[0].data?.data ?? [],
                latestVersion: result[1].data
            };
        }
    });
    const { env } = useEnvContext();
    const t = useTranslations();
    const [showMoreUpdatesText, setShowMoreUpdatesText] = React.useState(false);

    // we delay the small text animation so that the user can notice it
    React.useEffect(() => {
        const timeout = setTimeout(() => setShowMoreUpdatesText(true), 600);
        return () => clearTimeout(timeout);
    }, []);

    const [ignoredVersionUpdate, setIgnoredVersionUpdate] = useLocalStorage<
        string | null
    >("product-updates:skip-version", null);

    const [productUpdatesRead, setProductUpdatesRead] = useLocalStorage<
        number[]
    >("product-updates:read", []);

    if (!data) return null;

    const showNewVersionPopup = Boolean(
        data?.latestVersion?.data &&
            ignoredVersionUpdate !==
                data.latestVersion.data?.pangolin.latestVersion &&
            env.app.version !== data.latestVersion.data?.pangolin.latestVersion
    );

    const filteredUpdates = data.updates.filter(
        (update) => !productUpdatesRead.includes(update.id)
    );

    return (
        <div
            className={cn(
                "flex flex-col gap-2 overflow-clip",
                isCollapsed && "hidden"
            )}
        >
            <div className="flex flex-col gap-1">
                <small
                    className={cn(
                        "text-xs text-muted-foreground flex items-center gap-1 mt-2",
                        showMoreUpdatesText
                            ? "animate-in fade-in duration-300"
                            : "opacity-0"
                    )}
                >
                    {filteredUpdates.length > 0 && (
                        <>
                            <BellIcon className="flex-none size-3" />
                            <span>
                                {showNewVersionPopup
                                    ? t("productUpdateMoreInfo", {
                                          noOfUpdates: filteredUpdates.length
                                      })
                                    : t("productUpdateInfo", {
                                          noOfUpdates: filteredUpdates.length
                                      })}
                            </span>
                        </>
                    )}
                </small>
                <ProductUpdatesListPopup
                    updates={filteredUpdates}
                    show={filteredUpdates.length > 0}
                    onDimissAll={() =>
                        setProductUpdatesRead([
                            ...productUpdatesRead,
                            ...filteredUpdates.map((update) => update.id)
                        ])
                    }
                    onDimiss={(id) =>
                        setProductUpdatesRead([...productUpdatesRead, id])
                    }
                />
            </div>

            <NewVersionAvailable
                version={data.latestVersion?.data}
                onDimiss={() => {
                    setIgnoredVersionUpdate(
                        data.latestVersion?.data?.pangolin.latestVersion ?? null
                    );
                }}
                show={showNewVersionPopup}
            />
        </div>
    );
}

type ProductUpdatesListPopupProps = {
    updates: ProductUpdate[];
    show: boolean;
    onDimiss: (id: number) => void;
    onDimissAll: () => void;
};

function ProductUpdatesListPopup({
    updates,
    show,
    onDimiss,
    onDimissAll
}: ProductUpdatesListPopupProps) {
    const [showContent, setShowContent] = React.useState(false);
    const [popoverOpen, setPopoverOpen] = React.useState(false);
    const t = useTranslations();

    // we need to delay the initial opening state to have an animation on `appear`
    React.useEffect(() => {
        if (show) {
            requestAnimationFrame(() => setShowContent(true));
        }
    }, [show]);

    React.useEffect(() => {
        if (updates.length === 0) {
            setShowContent(false);
            setPopoverOpen(false);
        }
    }, [updates.length]);

    return (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <Transition show={showContent}>
                <PopoverTrigger asChild>
                    <div
                        className={cn(
                            "relative z-1 cursor-pointer block",
                            "rounded-md border bg-muted p-2 py-3 w-full flex items-start gap-2 text-sm",
                            "transition duration-300 ease-in-out",
                            "data-closed:opacity-0 data-closed:translate-y-full"
                        )}
                    >
                        <div className="rounded-md bg-muted-foreground/20 p-2">
                            <BellIcon className="flex-none size-4" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <p className="font-medium text-start">
                                {t("productUpdateWhatsNew")}
                            </p>
                            <small
                                className={cn(
                                    "text-start text-muted-foreground",
                                    "overflow-hidden h-8",
                                    "[-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]"
                                )}
                            >
                                {updates[0]?.contents}
                            </small>
                        </div>
                        <div className="p-1 cursor-pointer">
                            <ChevronRightIcon className="size-4 flex-none" />
                        </div>
                    </div>
                </PopoverTrigger>
            </Transition>
            <PopoverContent
                side="right"
                align="end"
                sideOffset={10}
                className="p-0 flex flex-col w-85"
            >
                <div className="p-3 flex justify-between border-b items-center">
                    <span className="text-sm inline-flex gap-2 items-center font-medium">
                        {t("productUpdateTitle")}
                        {updates.length > 0 && (
                            <Badge variant="secondary">{updates.length}</Badge>
                        )}
                    </span>
                    <Button variant="outline" onClick={onDimissAll}>
                        {t("dismissAll")}
                    </Button>
                </div>
                <ol className="p-3 flex flex-col gap-1 max-h-112 overflow-y-auto">
                    {updates.length === 0 && (
                        <small className="border rounded-md flex p-4 border-dashed justify-center items-center text-muted-foreground">
                            No updates
                        </small>
                    )}
                    {updates.map((update) => (
                        <li
                            key={update.id}
                            className="border rounded-md flex flex-col p-4 gap-2.5 group hover:bg-accent relative"
                        >
                            <div className="flex justify-between gap-2 items-start">
                                <h4 className="text-sm font-medium inline-flex items-start gap-1">
                                    <span>{update.title}</span>
                                    <Badge
                                        variant="secondary"
                                        className="bg-black text-white dark:bg-white dark:text-black"
                                    >
                                        {update.type}
                                    </Badge>
                                </h4>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="p-1 py-1 opacity-100 h-auto group-hover:opacity-100"
                                                onClick={() =>
                                                    onDimiss(update.id)
                                                }
                                            >
                                                <XIcon className="flex-none size-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent
                                            side="right"
                                            sideOffset={8}
                                        >
                                            {t("dismiss")}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <small className="text-muted-foreground">
                                {update.contents}
                            </small>
                            <time
                                dateTime={update.publishedAt.toLocaleString()}
                                className="text-xs text-muted-foreground"
                            >
                                {timeAgoFormatter(update.publishedAt)}
                            </time>
                        </li>
                    ))}
                </ol>
            </PopoverContent>
        </Popover>
    );
}

type NewVersionAvailableProps = {
    onDimiss: () => void;
    show: boolean;
    version:
        | Awaited<
              ReturnType<
                  NonNullable<
                      typeof productUpdatesQueries.latestVersion.queryFn
                  >
              >
          >["data"]
        | undefined;
};

function NewVersionAvailable({
    version,
    show,
    onDimiss
}: NewVersionAvailableProps) {
    const t = useTranslations();
    const [open, setOpen] = React.useState(false);

    // we need to delay the initial opening state to have an animation on `appear`
    React.useEffect(() => {
        if (show) {
            requestAnimationFrame(() => setOpen(true));
        }
    }, [show]);

    return (
        <Transition show={open}>
            <div
                className={cn(
                    "relative z-2",
                    "rounded-md border bg-muted p-2 py-3 w-full flex items-start gap-2 text-sm",
                    "transition duration-300 ease-in-out",
                    "data-closed:opacity-0 data-closed:translate-y-full"
                )}
            >
                {version && (
                    <>
                        <div className="rounded-md bg-muted-foreground/20 p-2">
                            <RocketIcon className="flex-none size-4" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <p className="font-medium">
                                {t("pangolinUpdateAvailable")}
                            </p>
                            <small className="text-muted-foreground">
                                {t("pangolinUpdateAvailableInfo", {
                                    version: version.pangolin.latestVersion
                                })}
                            </small>
                            <a
                                href={version.pangolin.releaseNotes}
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
                            onClick={() => {
                                setOpen(false);
                                onDimiss();
                            }}
                        >
                            <XIcon className="size-4 flex-none" />
                        </button>
                    </>
                )}
            </div>
        </Transition>
    );
}
