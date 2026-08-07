"use client";

import { useState } from "react";
import { Sparkles, X, AlertTriangle, TrendingDown, Ban } from "lucide-react";
import { useAlerts } from "@/lib/alerts";

const ICONS = {
    expiry: AlertTriangle,
    "low-stock": TrendingDown,
    "out-of-stock": Ban
} as const;

export default function AiAssistantPanel() {
    const [open, setOpen] = useState(false);
    const alerts = useAlerts();

    return (
        <>
            <button className="aiFab" onClick={() => setOpen((o) => !o)} aria-label="DentiGO Assistant">
                <Sparkles size={20} />
                {alerts.length > 0 && <b className="aiFabBadge">{alerts.length}</b>}
            </button>

            {open && (
                <div className="aiPanel">
                    <div className="aiPanelHead">
                        <div className="aiPanelHeadTitle">
                            <Sparkles size={16} />
                            <div>
                                <strong>DentiGO Assistant</strong>
                                <small>Live inventory watch</small>
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
                    </div>
                    <div className="aiPanelBody">
                        {alerts.length === 0 ? (
                            <div className="aiPanelEmpty">
                                <Sparkles size={22} />
                                <p>All clear — stock levels and expiry dates look healthy right now.</p>
                            </div>
                        ) : (
                            alerts.map((alert, i) => {
                                const Icon = ICONS[alert.kind];
                                return (
                                    <div key={alert.id} className={`aiAlertItem aiAlertItem-${alert.kind}`} style={{ animationDelay: `${i * 60}ms` }}>
                                        <span className="aiAlertIcon"><Icon size={15} /></span>
                                        <p>{alert.message}</p>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
