"use client";

import { useMemo, useState } from "react";
import { Search, Pill, ClipboardCheck, ClipboardList, ArrowLeftRight } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import type { Medicine, PurchaseOrder, PurchaseRequest, StockTransaction } from "@/lib/types";
import PillLoader from "@/components/PillLoader";

type TimelineEntry = {
    id: string;
    at: number;
    icon: typeof Pill;
    label: string;
    detail: string;
};

export default function MedicineAuditLogPage() {
    const { data: medicines, loading: l1 } = useCollection<Medicine>("medicines");
    const { data: requests, loading: l2 } = useCollection<PurchaseRequest>("purchaseRequests");
    const { data: orders, loading: l3 } = useCollection<PurchaseOrder>("purchaseOrders");
    const { data: transactions, loading: l4 } = useCollection<StockTransaction>("stockTransactions");

    const [query, setQuery] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const sorted = [...medicines].sort((a, b) => a.name.localeCompare(b.name));
        if (!q) return sorted;
        return sorted.filter((m) => m.name.toLowerCase().includes(q) || m.genericName?.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
    }, [medicines, query]);

    const selected = useMemo(() => medicines.find((m) => m.id === selectedId) || null, [medicines, selectedId]);

    // Merges three independent collections into one date-sorted story for a
    // single medicine — no new writes, this is a pure read/join over data
    // procurement and dispensing already produce.
    const timeline = useMemo(() => {
        if (!selected) return [];
        const entries: TimelineEntry[] = [];

        requests.filter((r) => r.medicineId === selected.id).forEach((r) => {
            entries.push({
                id: `req-${r.id}`,
                at: r.createdAt,
                icon: ClipboardCheck,
                label: `Purchase request ${r.requestNo} — ${r.status}`,
                detail: `Requested ${r.requestedQty} units · ${r.reason} · stock was ${r.currentStockAtRequest} (reorder level ${r.reorderLevelAtRequest}) · by ${r.requestedBy}`
            });
        });

        orders.filter((po) => po.lines.some((l) => l.medicineId === selected.id)).forEach((po) => {
            po.history.forEach((h, i) => {
                entries.push({
                    id: `po-${po.id}-${i}`,
                    at: h.at,
                    icon: ClipboardList,
                    label: `${po.poNumber} — ${h.action}`,
                    detail: `${h.note ? `${h.note} · ` : ""}by ${h.byEmail}`
                });
            });
        });

        transactions.filter((t) => t.medicineId === selected.id).forEach((t) => {
            entries.push({
                id: `st-${t.id}`,
                at: t.createdAt,
                icon: ArrowLeftRight,
                label: `${t.type} — ${t.qty > 0 ? "+" : ""}${t.qty} units`,
                detail: `${t.date}${t.refId ? ` · ref ${t.refId}` : ""}`
            });
        });

        return entries.sort((a, b) => b.at - a.at);
    }, [selected, requests, orders, transactions]);

    if (l1 || l2 || l3 || l4) return <PillLoader label="Loading audit log…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Medicine Audit Log</h1>
                    <p>Pick a medicine to see its full history — purchase requests, orders, receipts, dispenses, and returns.</p>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
                <div className="card tableCard">
                    <div className="tableTools" style={{ padding: "16px 20px 0" }}>
                        <div className="search">
                            <Search size={15} className="searchIcon" />
                            <input placeholder="Search medicines…" value={query} onChange={(e) => setQuery(e.target.value)} />
                        </div>
                    </div>
                    <div className="tableWrap" style={{ maxHeight: 560, overflowY: "auto" }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Medicine</th>
                                    <th>Category</th>
                                    <th>Unit</th>
                                    <th>Reorder Level</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={4}><div className="empty">⌕<br /><strong>No medicines found</strong></div></td></tr>
                                ) : (
                                    filtered.map((m) => (
                                        <tr
                                            key={m.id}
                                            onClick={() => setSelectedId(m.id)}
                                            style={{ cursor: "pointer", background: selectedId === m.id ? "var(--dg-teal-50)" : undefined }}
                                        >
                                            <td><b>{m.name}</b>{m.genericName && <small>{m.genericName}</small>}</td>
                                            <td>{m.category}</td>
                                            <td>{m.unit}</td>
                                            <td>{m.reorderLevel}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card" style={{ padding: 18, position: "sticky", top: 20 }}>
                    {!selected ? (
                        <div className="empty" style={{ padding: "30px 0" }}>Select a medicine<br /><small>Its full history will show here</small></div>
                    ) : (
                        <>
                            <div style={{ marginBottom: 14 }}>
                                <strong style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 5 }}>
                                    <Pill size={14} />{selected.name}
                                </strong>
                                <div className="muted" style={{ fontSize: 12 }}>{selected.category} · {selected.unit} · reorder at {selected.reorderLevel}</div>
                            </div>

                            {timeline.length === 0 ? (
                                <div className="empty" style={{ padding: "20px 0" }}>No history recorded yet for this medicine.</div>
                            ) : (
                                <div style={{ display: "grid", gap: 10, maxHeight: 460, overflowY: "auto" }}>
                                    {timeline.map((e) => {
                                        const Icon = e.icon;
                                        return (
                                            <div key={e.id} className="card" style={{ padding: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
                                                <span style={{ color: "var(--dg-teal-600)", marginTop: 2 }}><Icon size={15} /></span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <strong style={{ fontSize: 13, display: "block" }}>{e.label}</strong>
                                                    <span style={{ fontSize: 12, color: "var(--dg-muted)" }}>{e.detail}</span>
                                                    <small className="muted" style={{ display: "block", marginTop: 2 }}>{new Date(e.at).toLocaleString()}</small>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
