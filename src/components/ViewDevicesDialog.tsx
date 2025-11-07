"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Credenza,
    CredenzaBody,
    CredenzaClose,
    CredenzaContent,
    CredenzaDescription,
    CredenzaFooter,
    CredenzaHeader,
    CredenzaTitle
} from "@app/components/Credenza";
import { useTranslations } from "next-intl";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { toast } from "@app/hooks/useToast";
import { formatAxiosError } from "@app/lib/api";
import { ListUserOlmsResponse } from "@server/routers/olm";
import { ResponseT } from "@server/types/Response";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@app/components/ui/table";
import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";
import { RefreshCw } from "lucide-react";
import moment from "moment";
import { useUserContext } from "@app/hooks/useUserContext";

type ViewDevicesDialogProps = {
    open: boolean;
    setOpen: (val: boolean) => void;
};

type Device = {
    olmId: string;
    dateCreated: string;
    version: string | null;
    name: string | null;
    clientId: number | null;
    userId: string | null;
};

export default function ViewDevicesDialog({
    open,
    setOpen
}: ViewDevicesDialogProps) {
    const t = useTranslations();
    const { env } = useEnvContext();
    const api = createApiClient({ env });
    const { user } = useUserContext();

    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

    const fetchDevices = async () => {
        setLoading(true);
        try {
            const res = await api.get<ResponseT<ListUserOlmsResponse>>(
                `/user/${user?.userId}/olms`
            );
            if (res.data.success && res.data.data) {
                setDevices(res.data.data.olms);
            }
        } catch (error: any) {
            console.error("Error fetching devices:", error);
            toast({
                variant: "destructive",
                title: t("errorLoadingDevices") || "Error loading devices",
                description: formatAxiosError(
                    error,
                    t("failedToLoadDevices") || "Failed to load devices"
                )
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchDevices();
        }
    }, [open]);

    const deleteDevice = async (olmId: string) => {
        try {
            await api.delete(`/user/${user?.userId}/olm/${olmId}`);
            toast({
                title: t("deviceDeleted") || "Device deleted",
                description:
                    t("deviceDeletedDescription") ||
                    "The device has been successfully deleted."
            });
            setDevices(devices.filter((d) => d.olmId !== olmId));
            setIsDeleteModalOpen(false);
            setSelectedDevice(null);
        } catch (error: any) {
            console.error("Error deleting device:", error);
            toast({
                variant: "destructive",
                title: t("errorDeletingDevice") || "Error deleting device",
                description: formatAxiosError(
                    error,
                    t("failedToDeleteDevice") || "Failed to delete device"
                )
            });
        }
    };

    function reset() {
        setDevices([]);
        setSelectedDevice(null);
        setIsDeleteModalOpen(false);
    }

    return (
        <>
            <Credenza
                open={open}
                onOpenChange={(val) => {
                    setOpen(val);
                    if (!val) {
                        reset();
                    }
                }}
            >
                <CredenzaContent className="max-w-4xl">
                    <CredenzaHeader>
                        <CredenzaTitle>
                            {t("viewDevices") || "View Devices"}
                        </CredenzaTitle>
                        <CredenzaDescription>
                            {t("viewDevicesDescription") ||
                                "Manage your connected devices"}
                        </CredenzaDescription>
                    </CredenzaHeader>
                    <CredenzaBody>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <RefreshCw className="h-6 w-6 animate-spin" />
                            </div>
                        ) : devices.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                {t("noDevices") || "No devices found"}
                            </div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-3">
                                                {t("name") || "Name"}
                                            </TableHead>
                                            <TableHead>
                                                {t("dateCreated") ||
                                                    "Date Created"}
                                            </TableHead>
                                            <TableHead>
                                                {t("actions") || "Actions"}
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {devices.map((device) => (
                                            <TableRow key={device.olmId}>
                                                <TableCell className="font-medium">
                                                    {device.name ||
                                                        t("unnamedDevice") ||
                                                        "Unnamed Device"}
                                                </TableCell>
                                                <TableCell>
                                                    {moment(
                                                        device.dateCreated
                                                    ).format("lll")}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSelectedDevice(
                                                                device
                                                            );
                                                            setIsDeleteModalOpen(
                                                                true
                                                            );
                                                        }}
                                                    >
                                                        {t("delete") ||
                                                            "Delete"}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CredenzaBody>
                    <CredenzaFooter>
                        <CredenzaClose asChild>
                            <Button variant="outline">
                                {t("close") || "Close"}
                            </Button>
                        </CredenzaClose>
                    </CredenzaFooter>
                </CredenzaContent>
            </Credenza>

            {selectedDevice && (
                <ConfirmDeleteDialog
                    open={isDeleteModalOpen}
                    setOpen={(val) => {
                        setIsDeleteModalOpen(val);
                        if (!val) {
                            setSelectedDevice(null);
                        }
                    }}
                    dialog={
                        <div>
                            <p>
                                {t("deviceQuestionRemove") ||
                                    "Are you sure you want to delete this device?"}
                            </p>
                            <p>
                                {t("deviceMessageRemove") ||
                                    "This action cannot be undone."}
                            </p>
                        </div>
                    }
                    buttonText={t("deviceDeleteConfirm") || "Delete Device"}
                    onConfirm={async () => deleteDevice(selectedDevice.olmId)}
                    string={selectedDevice.name || selectedDevice.olmId}
                    title={t("deleteDevice") || "Delete Device"}
                />
            )}
        </>
    );
}
