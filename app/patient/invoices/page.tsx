"use client";

import { usePatientAuth } from "@/lib/hooks/usePatientAuth";
import { useCollection } from "@/lib/firestore-hooks";
import { getPatientInvoicesQuery } from "@/lib/firestore/patientPortal";
import { ConsultationInvoice } from "@/lib/types";
import { recordPayment } from "@/lib/firestore/doctorPortal";
import { CreditCard, Printer, CheckCircle } from "lucide-react";
import { useState } from "react";

export default function PatientInvoicesPage() {
    const { claims } = usePatientAuth();
    const patientId = claims?.patientId || "";

    const { data: invoices, loading } = useCollection<ConsultationInvoice>(
        "consultationInvoices",
        patientId ? getPatientInvoicesQuery(patientId) : [],
        [patientId]
    );

    const [payingId, setPayingId] = useState<string | null>(null);

    const handleSimulatedPayment = async (inv: ConsultationInvoice) => {
        setPayingId(inv.id);
        try {
            await recordPayment({
                invoiceId: inv.id,
                invoiceType: "Consultation",
                invoiceNo: inv.invoiceNo,
                patientId: inv.patientId,
                amount: inv.amount,
                method: "razorpay_sim",
                date: new Date().toISOString().slice(0, 10)
            });
            alert(`Payment of ₹${inv.amount.toLocaleString()} successful for ${inv.invoiceNo}!`);
        } catch (e: any) {
            alert("Payment failed: " + e.message);
        } finally {
            setPayingId(null);
        }
    };

    const handlePrintInvoice = (inv: ConsultationInvoice) => {
        const printWin = window.open("", "_blank");
        if (!printWin) return;
        printWin.document.write(`
            <html>
                <head>
                    <title>Invoice - ${inv.invoiceNo}</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; color: #1e293b; }
                        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #087f78; padding-bottom: 20px; }
                        .title { font-size: 24px; font-weight: bold; color: #087f78; }
                        .section { margin-top: 30px; }
                        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        .table th, .table td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
                        .table th { background: #f1f5f9; }
                        .total { text-align: right; margin-top: 20px; font-size: 18px; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <div class="title">DentiGO Dental Clinic</div>
                            <div>Patient Consultation Invoice</div>
                        </div>
                        <div style="text-align: right;">
                            <h3>${inv.invoiceNo}</h3>
                            <div>Date: ${inv.date}</div>
                        </div>
                    </div>
                    <div class="section">
                        <p><strong>Patient ID:</strong> ${inv.patientId}</p>
                        <p><strong>Status:</strong> ${inv.status.toUpperCase()}</p>
                    </div>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Description / Particulars</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${inv.items}</td>
                                <td>₹${inv.amount.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="total">Total Paid/Due: ₹${inv.amount.toLocaleString()}</div>
                    <script>window.onload = function() { window.print(); }</script>
                </body>
            </html>
        `);
        printWin.document.close();
    };

    if (loading) return <div style={{ padding: 20 }}>Loading your invoices...</div>;

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Invoices & Payments</h1>
            <p style={{ color: "#64748b", margin: "0 0 24px", fontSize: 14 }}>View consultation invoices, pay online, and download receipts.</p>

            {invoices.length === 0 ? (
                <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                    No invoices recorded.
                </div>
            ) : (
                <div style={{ display: "grid", gap: 16 }}>
                    {invoices.map((inv) => (
                        <div key={inv.id} style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{inv.invoiceNo}</span>
                                    <span style={{
                                        padding: "3px 10px",
                                        borderRadius: 20,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        background: inv.status === "Paid" ? "#dcfce7" : inv.status === "Pending" ? "#fef3c7" : "#fef2f2",
                                        color: inv.status === "Paid" ? "#166534" : inv.status === "Pending" ? "#92400e" : "#991b1b"
                                    }}>
                                        {inv.status}
                                    </span>
                                </div>
                                <div style={{ fontSize: 14, color: "#475569", marginTop: 6 }}>
                                    {inv.items}
                                </div>
                                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                                    Issued Date: {inv.date} | Due Date: {inv.dueDate}
                                </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
                                    ₹{inv.amount.toLocaleString()}
                                </div>
                                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                    {inv.status === "Pending" && (
                                        <button
                                            onClick={() => handleSimulatedPayment(inv)}
                                            disabled={payingId === inv.id}
                                            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#087f78", color: "#fff", border: 0, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                                        >
                                            <CreditCard size={15} /> {payingId === inv.id ? "Processing..." : "Pay Now"}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handlePrintInvoice(inv)}
                                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                                    >
                                        <Printer size={15} /> Receipt / PDF
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
