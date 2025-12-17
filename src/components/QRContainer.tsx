"use client";

export default function QRContainer({ children = <div />, outline = true }) {
    return (
        <div className={`relative w-fit border-2 rounded-md`}>
            <div className="bg-white p-6 rounded-md">{children}</div>
        </div>
    );
}
