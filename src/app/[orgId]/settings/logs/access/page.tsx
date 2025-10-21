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
import { Key, User } from "lucide-react";

export default function GeneralPage() {
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const router = useRouter();
    const api = createApiClient(useEnvContext());
    const t = useTranslations();
    const { env } = useEnvContext();
    const { orgId } = useParams();

    const [rows, setRows] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Set default date range to last 24 hours
    const getDefaultDateRange = () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        return {
            startDate: {
                date: yesterday,
            },
            endDate: {
                date: now,
            }
        };
    };

    const [dateRange, setDateRange] = useState<{ startDate: DateTimeValue; endDate: DateTimeValue }>(getDefaultDateRange());

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
        queryDateTime(startDate, endDate);
    };

    const queryDateTime = async (
        startDate: DateTimeValue,
        endDate: DateTimeValue
    ) => {
        console.log("Date range changed:", { startDate, endDate });
        setIsRefreshing(true);

        try {
            // Convert the date/time values to API parameters
            let params: any = {
                limit: 20,
                offset: 0
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
                    endDateTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());    
                }
                params.timeEnd = endDateTime.toISOString();
            }

            const res = await api.get(`/org/${orgId}/logs/action`, { params });
            if (res.status === 200) {
                setRows(res.data.data.log);
                console.log("Fetched logs:", res.data);
            }
        } catch (error) {
            toast({
                title: t("error"),
                description: t("Failed to filter logs"),
                variant: "destructive"
            });
        } finally {
            setIsRefreshing(false);
        }
    };


    const refreshData = async () => {
        console.log("Data refreshed");
        setIsRefreshing(true);
        try {
            await new Promise((resolve) => setTimeout(resolve, 200));
            router.refresh();
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

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "timestamp",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="hidden md:flex whitespace-nowrap"
                    >
                        {t("timestamp")}
                    </Button>
                );
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
            accessorKey: "action",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t("action")}
                    </Button>
                );
            },
            // make the value capitalized
            cell: ({ row }) => {
                return (
                    <span className="hitespace-nowrap">
                        {row.original.action.charAt(0).toUpperCase() + row.original.action.slice(1)}
                    </span>
                );
            },
        },
        {
            accessorKey: "actor",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        {t("actor")}
                    </Button>
                );
            },
                        cell: ({ row }) => {
                return (
                    <span className="flex items-center gap-1">
                        {row.original.actorType == "user" ? <User className="h-4 w-4" /> : <Key className="h-4 w-4" />}
                        {row.original.actor}
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
                persistPageSize="access-logs-table"
                title={t("accessLogs")}
                searchPlaceholder={t("searchLogs")}
                searchColumn="action"
                onRefresh={refreshData}
                isRefreshing={isRefreshing}
                onDateRangeChange={handleDateRangeChange}
                dateRange={{
                    start: dateRange.startDate,
                    end: dateRange.endDate
                }}
                defaultSort={{
                    id: "timestamp",
                    desc: false
                }}
            />
        </>
    );
}
