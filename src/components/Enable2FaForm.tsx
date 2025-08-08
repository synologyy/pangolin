"use client";

import { useUserContext } from "@app/hooks/useUserContext";
import Enable2FaDialog from "./Enable2FaDialog";

type Enable2FaProps = {
    open: boolean;
    setOpen: (val: boolean) => void;
};

export default function Enable2FaForm({ open, setOpen }: Enable2FaProps) {
    return <Enable2FaDialog open={open} setOpen={setOpen} />;
}
