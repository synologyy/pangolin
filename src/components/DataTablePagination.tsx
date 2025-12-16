import {
    ChevronLeftIcon,
    ChevronRightIcon,
    DoubleArrowLeftIcon,
    DoubleArrowRightIcon
} from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";

import { Button } from "@app/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@app/components/ui/select";
import { useTranslations } from "next-intl";

interface DataTablePaginationProps<TData> {
    table: Table<TData>;
    onPageSizeChange?: (pageSize: number) => void;
    onPageChange?: (pageIndex: number) => void;
    totalCount?: number;
    isServerPagination?: boolean;
    isLoading?: boolean;
    disabled?: boolean;
    pageSize?: number;
    pageIndex?: number;
}

export function DataTablePagination<TData>({
    table,
    onPageSizeChange,
    onPageChange,
    totalCount,
    isServerPagination = false,
    isLoading = false,
    disabled = false,
    pageSize: controlledPageSize,
    pageIndex: controlledPageIndex
}: DataTablePaginationProps<TData>) {
    const t = useTranslations();

    // Use controlled values if provided, otherwise fall back to table state
    const pageSize = controlledPageSize ?? table.getState().pagination.pageSize;
    const pageIndex =
        controlledPageIndex ?? table.getState().pagination.pageIndex;

    // Calculate page boundaries based on controlled state
    // For server-side pagination, use totalCount if available for accurate page count
    const pageCount =
        isServerPagination && totalCount !== undefined
            ? Math.ceil(totalCount / pageSize)
            : table.getPageCount();
    const canNextPage = pageIndex < pageCount - 1;
    const canPreviousPage = pageIndex > 0;

    const handlePageSizeChange = (value: string) => {
        const newPageSize = Number(value);
        table.setPageSize(newPageSize);

        // Call the callback if provided (for persistence)
        if (onPageSizeChange) {
            onPageSizeChange(newPageSize);
        }
    };

    const handlePageNavigation = (
        action: "first" | "previous" | "next" | "last"
    ) => {
        if (isServerPagination && onPageChange) {
            const currentPage = pageIndex;
            const pageCount = table.getPageCount();

            let newPage: number;
            switch (action) {
                case "first":
                    newPage = 0;
                    break;
                case "previous":
                    newPage = Math.max(0, currentPage - 1);
                    break;
                case "next":
                    newPage = Math.min(pageCount - 1, currentPage + 1);
                    break;
                case "last":
                    newPage = pageCount - 1;
                    break;
                default:
                    return;
            }

            if (newPage !== currentPage) {
                onPageChange(newPage);
            }
        } else {
            // Use table's built-in navigation for client-side pagination
            // But add bounds checking to prevent going beyond page boundaries
            const pageCount = table.getPageCount();
            switch (action) {
                case "first":
                    table.setPageIndex(0);
                    break;
                case "previous":
                    if (pageIndex > 0) {
                        table.previousPage();
                    }
                    break;
                case "next":
                    if (pageIndex < pageCount - 1) {
                        table.nextPage();
                    }
                    break;
                case "last":
                    table.setPageIndex(Math.max(0, pageCount - 1));
                    break;
            }
        }
    };

    return (
        <div className="flex items-center justify-between text-muted-foreground">
            <div className="flex items-center space-x-2">
                <Select
                    value={`${pageSize}`}
                    onValueChange={handlePageSizeChange}
                    disabled={disabled}
                >
                    <SelectTrigger className="h-8 w-[73px]" disabled={disabled}>
                        <SelectValue placeholder={pageSize} />
                    </SelectTrigger>
                    <SelectContent side="bottom">
                        {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                                {pageSize}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center space-x-3 lg:space-x-8">
                <div className="flex items-center justify-center text-sm font-medium">
                    {isServerPagination && totalCount !== undefined
                        ? t("paginator", {
                              current: pageIndex + 1,
                              last: Math.ceil(totalCount / pageSize)
                          })
                        : t("paginator", {
                              current: pageIndex + 1,
                              last: table.getPageCount()
                          })}
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => handlePageNavigation("first")}
                        disabled={!canPreviousPage || isLoading || disabled}
                    >
                        <span className="sr-only">{t("paginatorToFirst")}</span>
                        <DoubleArrowLeftIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => handlePageNavigation("previous")}
                        disabled={!canPreviousPage || isLoading || disabled}
                    >
                        <span className="sr-only">
                            {t("paginatorToPrevious")}
                        </span>
                        <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => handlePageNavigation("next")}
                        disabled={!canNextPage || isLoading || disabled}
                    >
                        <span className="sr-only">{t("paginatorToNext")}</span>
                        <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => handlePageNavigation("last")}
                        disabled={!canNextPage || isLoading || disabled}
                    >
                        <span className="sr-only">{t("paginatorToLast")}</span>
                        <DoubleArrowRightIcon className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
