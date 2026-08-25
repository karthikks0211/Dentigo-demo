"use client";

import { useState } from "react";

/** Same visual shell as ConfirmModal, but collects one line of free text before confirming — used for approval notes, rejection/cancellation reasons, etc. */
export default function PromptModal({
    title,
    message,
    label,
    placeholder,
    required = false,
    confirmLabel = "Confirm",
    danger = false,
    loading = false,
    onConfirm,
    onCancel
}: {
    title: string;
    message?: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    confirmLabel?: string;
    danger?: boolean;
    loading?: boolean;
    onConfirm: (value: string) => void;
    onCancel: () => void;
}) {
    const [value, setValue] = useState("");
    const canSubmit = !required || value.trim().length > 0;

    return (
        <div className="modalOverlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <div className="modalCard">
                <div className="modalHead">
                    <h3>{title}</h3>
                    <button className="closeBtn" onClick={onCancel} aria-label="Close">&times;</button>
                </div>
                <div className="modalBody" style={{ display: "grid", gap: 10 }}>
                    {message && <p style={{ margin: 0 }}>{message}</p>}
                    <label>{label}
                        <textarea
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={placeholder}
                            rows={3}
                            autoFocus
                        />
                    </label>
                </div>
                <div className="modalFoot">
                    <button onClick={onCancel} disabled={loading}>Cancel</button>
                    <button
                        className={danger ? "danger" : "primary"}
                        onClick={() => onConfirm(value.trim())}
                        disabled={loading || !canSubmit}
                    >
                        {loading ? "Working…" : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
