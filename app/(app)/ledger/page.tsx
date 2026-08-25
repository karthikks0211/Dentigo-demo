"use client";

import { useMemo } from "react";
import { useCollection } from "@/lib/firestore-hooks";
import type { Patient, Payment, Supplier, SupplierPayment, PayrollPayment } from "@/lib/types";
import PillLoader from "@/components/PillLoader";

type LedgerRow = {
    id: string;
    date: string;
    createdAt: number;
    invoiceNo: string;
    party: string;
    method: string;
    amount: number; // signed: +inflow, -outflow
};

export default function LedgerPage() {
    const { data: payments, loading: l1 } = useCollection<Payment>("payments");
    const { data: supplierPayments, loading: l2 } = useCollection<SupplierPayment>("supplierPayments");
    const { data: patients, loading: l3 } = useCollection<Patient>("patients");
    const { data: suppliers, loading: l4 } = useCollection<Supplier>("suppliers");
    const { data: payrollPayments, loading: l6 } = useCollection<PayrollPayment>("payrollPayments");
    const patientFor = (id: string) => patients.find((p) => p.id === id)?.name || "Unknown patient";
    const supplierFor = (id: string) => suppliers.find((s) => s.id === id)?.name || "Unknown supplier";

    const rows = useMemo(() => {
        // Every patient-facing payment — whether recorded from the clinic's
        // Invoices flow or settled in one shot at POS — lands in `payments`,
        // so this single source already covers both.
        const inflows: LedgerRow[] = payments.map((p) => ({
            id: p.id, date: p.date, createdAt: p.createdAt, invoiceNo: p.invoiceNo,
            party: patientFor(p.patientId), method: p.method === "razorpay_sim" ? "Razorpay" : p.method, amount: p.amount
        }));
        const outflows: LedgerRow[] = [
            ...supplierPayments.map((p) => ({
                id: p.id, date: p.date, createdAt: p.createdAt, invoiceNo: p.invoiceNo,
                party: supplierFor(p.supplierId), method: p.method, amount: -p.amount
            })),
            ...payrollPayments.map((p) => ({
                id: p.id, date: p.date, createdAt: p.createdAt, invoiceNo: `Payroll ${p.periodLabel}`,
                party: "Staff Payroll", method: p.method, amount: -p.amount
            }))
        ];

        const ascending = [...inflows, ...outflows].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
        let balance = 0;
        return ascending.map((r) => {
            balance += r.amount;
            return { ...r, balance };
        }).reverse();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payments, supplierPayments, patients, suppliers, payrollPayments]);

    const byMethod = useMemo(() => {
        const map = { Cash: 0, Card: 0, razorpay_sim: 0 } as Record<string, number>;
        for (const p of payments) map[p.method] = (map[p.method] || 0) + p.amount;
        return map;
    }, [payments]);

    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalPaidOut = supplierPayments.reduce((sum, p) => sum + p.amount, 0) + payrollPayments.reduce((sum, p) => sum + p.amount, 0);
    const netBalance = totalCollected - totalPaidOut;

    if (l1 || l2 || l3 || l4 || l6) return <PillLoader label="Loading ledger…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Ledger</h1>
                    <p>Full running ledger — patient payments in (from Invoices or POS), supplier and payroll payments out.</p>
                </div>
            </div>

            <div className="summary">
                <div><span>₹{netBalance.toLocaleString()}</span><strong>Net Balance</strong></div>
                <div><span>₹{totalCollected.toLocaleString()}</span><strong>Total Collected</strong></div>
                <div><span>₹{totalPaidOut.toLocaleString()}</span><strong>Paid to Suppliers &amp; Staff</strong></div>
                <div><span>₹{(byMethod.Cash || 0).toLocaleString()}</span><strong>Cash In</strong></div>
                <div><span>₹{(byMethod.Card || 0).toLocaleString()}</span><strong>Card In</strong></div>
            </div>

            <div className="card tableCard">
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Invoice #</th>
                                <th>Party</th>
                                <th>Method</th>
                                <th>Amount</th>
                                <th>Running Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty"><strong>No ledger entries yet</strong></div></td></tr>
                            ) : (
                                rows.map((r) => (
                                    <tr key={r.id}>
                                        <td>{r.date}</td>
                                        <td><b>{r.invoiceNo}</b></td>
                                        <td>{r.party}</td>
                                        <td>{r.method}</td>
                                        <td style={{ color: r.amount >= 0 ? "#28936e" : "#d75554" }}>
                                            {r.amount >= 0 ? "+" : "-"}₹{Math.abs(r.amount).toLocaleString()}
                                        </td>
                                        <td><b>₹{r.balance.toLocaleString()}</b></td>
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
