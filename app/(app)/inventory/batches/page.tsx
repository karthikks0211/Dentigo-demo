"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import type { Batch, Medicine, Supplier } from "@/lib/types";
import PillLoader from "@/components/PillLoader";

function daysUntil(dateStr: string) {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function BatchesPage() {
    const { data: batches, loading } = useCollection<Batch>("batches");
    const { data: medicines } = useCollection<Medicine>("medicines");
    const { data: suppliers } = useCollection<Supplier>("suppliers");
    const [query, setQuery] = useState("");

    const medicineFor = (id: string) => medicines.find((m) => m.id === id)?.name || "Unknown medicine";
    const supplierFor = (id: string) => suppliers.find((s) => s.id === id)?.name || "—";

    const sorted = useMemo(
        () => [...batches].sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1)),
        [batches]
    );

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return sorted.filter((b) =>
            medicineFor(b.medicineId).toLowerCase().includes(q) || b.batchNo.toLowerCase().includes(q)
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sorted, query, medicines]);

    if (loading) return <PillLoader label="Loading batches…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Batches</h1>
                    <p>Every batch in stock, sorted by soonest expiry first — the order FEFO dispenses in.</p>
                </div>
            </div>

            <div className="card tableCard">
                <div className="tableTools">
                    <div className="search">
                        <Search size={15} className="searchIcon" />
                        <input placeholder="Search batches…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Medicine</th>
                                <th>Batch No.</th>
                                <th>Expiry</th>
                                <th>Remaining / Received</th>
                                <th>Unit Cost / MRP</th>
                                <th>Supplier</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty">⌕<br /><strong>No batches found</strong></div></td></tr>
                            ) : (
                                filtered.map((b) => {
                                    const days = daysUntil(b.expiryDate);
                                    const expired = days < 0;
                                    const soon = days >= 0 && days <= 30;
                                    return (
                                        <tr key={b.id}>
                                            <td><b>{medicineFor(b.medicineId)}</b></td>
                                            <td>{b.batchNo}</td>
                                            <td>
                                                <span className={expired || soon ? "low" : ""}>{b.expiryDate}</span>
                                                {(expired || soon) && (
                                                    <small style={{ display: "block", color: expired ? "#dc2626" : "#c2410c" }}>
                                                        {expired ? "Expired" : `${days} day${days === 1 ? "" : "s"} left`}
                                                    </small>
                                                )}
                                            </td>
                                            <td>
                                                <span className={b.quantityRemaining === 0 ? "low" : ""}>{b.quantityRemaining}</span>
                                                <small style={{ display: "block" }}>of {b.quantityReceived}</small>
                                            </td>
                                            <td>₹{b.unitCost} / ₹{b.mrp}</td>
                                            <td>{supplierFor(b.supplierId)}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
