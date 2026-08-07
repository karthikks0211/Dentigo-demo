"use client";

import { useMemo, useState } from "react";
import { Banknote, CreditCard, Sparkles } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { recordPayment } from "@/lib/invoices";
import type { ConsultationInvoice, Patient, Payment, PaymentInvoiceType, PharmacyInvoice } from "@/lib/types";
import Drawer from "@/components/ui/Drawer";
import PaymentSimModal from "@/components/PaymentSimModal";
import PillLoader from "@/components/PillLoader";

type Outstanding = {
    invoiceId: string;
    invoiceType: PaymentInvoiceType;
    invoiceNo: string;
    patientId: string;
    amount: number;
    date: string;
};

export default function PaymentsPage() {
    const { data: consultations, loading: l1 } = useCollection<ConsultationInvoice>("consultationInvoices");
    const { data: pharmacy, loading: l2 } = useCollection<PharmacyInvoice>("pharmacyInvoices");
    const { data: payments, loading: l3 } = useCollection<Payment>("payments");
    const { data: patients } = useCollection<Patient>("patients");
    const showToast = useToast();

    const patientFor = (id: string) => patients.find((p) => p.id === id)?.name || "Unknown patient";

    const [target, setTarget] = useState<Outstanding | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showRazorpay, setShowRazorpay] = useState(false);

    const paidPharmacyInvoiceIds = useMemo(
        () => new Set(payments.filter((p) => p.invoiceType === "Pharmacy").map((p) => p.invoiceId)),
        [payments]
    );

    const outstanding: Outstanding[] = useMemo(() => {
        const fromConsultation: Outstanding[] = consultations
            .filter((i) => i.status !== "Paid" && i.status !== "Cancelled")
            .map((i) => ({ invoiceId: i.id, invoiceType: "Consultation", invoiceNo: i.invoiceNo, patientId: i.patientId, amount: i.amount, date: i.date }));
        const fromPharmacy: Outstanding[] = pharmacy
            .filter((i) => !paidPharmacyInvoiceIds.has(i.id))
            .map((i) => ({ invoiceId: i.id, invoiceType: "Pharmacy", invoiceNo: i.invoiceNo, patientId: i.patientId, amount: i.totalAmount, date: i.date }));
        return [...fromConsultation, ...fromPharmacy].sort((a, b) => (a.date < b.date ? 1 : -1));
    }, [consultations, pharmacy, paidPharmacyInvoiceIds]);

    const history = useMemo(() => [...payments].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)), [payments]);

    async function submitPayment(method: "Cash" | "Card" | "razorpay_sim") {
        if (!target) return;
        setSubmitting(true);
        try {
            await recordPayment({
                invoiceId: target.invoiceId, invoiceType: target.invoiceType, invoiceNo: target.invoiceNo,
                patientId: target.patientId, amount: target.amount, method
            });
            showToast(`₹${target.amount.toLocaleString()} recorded against ${target.invoiceNo}`);
            setTarget(null);
            setShowRazorpay(false);
        } catch {
            showToast("Couldn't record payment", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (l1 || l2 || l3) return <PillLoader label="Loading payments…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Payments</h1>
                    <p>Record cash, card, and online payments against outstanding invoices.</p>
                </div>
            </div>

            <div className="card tableCard" style={{ marginBottom: 20 }}>
                <div className="cardHead" style={{ padding: "16px 20px 0" }}><h3>Outstanding Invoices</h3></div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Type</th>
                                <th>Patient</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {outstanding.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty">✓<br /><strong>Nothing outstanding</strong><br />Every invoice has been paid.</div></td></tr>
                            ) : (
                                outstanding.map((o) => (
                                    <tr key={`${o.invoiceType}-${o.invoiceId}`}>
                                        <td><b>{o.invoiceNo}</b></td>
                                        <td><span className={`badge ${o.invoiceType === "Pharmacy" ? "teal" : "confirmed"}`}><i />{o.invoiceType}</span></td>
                                        <td>{patientFor(o.patientId)}</td>
                                        <td>₹{o.amount.toLocaleString()}</td>
                                        <td>{o.date}</td>
                                        <td>
                                            <button className="quickDemoBtn" style={{ margin: 0 }} onClick={() => setTarget(o)}>Record Payment</button>
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
                                <th>Patient</th>
                                <th>Amount</th>
                                <th>Method</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr><td colSpan={5}><div className="empty"><strong>No payments recorded yet</strong></div></td></tr>
                            ) : (
                                history.map((p) => (
                                    <tr key={p.id}>
                                        <td><b>{p.invoiceNo}</b></td>
                                        <td>{patientFor(p.patientId)}</td>
                                        <td>₹{p.amount.toLocaleString()}</td>
                                        <td>{p.method === "razorpay_sim" ? "Razorpay" : p.method}</td>
                                        <td>{p.date}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {target && !showRazorpay && (
                <Drawer
                    title="Record Payment"
                    subtitle={`${target.invoiceNo} · ₹${target.amount.toLocaleString()}`}
                    onClose={() => setTarget(null)}
                    footer={<button type="button" onClick={() => setTarget(null)} style={{ width: "100%" }}>Cancel</button>}
                >
                    <div style={{ display: "grid", gap: 10 }}>
                        <button className="pickCard" disabled={submitting} onClick={() => submitPayment("Cash")} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Banknote size={18} /> Cash
                        </button>
                        <button className="pickCard" disabled={submitting} onClick={() => submitPayment("Card")} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <CreditCard size={18} /> Card (POS)
                        </button>
                        <button className="pickCard" disabled={submitting} onClick={() => setShowRazorpay(true)} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Sparkles size={18} /> Pay via Razorpay
                        </button>
                    </div>
                </Drawer>
            )}

            {target && showRazorpay && (
                <PaymentSimModal
                    amount={target.amount}
                    invoiceNo={target.invoiceNo}
                    onClose={() => setShowRazorpay(false)}
                    onSuccess={() => submitPayment("razorpay_sim")}
                />
            )}
        </>
    );
}
