"use client";

import { useMemo } from "react";
import { useCollection } from "@/lib/firestore-hooks";
import type { Batch, Medicine } from "@/lib/types";
import PillLoader from "@/components/PillLoader";

function daysUntil(dateStr: string) {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function ExpiryReportPage() {
    const { data: batches, loading } = useCollection<Batch>("batches");
    const { data: medicines } = useCollection<Medicine>("medicines");
    const medicineFor = (id: string) => medicines.find((m) => m.id === id)?.name || "Unknown medicine";

    const relevant = useMemo(() => {
        return batches
            .filter((b) => b.quantityRemaining > 0)
            .map((b) => ({ ...b, days: daysUntil(b.expiryDate) }))
            .filter((b) => b.days <= 90)
            .sort((a, b) => a.days - b.days);
    }, [batches]);

    const expiredCount = relevant.filter((b) => b.days < 0).length;
    const within30 = relevant.filter((b) => b.days >= 0 && b.days <= 30).length;
    const within90 = relevant.filter((b) => b.days > 30 && b.days <= 90).length;

    if (loading) return <PillLoader label="Loading expiry report…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Expiry Report</h1>
                    <p>Batches with stock that are already expired or expiring within 90 days.</p>
                </div>
            </div>

            <div className="summary">
                <div><span>{expiredCount}</span><strong>Expired</strong></div>
                <div><span>{within30}</span><strong>Within 30 days</strong></div>
                <div><span>{within90}</span><strong>31–90 days</strong></div>
            </div>

            <div className="card tableCard">
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Medicine</th>
                                <th>Batch No.</th>
                                <th>Expiry Date</th>
                                <th>Days Left</th>
                                <th>Units Remaining</th>
                            </tr>
                        </thead>
                        <tbody>
                            {relevant.length === 0 ? (
                                <tr><td colSpan={5}><div className="empty">✓<br /><strong>Nothing expiring soon</strong><br />All stocked batches are well within their expiry window.</div></td></tr>
                            ) : (
                                relevant.map((b) => (
                                    <tr key={b.id}>
                                        <td><b>{medicineFor(b.medicineId)}</b></td>
                                        <td>{b.batchNo}</td>
                                        <td>{b.expiryDate}</td>
                                        <td>
                                            <span className="low">{b.days < 0 ? "Expired" : `${b.days} days`}</span>
                                        </td>
                                        <td>{b.quantityRemaining}</td>
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
