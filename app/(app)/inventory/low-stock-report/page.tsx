"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import type { Batch, Medicine } from "@/lib/types";
import PillLoader from "@/components/PillLoader";

export default function LowStockReportPage() {
    const { data: batches, loading: loadingBatches } = useCollection<Batch>("batches");
    const { data: medicines, loading: loadingMedicines } = useCollection<Medicine>("medicines");

    const rows = useMemo(() => {
        const remainingByMedicine = new Map<string, number>();
        for (const b of batches) remainingByMedicine.set(b.medicineId, (remainingByMedicine.get(b.medicineId) || 0) + b.quantityRemaining);

        return medicines
            .map((m) => ({ ...m, remaining: remainingByMedicine.get(m.id) || 0 }))
            .filter((m) => m.remaining <= m.reorderLevel)
            .sort((a, b) => a.remaining - b.remaining);
    }, [batches, medicines]);

    if (loadingBatches || loadingMedicines) return <PillLoader label="Loading low stock report…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Low Stock Report</h1>
                    <p>Medicines at or below their reorder level, most critical first.</p>
                </div>
                <Link href="/inventory/purchase-orders" className="primary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                    <FilePlus2 size={14} style={{ marginRight: 4 }} />New Purchase Order
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
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={5}><div className="empty">✓<br /><strong>Nothing low on stock</strong><br />Every medicine is above its reorder level.</div></td></tr>
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
