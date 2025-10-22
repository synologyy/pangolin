"use client";
import { Button } from "@app/components/ui/button";
import { toast } from "@app/hooks/useToast";
import { useState, useRef, useEffect } from "react";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogDataTable } from "@app/components/LogDataTable";
import { ColumnDef } from "@tanstack/react-table";
import { DateTimeValue } from "@app/components/DateTimePicker";
import { Key, RouteOff, User, Lock, Unlock, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export default function GeneralPage() {
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const router = useRouter();
    const api = createApiClient(useEnvContext());
    const t = useTranslations();
    const { env } = useEnvContext();
    const { orgId } = useParams();

    const [rows, setRows] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Pagination state
    const [totalCount, setTotalCount] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(0);
    const [pageSize, setPageSize] = useState<number>(20);
    const [isLoading, setIsLoading] = useState(false);

    // Set default date range to last 24 hours
    const getDefaultDateRange = () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        return {
            startDate: {
                date: yesterday
            },
            endDate: {
                date: now
            }
        };
    };

    const [dateRange, setDateRange] = useState<{
        startDate: DateTimeValue;
        endDate: DateTimeValue;
    }>(getDefaultDateRange());

    // Trigger search with default values on component mount
    useEffect(() => {
        const defaultRange = getDefaultDateRange();
        queryDateTime(defaultRange.startDate, defaultRange.endDate);
    }, [orgId]); // Re-run if orgId changes

    const handleDateRangeChange = (
        startDate: DateTimeValue,
        endDate: DateTimeValue
    ) => {
        setDateRange({ startDate, endDate });
        setCurrentPage(0); // Reset to first page when filtering
        queryDateTime(startDate, endDate, 0, pageSize);
    };

    // Handle page changes
    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        queryDateTime(
            dateRange.startDate,
            dateRange.endDate,
            newPage,
            pageSize
        );
    };

    // Handle page size changes
    const handlePageSizeChange = (newPageSize: number) => {
        setPageSize(newPageSize);
        setCurrentPage(0); // Reset to first page when changing page size
        queryDateTime(dateRange.startDate, dateRange.endDate, 0, newPageSize);
    };

    const queryDateTime = async (
        startDate: DateTimeValue,
        endDate: DateTimeValue,
        page: number = currentPage,
        size: number = pageSize
    ) => {
        console.log("Date range changed:", { startDate, endDate, page, size });
        setIsLoading(true);

        try {
            // Convert the date/time values to API parameters
            let params: any = {
                limit: size,
                offset: page * size
            };

            if (startDate?.date) {
                const startDateTime = new Date(startDate.date);
                if (startDate.time) {
                    const [hours, minutes, seconds] = startDate.time
                        .split(":")
                        .map(Number);
                    startDateTime.setHours(hours, minutes, seconds || 0);
                }
                params.timeStart = startDateTime.toISOString();
            }

            if (endDate?.date) {
                const endDateTime = new Date(endDate.date);
                if (endDate.time) {
                    const [hours, minutes, seconds] = endDate.time
                        .split(":")
                        .map(Number);
                    endDateTime.setHours(hours, minutes, seconds || 0);
                } else {
                    // If no time is specified, set to NOW
                    const now = new Date();
                    endDateTime.setHours(
                        now.getHours(),
                        now.getMinutes(),
                        now.getSeconds(),
                        now.getMilliseconds()
                    );
                }
                params.timeEnd = endDateTime.toISOString();
            }

            const res = await api.get(`/org/${orgId}/logs/request`, { params });
            if (res.status === 200) {
                setRows(res.data.data.log || []);
                setTotalCount(res.data.data.pagination?.total || 0);
                console.log("Fetched logs:", res.data);
            }
        } catch (error) {
            toast({
                title: t("error"),
                description: t("Failed to filter logs"),
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const refreshData = async () => {
        console.log("Data refreshed");
        setIsRefreshing(true);
        try {
            // Refresh data with current date range and pagination
            await queryDateTime(
                dateRange.startDate,
                dateRange.endDate,
                currentPage,
                pageSize
            );
        } catch (error) {
            toast({
                title: t("error"),
                description: t("refreshError"),
                variant: "destructive"
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    const exportData = async () => {
        try {
            setIsExporting(true);
            const response = await api.get(
                `/org/${orgId}/logs/request/export`,
                {
                    responseType: "blob",
                    params: {
                        timeStart: dateRange.startDate?.date
                            ? new Date(dateRange.startDate.date).toISOString()
                            : undefined,
                        timeEnd: dateRange.endDate?.date
                            ? new Date(dateRange.endDate.date).toISOString()
                            : undefined
                    }
                }
            );

            // Create a URL for the blob and trigger a download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            const epoch = Math.floor(Date.now() / 1000);
            link.setAttribute(
                "download",
                `request-audit-logs-${orgId}-${epoch}.csv`
            );
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            setIsExporting(false);
        } catch (error) {
            toast({
                title: t("error"),
                description: t("exportError"),
                variant: "destructive"
            });
        }
    };

    // 100 - Allowed by Rule
    // 101 - Allowed No Auth
    // 102 - Valid Access Token
    // 103 - Valid header auth
    // 104 - Valid Pincode
    // 105 - Valid Password
    // 106 - Valid email
    // 107 - Valid SSO

    // 201 - Resource Not Found
    // 202 - Resource Blocked
    // 203 - Dropped by Rule
    // 204 - No Sessions
    // 205 - Temporary Request Token
    // 299 - No More Auth Methods

    const reasonMap: any = {
        100: t("allowedByRule"),
        101: t("allowedNoAuth"),
        102: t("validAccessToken"),
        103: t("validHeaderAuth"),
        104: t("validPincode"),
        105: t("validPassword"),
        106: t("validEmail"),
        107: t("validSSO"),
        201: t("resourceNotFound"),
        202: t("resourceBlocked"),
        203: t("droppedByRule"),
        204: t("noSessions"),
        205: t("temporaryRequestToken"),
        299: t("noMoreAuthMethods")
    };

    // resourceId: integer("resourceId"),
    // userAgent: text("userAgent"),
    // metadata: text("details"),
    // headers: text("headers"), // JSON blob
    // query: text("query"), // JSON blob
    // originalRequestURL: text("originalRequestURL"),
    // scheme: text("scheme"),

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "timestamp",
            header: ({ column }) => {
                return t("timestamp");
            },
            cell: ({ row }) => {
                return (
                    <div className="whitespace-nowrap">
                        {new Date(
                            row.original.timestamp * 1000
                        ).toLocaleString()}
                    </div>
                );
            }
        },

        {
            accessorKey: "ip",
            header: ({ column }) => {
                return t("ip");
            }
        },

        {
            accessorKey: "location",
            header: ({ column }) => {
                return t("location");
            },
            cell: ({ row }) => {
                return (
                    <span className="flex items-center gap-1">
                        {row.original.location ? (
                            <span className="text-muted-foreground text-xs">
                                ({row.original.location})
                            </span>
                        ) : (
                            <span className="text-muted-foreground text-xs">
                                -
                            </span>
                        )}
                    </span>
                );
            }
        },
        {
            accessorKey: "resourceName",
            header: t("resource"),
            cell: ({ row }) => {
                return (
                    <Link
                        href={`/${row.original.orgId}/settings/resources/${row.original.resourceNiceId}`}
                    >
                        <Button variant="outline" size="sm" className="text-xs h-6">
                            {row.original.resourceName}
                            <ArrowUpRight className="ml-2 h-3 w-3" />
                        </Button>
                    </Link>
                );
            }
        },
        {
            accessorKey: "host",
            header: ({ column }) => {
                return t("host");
            },
            cell: ({ row }) => {
                return (
                    <span className="flex items-center gap-1">
                        {row.original.tls ? (
                            <Lock className="h-4 w-4" />
                        ) : (
                            <Unlock className="h-4 w-4" />
                        )}
                        {row.original.host}
                    </span>
                );
            }
        },
        {
            accessorKey: "path",
            header: ({ column }) => {
                return t("path");
            }
        },

        // {
        //     accessorKey: "scheme",
        //     header: ({ column }) => {
        //         return t("scheme");
        //     },
        // },
        {
            accessorKey: "method",
            header: ({ column }) => {
                return t("method");
            }
        },
        {
            accessorKey: "reason",
            header: ({ column }) => {
                return t("reason");
            },
            cell: ({ row }) => {
                return (
                    <span className="flex items-center gap-1">
                        {reasonMap[row.original.reason]}
                    </span>
                );
            }
        },
        {
            accessorKey: "actor",
            header: ({ column }) => {
                return t("actor");
            },
            cell: ({ row }) => {
                return (
                    <span className="flex items-center gap-1">
                        {row.original.actor ? (
                            <>
                                {row.original.actorType == "user" ? (
                                    <User className="h-4 w-4" />
                                ) : (
                                    <Key className="h-4 w-4" />
                                )}
                                {row.original.actor}
                            </>
                        ) : (
                            <>-</>
                        )}
                    </span>
                );
            }
        }
    ];

    return (
        <>
            <LogDataTable
                columns={columns}
                data={rows}
                persistPageSize="request-logs-table"
                title={t("requestLogs")}
                searchPlaceholder={t("searchLogs")}
                searchColumn="host"
                onRefresh={refreshData}
                isRefreshing={isRefreshing}
                onExport={exportData}
                isExporting={isExporting}
                onDateRangeChange={handleDateRangeChange}
                dateRange={{
                    start: dateRange.startDate,
                    end: dateRange.endDate
                }}
                defaultSort={{
                    id: "timestamp",
                    desc: false
                }}
                // Server-side pagination props
                totalCount={totalCount}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                isLoading={isLoading}
                defaultPageSize={pageSize}
            />
        </>
    );
}
