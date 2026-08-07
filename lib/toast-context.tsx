"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

type ToastType = "success" | "error" | "info";
type ToastState = { id: number; message: string; type: ToastType } | null;

const ToastContext = createContext<((message: string, type?: ToastType) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toast, setToast] = useState<ToastState>(null);

    const showToast = useCallback((message: string, type: ToastType = "success") => {
        const id = Date.now();
        setToast({ id, message, type });
        setTimeout(() => {
            setToast((current) => (current?.id === id ? null : current));
        }, 3000);
    }, []);

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            {toast && (
                <div className={`toast ${toast.type}`}>
                    <span>{toast.type === "error" ? "✕" : "✓"}</span>
                    {toast.message}
                    <i />
                </div>
            )}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
}
