"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { processReturn } from "@/lib/pharmacy";
import type { PharmacyInvoice, Patient, SalesReturn, SalesReturnAction } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Drawer from "@/components/ui/Drawer";
import PillLoader from "@/components/PillLoader";

export default function ReturnsPage() {
    const { data: returns, loading: l1 } = useCollection<SalesReturn>("salesReturns");
    const { data: pharmacyInvoices, loading: l2 } = useCollection<PharmacyInvoice>("pharmacyInvoices");
    const { data: patients } = useCollection<Patient>("patients");
    const showToast = useToast();

    const patientFor = (id: string) => patients.find((p) => p.id === id)?.name || "Unknown patient";

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [invoiceId, setInvoiceId] = useState("");
    const [lineIndex, setLineIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    const selectedInvoice = pharmacyInvoices.find((i) => i.id === invoiceId) || null;
    const selectedLine = selectedInvoice?.lines[lineIndex] || null;

    const sorted = useMemo(() => [...returns].sort((a, b) => (a.date < b.date ? 1 : -1)), [returns]);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!selectedInvoice || !selectedLine) {
            showToast("Select a pharmacy invoice and line item", "error");
            return;
        }
        const f = new FormData(e.currentTarget);
        const qty = Number(f.get("qty")) || 0;
        const action = String(f.get("action") || "Restock") as SalesReturnAction;
        const reason = String(f.get("reason") || "").trim();

        if (qty <= 0 || qty > selectedLine.qty) {
            showToast(`Enter a quantity between 1 and ${selectedLine.qty}`, "error");
            return;
        }
        if (!reason) {
            showToast("Please enter a reason for the return", "error");
            return;
        }

        setSubmitting(true);
        try {
            await processReturn({
                pharmacyInvoiceId: selectedInvoice.id,
                pharmacyInvoiceNo: selectedInvoice.invoiceNo,
                medicineId: selectedLine.medicineId,
                name: selectedLine.name,
                batchId: selectedLine.batchId,
                qty, action, reason
            });
            showToast(action === "Restock" ? "Return processed — stock restocked" : "Return processed — logged as write-off");
            setDrawerOpen(false);
            setInvoiceId("");
            setLineIndex(0);
        } catch {
            showToast("Couldn't process the return", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (l1 || l2) return <PillLoader label="Loading returns…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Returns</h1>
                    <p>Process pharmacy sales returns — restock good stock or write off damaged/expired units.</p>
                </div>
                <button className="primary" onClick={() => setDrawerOpen(true)}>
                    <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />New Return
                </button>
            </div>

            <div className="card tableCard">
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Medicine</th>
                                <th>Invoice #</th>
                                <th>Quantity</th>
                                <th>Action</th>
                                <th>Reason</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty"><strong>No returns processed yet</strong></div></td></tr>
                            ) : (
                                sorted.map((r) => (
                                    <tr key={r.id}>
                                        <td><b>{r.name}</b></td>
                                        <td>{r.pharmacyInvoiceNo}</td>
                                        <td>{r.qty}</td>
                                        <td><Badge status={r.action} /></td>
                                        <td>{r.reason}</td>
                                        <td>{r.date}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {drawerOpen && (
                <Drawer
                    title="New Sales Return"
                    subtitle="Return items from a dispensed pharmacy invoice"
                    onClose={() => setDrawerOpen(false)}
                    footer={<>
                        <button type="button" onClick={() => setDrawerOpen(false)}>Cancel</button>
                        <button type="submit" form="return-form" className="primary" disabled={submitting}>
                            {submitting ? "Processing…" : "Process Return"}
                        </button>
                    </>}
                >
                    <form id="return-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 15 }}>
                        <label>Pharmacy Invoice
                            <select value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); setLineIndex(0); }}>
                                <option value="">Select invoice…</option>
                                {pharmacyInvoices.map((i) => (
                                    <option key={i.id} value={i.id}>{i.invoiceNo} · {patientFor(i.patientId)}</option>
                                ))}
                            </select>
                        </label>
                        {selectedInvoice && (
                            <label>Medicine Line
                                <select value={lineIndex} onChange={(e) => setLineIndex(Number(e.target.value))}>
                                    {selectedInvoice.lines.map((l, i) => (
                                        <option key={i} value={i}>{l.name} · {l.qty} units · batch {l.batchNo}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                        <div className="two">
                            <label>Quantity
                                <input name="qty" type="number" min={1} max={selectedLine?.qty || 1} defaultValue={1} />
                            </label>
                            <label>Action
                                <select name="action" defaultValue="Restock">
                                    <option value="Restock">Restock</option>
                                    <option value="Writeoff">Write off</option>
                                </select>
                            </label>
                        </div>
                        <label>Reason
                            <textarea name="reason" placeholder="Patient returned unopened, packaging damaged, etc." />
                        </label>
                    </form>
                </Drawer>
            )}
        </>
    );
}
