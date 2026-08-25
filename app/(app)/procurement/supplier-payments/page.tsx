"use client";

import { useMemo, useState } from "react";
import { Banknote, Landmark, ScrollText, Smartphone } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { recordSupplierPayment } from "@/lib/invoices";
import type { Supplier, SupplierInvoice, SupplierPayment, SupplierPaymentMethod } from "@/lib/types";
import Drawer from "@/components/ui/Drawer";
import PillLoader from "@/components/PillLoader";
import PaymentSuccessOverlay from "@/components/PaymentSuccessOverlay";

export default function SupplierPaymentsPage() {
    const { data: invoices, loading: l1 } = useCollection<SupplierInvoice>("supplierInvoices");
    const { data: payments, loading: l2 } = useCollection<SupplierPayment>("supplierPayments");
    const { data: suppliers, loading: l3 } = useCollection<Supplier>("suppliers");
    const showToast = useToast();

    const supplierFor = (id: string) => suppliers.find((s) => s.id === id)?.name || "Unknown supplier";

    const [target, setTarget] = useState<SupplierInvoice | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [paidInfo, setPaidInfo] = useState<{ amount: number; method: SupplierPaymentMethod } | null>(null);

    const outstanding = useMemo(
        () => [...invoices].filter((i) => i.status !== "Paid" && i.status !== "Cancelled").sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)),
        [invoices]
    );

    const history = useMemo(() => [...payments].sort((a, b) => b.createdAt - a.createdAt), [payments]);

    async function submitPayment(method: SupplierPaymentMethod) {
        if (!target) return;
        setSubmitting(true);
        try {
            await recordSupplierPayment({
                invoiceId: target.id, invoiceNo: target.invoiceNo, supplierId: target.supplierId,
                amount: target.amount, method
            });
            showToast(`₹${target.amount.toLocaleString()} paid against ${target.invoiceNo}`);
            setPaidInfo({ amount: target.amount, method });
            setTarget(null);
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't record payment", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (l1 || l2 || l3) return <PillLoader label="Loading supplier payments…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Supplier Payments</h1>
                    <p>Settle outstanding supplier invoices — feeds straight into the Ledger.</p>
                </div>
            </div>

            <div className="card tableCard" style={{ marginBottom: 20 }}>
                <div className="cardHead" style={{ padding: "16px 20px 0" }}><h3>Outstanding Invoices</h3></div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Supplier</th>
                                <th>Amount</th>
                                <th>Due Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {outstanding.length === 0 ? (
                                <tr><td colSpan={5}><div className="empty">✓<br /><strong>Nothing outstanding</strong><br />Every supplier invoice has been paid.</div></td></tr>
                            ) : (
                                outstanding.map((inv) => (
                                    <tr key={inv.id}>
                                        <td><b>{inv.invoiceNo}</b></td>
                                        <td>{supplierFor(inv.supplierId)}</td>
                                        <td>₹{inv.amount.toLocaleString()}</td>
                                        <td>{inv.dueDate}</td>
                                        <td>
                                            <button className="quickDemoBtn" style={{ margin: 0 }} onClick={() => setTarget(inv)}>Record Payment</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card tableCard">
                <div className="cardHead" style={{ padding: "16px 20px 0" }}><h3>Payment History</h3></div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Supplier</th>
                                <th>Amount</th>
                                <th>Method</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr><td colSpan={5}><div className="empty"><strong>No supplier payments recorded yet</strong></div></td></tr>
                            ) : (
                                history.map((p) => (
                                    <tr key={p.id}>
                                        <td><b>{p.invoiceNo}</b></td>
                                        <td>{supplierFor(p.supplierId)}</td>
                                        <td>₹{p.amount.toLocaleString()}</td>
                                        <td>{p.method}</td>
                                        <td>{p.date}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {target && (
                <Drawer
                    title="Record Supplier Payment"
                    subtitle={`${target.invoiceNo} · ₹${target.amount.toLocaleString()}`}
                    onClose={() => setTarget(null)}
                    footer={<button type="button" onClick={() => setTarget(null)} style={{ width: "100%" }}>Cancel</button>}
                >
                    <div style={{ display: "grid", gap: 10 }}>
                        <button className="pickCard" disabled={submitting} onClick={() => submitPayment("Bank Transfer")} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Landmark size={18} /> Bank Transfer
                        </button>
                        <button className="pickCard" disabled={submitting} onClick={() => submitPayment("UPI")} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Smartphone size={18} /> UPI
                        </button>
                        <button className="pickCard" disabled={submitting} onClick={() => submitPayment("Cheque")} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <ScrollText size={18} /> Cheque
                        </button>
                        <button className="pickCard" disabled={submitting} onClick={() => submitPayment("Cash")} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Banknote size={18} /> Cash
                        </button>
                    </div>
                </Drawer>
            )}

            {paidInfo && (
                <PaymentSuccessOverlay
                    amount={paidInfo.amount}
                    label={`Paid via ${paidInfo.method}`}
                    onDone={() => setPaidInfo(null)}
                />
            )}
        </>
    );
}
