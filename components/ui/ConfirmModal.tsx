"use client";

export default function ConfirmModal({
    title,
    message,
    confirmLabel = "Confirm",
    danger = false,
    loading = false,
    onConfirm,
    onCancel
}: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="modalOverlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <div className="modalCard">
                <div className="modalHead">
                    <h3>{title}</h3>
                    <button className="closeBtn" onClick={onCancel} aria-label="Close">&times;</button>
                </div>
                <div className="modalBody">
                    <p style={{ margin: 0 }}>{message}</p>
                </div>
                <div className="modalFoot">
                    <button onClick={onCancel} disabled={loading}>Cancel</button>
                    <button className={danger ? "danger" : "primary"} onClick={onConfirm} disabled={loading}>
                        {loading ? "Working…" : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
