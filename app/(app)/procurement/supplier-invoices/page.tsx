"use client";

import { FormEvent, useMemo, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { generateSupplierInvoice } from "@/lib/invoices";
import type { PurchaseOrder, Supplier, SupplierInvoice } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Drawer from "@/components/ui/Drawer";
import PillLoader from "@/components/PillLoader";

function defaultDueDate() {
    return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
}

export default function SupplierInvoicesPage() {
    const { data: invoices, loading: l1 } = useCollection<SupplierInvoice>("supplierInvoices");
    const { data: pos, loading: l2 } = useCollection<PurchaseOrder>("purchaseOrders");
    const { data: suppliers, loading: l3 } = useCollection<Supplier>("suppliers");
    const showToast = useToast();

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [poId, setPoId] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const supplierFor = (id: string) => suppliers.find((s) => s.id === id)?.name || "Unknown supplier";

    const invoicedPoIds = useMemo(
        () => new Set(invoices.filter((i) => i.status !== "Cancelled").map((i) => i.poId)),
        [invoices]
    );

    // A payable can only be raised once goods have actually arrived, and only once per PO.
    const eligiblePOs = useMemo(
        () => pos.filter((po) => (po.status === "FULLY_RECEIVED" || po.status === "CLOSED") && !invoicedPoIds.has(po.id)),
        [pos, invoicedPoIds]
    );

    const selectedPo = pos.find((po) => po.id === poId);
    const receivedValue = selectedPo ? selectedPo.lines.reduce((sum, l) => sum + l.receivedQty * l.unitCost, 0) : 0;

    const sorted = useMemo(() => [...invoices].sort((a, b) => b.createdAt - a.createdAt), [invoices]);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const amount = Number(f.get("amount") || 0);
        const dueDate = String(f.get("dueDate") || "");
        const supplierRefNo = String(f.get("supplierRefNo") || "").trim();

        if (!selectedPo || amount <= 0) {
            showToast("Select a purchase order and enter a valid amount", "error");
            return;
        }

        setSubmitting(true);
        try {
            const invoiceNo = await generateSupplierInvoice({
                poId: selectedPo.id, poNumber: selectedPo.poNumber, supplierId: selectedPo.supplierId,
                amount, dueDate, supplierRefNo
            });
            showToast(`${invoiceNo} raised against ${selectedPo.poNumber}`);
            setDrawerOpen(false);
            setPoId("");
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't raise supplier invoice", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (l1 || l2 || l3) return <PillLoader label="Loading supplier invoices…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Supplier Invoices</h1>
                    <p>Payables raised against fully received purchase orders — one invoice per PO.</p>
                </div>
                <button className="primary" onClick={() => { setPoId(""); setDrawerOpen(true); }}>
                    <FilePlus2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />New Supplier Invoice
                </button>
            </div>

            <div className="card tableCard">
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Supplier Ref</th>
                                <th>PO #</th>
                                <th>Supplier</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Due Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.length === 0 ? (
                                <tr><td colSpan={7}><div className="empty"><strong>No supplier invoices yet</strong></div></td></tr>
                            ) : (
                                sorted.map((inv) => (
                                    <tr key={inv.id}>
                                        <td><b>{inv.invoiceNo}</b></td>
                                        <td>{inv.supplierRefNo || "—"}</td>
                                        <td>{inv.poNumber}</td>
                                        <td>{supplierFor(inv.supplierId)}</td>
                                        <td>₹{inv.amount.toLocaleString()}</td>
                                        <td><Badge status={inv.status} /></td>
                                        <td>{inv.dueDate}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {drawerOpen && (
                <Drawer
                    title="New Supplier Invoice"
                    subtitle="Raise a payable against a fully received purchase order"
                    onClose={() => setDrawerOpen(false)}
                    footer={<>
                        <button type="button" onClick={() => setDrawerOpen(false)}>Cancel</button>
                        <button type="submit" form="sinv-form" className="primary" disabled={submitting || !selectedPo}>
                            {submitting ? "Raising…" : "Raise Invoice"}
                        </button>
                    </>}
                >
                    <form id="sinv-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 15 }}>
                        <label>Purchase Order
                            <select value={poId} onChange={(e) => setPoId(e.target.value)} required>
                                <option value="" disabled>Select a fully received PO…</option>
                                {eligiblePOs.map((po) => <option key={po.id} value={po.id}>{po.poNumber} — {supplierFor(po.supplierId)}</option>)}
                            </select>
                        </label>
                        {eligiblePOs.length === 0 && (
                            <p style={{ fontSize: 13, color: "#829295" }}>No purchase orders are ready to invoice yet — receive goods against a Sent PO first.</p>
                        )}
                        <label>Supplier Ref No. (their bill number)
                            <input name="supplierRefNo" placeholder="Optional" />
                        </label>
                        <label>Amount (₹)
                            <input name="amount" type="number" min={0} step="0.01" defaultValue={receivedValue || undefined} key={poId} required />
                        </label>
                        <label>Due Date
                            <input name="dueDate" type="date" defaultValue={defaultDueDate()} required />
                        </label>
                    </form>
                </Drawer>
            )}
        </>
    );
}
