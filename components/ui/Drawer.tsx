"use client";

import { ReactNode } from "react";

export default function Drawer({
    title,
    subtitle,
    onClose,
    children,
    footer
}: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
    footer: ReactNode;
}) {
    return (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="drawer">
                <div className="drawerHead">
                    <div>
                        <h2>{title}</h2>
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                    <button onClick={onClose} aria-label="Close">&times;</button>
                </div>
                <div style={{ padding: "20px 25px", display: "grid", gap: 15 }}>
                    {children}
                </div>
                <div className="drawerFoot" style={{ padding: "0 25px 22px" }}>
                    {footer}
                </div>
            </div>
        </div>
    );
}
