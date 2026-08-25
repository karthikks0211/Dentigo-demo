"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { createPurchaseRequest } from "@/lib/procurement";
import type { Batch, Medicine, PurchaseRequest } from "@/lib/types";
import PillLoader from "@/components/PillLoader";

export default function LowStockReportPage() {
    const { data: batches, loading: loadingBatches } = useCollection<Batch>("batches");
    const { data: medicines, loading: loadingMedicines } = useCollection<Medicine>("medicines");
    const { data: requests, loading: loadingRequests } = useCollection<PurchaseRequest>("purchaseRequests");
    const { user } = useAuth();
    const showToast = useToast();
    const [busyId, setBusyId] = useState<string | null>(null);

    const rows = useMemo(() => {
        const remainingByMedicine = new Map<string, number>();
        for (const b of batches) remainingByMedicine.set(b.medicineId, (remainingByMedicine.get(b.medicineId) || 0) + b.quantityRemaining);

        return medicines
            .map((m) => ({ ...m, remaining: remainingByMedicine.get(m.id) || 0 }))
            .filter((m) => m.remaining <= m.reorderLevel)
            .sort((a, b) => a.remaining - b.remaining);
    }, [batches, medicines]);

    const requestedMedicineIds = useMemo(
        () => new Set(requests.filter((r) => r.status === "OPEN").map((r) => r.medicineId)),
        [requests]
    );

    async function raiseRequest(m: Medicine & { remaining: number }) {
        setBusyId(m.id);
        try {
            const suggestedQty = Math.max(m.reorderLevel * 2 - m.remaining, 1);
            await createPurchaseRequest({
                medicineId: m.id, name: m.name, requestedQty: suggestedQty,
                reason: `Stock (${m.remaining}) at or below reorder level (${m.reorderLevel}).`,
                currentStock: m.remaining, reorderLevel: m.reorderLevel, requestedBy: user?.email || "unknown"
            });
            showToast(`Purchase request raised for ${m.name}`);
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't raise request", "error");
        } finally {
            setBusyId(null);
        }
    }

    if (loadingBatches || loadingMedicines || loadingRequests) return <PillLoader label="Loading low stock report…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Low Stock Report</h1>
                    <p>Medicines at or below their reorder level, most critical first.</p>
                </div>
                <Link href="/procurement/purchase-requests" className="primary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                    <ClipboardCheck size={14} style={{ marginRight: 4 }} />Purchase Requests
                </Link>
            </div>

            <div className="card tableCard">
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Medicine</th>
                                <th>Category</th>
                                <th>Remaining</th>
                                <th>Reorder Level</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty">✓<br /><strong>Nothing low on stock</strong><br />Every medicine is above its reorder level.</div></td></tr>
                            ) : (
                                rows.map((m) => (
                                    <tr key={m.id}>
                                        <td><b>{m.name}</b></td>
                                        <td>{m.category}</td>
                                        <td><span className="low">{m.remaining} {m.unit}{m.remaining === 1 ? "" : "s"}</span></td>
                                        <td>{m.reorderLevel}</td>
                                        <td>
                                            <span className={`stockBadge ${m.remaining === 0 ? "outofstock" : "lowstock"}`}>
                                                {m.remaining === 0 ? "Out of stock" : "Low stock"}
                                            </span>
                                        </td>
                                        <td>
                                            {requestedMedicineIds.has(m.id) ? (
                                                <small style={{ color: "#829295" }}>Already requested</small>
                                            ) : (
                                                <button className="quickDemoBtn" style={{ margin: 0 }} disabled={busyId === m.id} onClick={() => raiseRequest(m)}>
                                                    {busyId === m.id ? "Raising…" : "Raise Request"}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
