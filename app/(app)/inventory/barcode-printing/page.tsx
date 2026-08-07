"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import type { Medicine } from "@/lib/types";
import BarcodeSvg from "@/components/BarcodeSvg";
import PillLoader from "@/components/PillLoader";

export default function BarcodePrintingPage() {
    const { data: medicines, loading } = useCollection<Medicine>("medicines");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [copies, setCopies] = useState(1);

    function toggle(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    const selectedMedicines = medicines.filter((m) => selected.has(m.id));
    const labels = selectedMedicines.flatMap((m) => Array.from({ length: copies }, (_, i) => ({ ...m, key: `${m.id}-${i}` })));

    if (loading) return <PillLoader label="Loading medicine catalog…" />;

    return (
        <>
            <div className="pageHead noPrint">
                <div>
                    <h1>Barcode Printing</h1>
                    <p>Select medicines, choose copies, then print a sheet of labels.</p>
                </div>
                <button className="primary" disabled={labels.length === 0} onClick={() => window.print()}>
                    <Printer size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Print {labels.length > 0 ? `(${labels.length})` : ""}
                </button>
            </div>

            <div className="card noPrint" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                        Copies per label
                        <input type="number" min={1} max={20} value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))} style={{ width: 60 }} />
                    </label>
                    <span className="muted">{selected.size} medicine{selected.size === 1 ? "" : "s"} selected</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                    {medicines.map((m) => (
                        <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, border: "1px solid var(--dg-border)", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}>
                            <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                            {m.name}
                        </label>
                    ))}
                </div>
            </div>

            <div className="card">
                {labels.length === 0 ? (
                    <div className="empty noPrint">
                        <strong>No labels selected</strong><br />Check off medicines above to preview their labels here.
                    </div>
                ) : (
                    <div className="labelSheet">
                        {labels.map((m) => (
                            <div className="barcodeLabel" key={m.key}>
                                <strong>{m.name}</strong>
                                <BarcodeSvg code={m.barcode} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
