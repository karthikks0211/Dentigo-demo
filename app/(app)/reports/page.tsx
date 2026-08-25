"use client";

import { useMemo } from "react";
import { useCollection } from "@/lib/firestore-hooks";
import type {
    Appointment, Batch, ConsultationInvoice, Doctor, Payment,
    PurchaseOrder, PurchaseOrderStatus, SupplierInvoice, SupplierPayment
} from "@/lib/types";
import PillLoader from "@/components/PillLoader";

const PO_STATUS_ORDER: PurchaseOrderStatus[] = [
    "DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED", "REJECTED", "CANCELLED"
];

export default function ReportsPage() {
    const { data: payments, loading: l1 } = useCollection<Payment>("payments");
    const { data: consultations, loading: l2 } = useCollection<ConsultationInvoice>("consultationInvoices");
    const { data: appointments, loading: l3 } = useCollection<Appointment>("appointments");
    const { data: doctors, loading: l4 } = useCollection<Doctor>("doctors");
    const { data: batches, loading: l5 } = useCollection<Batch>("batches");
    const { data: purchaseOrders, loading: l6 } = useCollection<PurchaseOrder>("purchaseOrders");
    const { data: supplierInvoices, loading: l7 } = useCollection<SupplierInvoice>("supplierInvoices");
    const { data: supplierPayments, loading: l8 } = useCollection<SupplierPayment>("supplierPayments");

    const consultationRevenue = payments.filter((p) => p.invoiceType === "Consultation").reduce((s, p) => s + p.amount, 0);
    const pharmacyRevenue = payments.filter((p) => p.invoiceType === "Pharmacy").reduce((s, p) => s + p.amount, 0);
    const totalRevenue = consultationRevenue + pharmacyRevenue;
    const inventoryValuation = batches.reduce((s, b) => s + b.quantityRemaining * b.unitCost, 0);

    const procurementSpend = supplierPayments.reduce((s, p) => s + p.amount, 0);
    const payablesOutstanding = supplierInvoices
        .filter((i) => i.status !== "Paid" && i.status !== "Cancelled")
        .reduce((s, i) => s + i.amount, 0);

    const poByStatus = useMemo(() => {
        const counts = new Map<PurchaseOrderStatus, { count: number; value: number }>();
        for (const po of purchaseOrders) {
            const value = po.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
            const current = counts.get(po.status) || { count: 0, value: 0 };
            counts.set(po.status, { count: current.count + 1, value: current.value + value });
        }
        return PO_STATUS_ORDER.map((status) => ({ status, ...(counts.get(status) || { count: 0, value: 0 }) })).filter((r) => r.count > 0);
    }, [purchaseOrders]);

    const doctorRevenue = useMemo(() => {
        const appointmentToDoctor = new Map(appointments.map((a) => [a.id, a.doctorId]));
        const totals = new Map<string, number>();
        const paidInvoiceIds = new Set(
            payments.filter((p) => p.invoiceType === "Consultation").map((p) => p.invoiceId)
        );
        for (const inv of consultations) {
            if (!paidInvoiceIds.has(inv.id)) continue;
            const doctorId = appointmentToDoctor.get(inv.appointmentId);
            if (!doctorId) continue;
            totals.set(doctorId, (totals.get(doctorId) || 0) + inv.amount);
        }
        return doctors
            .map((d) => ({ ...d, revenue: totals.get(d.id) || 0 }))
            .sort((a, b) => b.revenue - a.revenue);
    }, [appointments, consultations, payments, doctors]);

    if (l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8) return <PillLoader label="Loading reports…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Reports</h1>
                    <p>Revenue and doctor-wise performance, plus inventory valuation and procurement spend.</p>
                </div>
            </div>

            <div className="stats">
                <div className="stat heroStat">
                    <div className="statTop"><p>Total Revenue</p></div>
                    <h2>₹{totalRevenue.toLocaleString()}</h2>
                    <div className="statBottom"><small className="statSubtitle">all recorded payments</small></div>
                </div>
                <div className="stat">
                    <div className="statTop"><p>Consultation Revenue</p></div>
                    <h2>₹{consultationRevenue.toLocaleString()}</h2>
                </div>
                <div className="stat">
                    <div className="statTop"><p>Pharmacy Revenue</p></div>
                    <h2>₹{pharmacyRevenue.toLocaleString()}</h2>
                </div>
                <div className="stat">
                    <div className="statTop"><p>Inventory Valuation</p></div>
                    <h2>₹{inventoryValuation.toLocaleString()}</h2>
                    <div className="statBottom"><small className="statSubtitle">stock on hand, at cost</small></div>
                </div>
                <div className="stat">
                    <div className="statTop"><p>Procurement Spend</p></div>
                    <h2>₹{procurementSpend.toLocaleString()}</h2>
                    <div className="statBottom"><small className="statSubtitle">paid to suppliers</small></div>
                </div>
                <div className="stat">
                    <div className="statTop"><p>Payables Outstanding</p></div>
                    <h2>₹{payablesOutstanding.toLocaleString()}</h2>
                    <div className="statBottom"><small className="statSubtitle">supplier invoices unpaid</small></div>
                </div>
            </div>

            <div className="card tableCard" style={{ marginBottom: 20 }}>
                <div className="cardHead" style={{ padding: "16px 20px 0" }}>
                    <h3>Purchase Orders by Status</h3>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Count</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {poByStatus.length === 0 ? (
                                <tr><td colSpan={3}><div className="empty"><strong>No purchase orders yet</strong></div></td></tr>
                            ) : (
                                poByStatus.map((r) => (
                                    <tr key={r.status}>
                                        <td><b>{r.status.replace(/_/g, " ")}</b></td>
                                        <td>{r.count}</td>
                                        <td>₹{r.value.toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card tableCard">
                <div className="cardHead" style={{ padding: "16px 20px 0" }}>
                    <h3>Doctor-wise Revenue</h3>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Doctor</th>
                                <th>Specialty</th>
                                <th>Paid Consultation Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {doctorRevenue.length === 0 ? (
                                <tr><td colSpan={3}><div className="empty"><strong>No revenue recorded yet</strong></div></td></tr>
                            ) : (
                                doctorRevenue.map((d) => (
                                    <tr key={d.id}>
                                        <td><b>{d.name}</b></td>
                                        <td>{d.specialty}</td>
                                        <td><b>₹{d.revenue.toLocaleString()}</b></td>
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
