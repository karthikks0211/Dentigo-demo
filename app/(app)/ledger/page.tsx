"use client";

import { useMemo } from "react";
import { useCollection } from "@/lib/firestore-hooks";
import type { Patient, Payment } from "@/lib/types";
import PillLoader from "@/components/PillLoader";

export default function LedgerPage() {
    const { data: payments, loading } = useCollection<Payment>("payments");
    const { data: patients } = useCollection<Patient>("patients");
    const patientFor = (id: string) => patients.find((p) => p.id === id)?.name || "Unknown patient";

    const rows = useMemo(() => {
        const ascending = [...payments].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
        let balance = 0;
        return ascending.map((p) => {
            balance += p.amount;
            return { ...p, balance };
        }).reverse();
    }, [payments]);

    const byMethod = useMemo(() => {
        const map = { Cash: 0, Card: 0, razorpay_sim: 0 } as Record<string, number>;
        for (const p of payments) map[p.method] = (map[p.method] || 0) + p.amount;
        return map;
    }, [payments]);

    const total = payments.reduce((sum, p) => sum + p.amount, 0);

    if (loading) return <PillLoader label="Loading ledger…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Ledger</h1>
                    <p>Full running payment ledger across consultations and pharmacy sales.</p>
                </div>
            </div>

            <div className="summary">
                <div><span>₹{total.toLocaleString()}</span><strong>Total Collected</strong></div>
                <div><span>₹{(byMethod.Cash || 0).toLocaleString()}</span><strong>Cash</strong></div>
                <div><span>₹{(byMethod.Card || 0).toLocaleString()}</span><strong>Card</strong></div>
                <div><span>₹{(byMethod.razorpay_sim || 0).toLocaleString()}</span><strong>Razorpay</strong></div>
            </div>

            <div className="card tableCard">
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Invoice #</th>
                                <th>Patient</th>
                                <th>Method</th>
                                <th>Amount</th>
                                <th>Running Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty"><strong>No payments recorded yet</strong></div></td></tr>
                            ) : (
                                rows.map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.date}</td>
                                        <td><b>{p.invoiceNo}</b></td>
                                        <td>{patientFor(p.patientId)}</td>
                                        <td>{p.method === "razorpay_sim" ? "Razorpay" : p.method}</td>
                                        <td style={{ color: "#28936e" }}>+₹{p.amount.toLocaleString()}</td>
                                        <td><b>₹{p.balance.toLocaleString()}</b></td>
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
