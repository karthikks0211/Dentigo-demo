"use client";

import { FormEvent, useMemo, useState } from "react";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { generateConsultationInvoice } from "@/lib/invoices";
import { consultationToPreview } from "@/lib/invoice-preview";
import type { Appointment, ConsultationInvoice, Doctor, Patient } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Drawer from "@/components/ui/Drawer";
import InvoicePreviewModal from "@/components/InvoicePreviewModal";
import PillLoader from "@/components/PillLoader";

function defaultDueDate() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
}

export default function CreateInvoicePage() {
    const { data: appointments, loading: loadingA } = useCollection<Appointment>("appointments");
    const { data: invoices, loading: loadingI } = useCollection<ConsultationInvoice>("consultationInvoices");
    const { data: patients } = useCollection<Patient>("patients");
    const { data: doctors } = useCollection<Doctor>("doctors");
    const showToast = useToast();

    const [target, setTarget] = useState<Appointment | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [previewInvoice, setPreviewInvoice] = useState<ConsultationInvoice | null>(null);

    const patientFor = (id: string) => patients.find((p) => p.id === id)?.name || "Unknown patient";
    const doctorFor = (id: string) => doctors.find((d) => d.id === id)?.name || "Unassigned";

    const invoicedAppointmentIds = useMemo(() => new Set(invoices.map((i) => i.appointmentId)), [invoices]);
    const invoiceable = useMemo(
        () => appointments
            .filter((a) => a.status !== "Cancelled" && !invoicedAppointmentIds.has(a.id))
            .sort((a, b) => (a.date < b.date ? 1 : -1)),
        [appointments, invoicedAppointmentIds]
    );

    const recent = useMemo(() => [...invoices].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8), [invoices]);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!target) return;
        const f = new FormData(e.currentTarget);
        const items = String(f.get("items") || "").trim();
        const amount = Number(f.get("amount")) || 0;
        const dueDate = String(f.get("dueDate") || defaultDueDate());

        if (!items || amount <= 0) {
            showToast("Enter the billed items and a valid amount", "error");
            return;
        }

        setSubmitting(true);
        try {
            const invoiceNo = await generateConsultationInvoice({
                patientId: target.patientId, appointmentId: target.id, items, amount, dueDate
            });
            showToast(`Invoice ${invoiceNo} generated for ${patientFor(target.patientId)}`);
            setTarget(null);
        } catch {
            showToast("Couldn't generate invoice", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (loadingA || loadingI) return <PillLoader label="Loading appointments…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Create Invoice</h1>
                    <p>Generate a consultation invoice from any appointment that hasn&rsquo;t been billed yet.</p>
                </div>
            </div>

            <div className="card tableCard" style={{ marginBottom: 20 }}>
                <div className="cardHead" style={{ padding: "16px 20px 0" }}>
                    <h3>Appointments awaiting invoice</h3>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Patient</th>
                                <th>Date &amp; Time</th>
                                <th>Treatment</th>
                                <th>Doctor</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoiceable.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty">✓<br /><strong>All caught up</strong><br />Every appointment already has an invoice.</div></td></tr>
                            ) : (
                                invoiceable.map((a) => (
                                    <tr key={a.id}>
                                        <td><b>{patientFor(a.patientId)}</b></td>
                                        <td><b>{a.date}</b><small>{a.time}</small></td>
                                        <td>{a.treatment}</td>
                                        <td>{doctorFor(a.doctorId)}</td>
                                        <td><Badge status={a.status} /></td>
                                        <td>
                                            <button className="quickDemoBtn" style={{ margin: 0 }} onClick={() => setTarget(a)}>Generate Invoice</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card tableCard">
                <div className="cardHead" style={{ padding: "16px 20px 0" }}>
                    <h3>Recently generated</h3>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Patient</th>
                                <th>Items</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recent.length === 0 ? (
                                <tr><td colSpan={5}><div className="empty"><strong>No invoices yet</strong></div></td></tr>
                            ) : (
                                recent.map((inv) => (
                                    <tr key={inv.id}>
                                        <td><button className="invoiceNoLink" onClick={() => setPreviewInvoice(inv)}>{inv.invoiceNo}</button></td>
                                        <td>{patientFor(inv.patientId)}</td>
                                        <td>{inv.items}</td>
                                        <td>₹{inv.amount.toLocaleString()}</td>
                                        <td><Badge status={inv.status} /></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {target && (
                <Drawer
                    title="Generate Consultation Invoice"
                    subtitle={`${patientFor(target.patientId)} · ${target.treatment}`}
                    onClose={() => setTarget(null)}
                    footer={<>
                        <button type="button" onClick={() => setTarget(null)}>Cancel</button>
                        <button type="submit" form="invoice-form" className="primary" disabled={submitting}>
                            {submitting ? "Generating…" : "Generate Invoice"}
                        </button>
                    </>}
                >
                    <form id="invoice-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 15 }}>
                        <label>Billed Items / Service
                            <input name="items" defaultValue={target.treatment} placeholder="Routine Checkup + Teeth Scaling" required />
                        </label>
                        <div className="two">
                            <label>Amount (₹)
                                <input name="amount" type="number" min={1} placeholder="4500" required />
                            </label>
                            <label>Due Date
                                <input name="dueDate" type="date" defaultValue={defaultDueDate()} />
                            </label>
                        </div>
                    </form>
                </Drawer>
            )}

            {previewInvoice && (
                <InvoicePreviewModal
                    invoice={consultationToPreview(previewInvoice, patientFor(previewInvoice.patientId))}
                    onClose={() => setPreviewInvoice(null)}
                />
            )}
        </>
    );
}
