"use client";

import { FormEvent, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Trash2, PackageCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { receivePurchaseOrder, type ReceivedLine } from "@/lib/pharmacy";
import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, Supplier, Medicine } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Drawer from "@/components/ui/Drawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PillLoader from "@/components/PillLoader";

function emptyLine(): PurchaseOrderLine {
    return { medicineId: "", name: "", qty: 10, unitCost: 0 };
}

export default function PurchaseOrdersPage() {
    const { data: pos, loading } = useCollection<PurchaseOrder>("purchaseOrders");
    const { data: suppliers } = useCollection<Supplier>("suppliers");
    const { data: medicines } = useCollection<Medicine>("medicines");
    const showToast = useToast();

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [lines, setLines] = useState<PurchaseOrderLine[]>([emptyLine()]);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState<PurchaseOrder | null>(null);

    const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
    const [receiveLines, setReceiveLines] = useState<ReceivedLine[]>([]);
    const [receiveSubmitting, setReceiveSubmitting] = useState(false);

    const supplierFor = (id: string) => suppliers.find((s) => s.id === id)?.name || "Unknown supplier";
    const sorted = useMemo(() => [...pos].sort((a, b) => (a.orderedDate < b.orderedDate ? 1 : -1)), [pos]);

    function updateLine(i: number, patch: Partial<PurchaseOrderLine>) {
        setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const supplierId = String(f.get("supplier") || "");
        const validLines = lines.filter((l) => l.medicineId && l.qty > 0);

        if (!supplierId) {
            showToast("Please select a supplier", "error");
            return;
        }
        if (validLines.length === 0) {
            showToast("Add at least one line item", "error");
            return;
        }

        setSubmitting(true);
        try {
            const poNumber = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
            await addDoc(collection(db, "purchaseOrders"), {
                poNumber, supplierId, status: "Ordered", lines: validLines,
                orderedDate: new Date().toISOString().slice(0, 10), createdAt: Date.now()
            });
            showToast(`${poNumber} created`);
            setDrawerOpen(false);
            setLines([emptyLine()]);
        } catch {
            showToast("Couldn't create purchase order", "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function changeStatus(po: PurchaseOrder, status: PurchaseOrderStatus) {
        try {
            await updateDoc(doc(db, "purchaseOrders", po.id), { status });
            showToast(`${po.poNumber} marked ${status.toLowerCase()}`);
        } catch {
            showToast("Couldn't update status", "error");
        }
    }

    function openReceive(po: PurchaseOrder) {
        setReceiving(po);
        setReceiveLines(po.lines.map((l) => ({
            medicineId: l.medicineId, name: l.name, qty: l.qty, unitCost: l.unitCost,
            batchNo: `${l.name.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
            expiryDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
            mrp: Math.round(l.unitCost * 1.8 * 100) / 100
        })));
    }

    async function confirmReceive() {
        if (!receiving) return;
        setReceiveSubmitting(true);
        try {
            await receivePurchaseOrder(receiving, receiveLines);
            showToast(`${receiving.poNumber} received — batches created`);
            setReceiving(null);
        } catch {
            showToast("Couldn't receive purchase order", "error");
        } finally {
            setReceiveSubmitting(false);
        }
    }

    async function confirmDelete() {
        if (!deleting) return;
        setSubmitting(true);
        try {
            await deleteDoc(doc(db, "purchaseOrders", deleting.id));
            showToast("Purchase order deleted");
            setDeleting(null);
        } catch {
            showToast("Couldn't delete purchase order", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return <PillLoader label="Loading purchase orders…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Purchase Orders</h1>
                    <p>Order stock from suppliers and receive it into batches.</p>
                </div>
                <button className="primary" onClick={() => { setLines([emptyLine()]); setDrawerOpen(true); }}>
                    <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />New Purchase Order
                </button>
            </div>

            <div className="card tableCard">
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>PO #</th>
                                <th>Supplier</th>
                                <th>Lines</th>
                                <th>Value</th>
                                <th>Status</th>
                                <th>Ordered</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.length === 0 ? (
                                <tr><td colSpan={7}><div className="empty"><strong>No purchase orders yet</strong></div></td></tr>
                            ) : (
                                sorted.map((po) => {
                                    const value = po.lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0);
                                    return (
                                        <tr key={po.id}>
                                            <td><b>{po.poNumber}</b></td>
                                            <td>{supplierFor(po.supplierId)}</td>
                                            <td>{po.lines.map((l) => l.name).join(", ")}</td>
                                            <td>₹{value.toLocaleString()}</td>
                                            <td><Badge status={po.status} /></td>
                                            <td>{po.orderedDate}</td>
                                            <td>
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    {po.status === "Draft" && (
                                                        <button className="quickDemoBtn" style={{ margin: 0 }} onClick={() => changeStatus(po, "Ordered")}>Mark Ordered</button>
                                                    )}
                                                    {po.status === "Ordered" && (
                                                        <button className="quickDemoBtn" style={{ margin: 0 }} onClick={() => openReceive(po)}>
                                                            <PackageCheck size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Receive
                                                        </button>
                                                    )}
                                                    {(po.status === "Draft" || po.status === "Ordered") && (
                                                        <button className="more" style={{ color: "#dc2626" }} onClick={() => setDeleting(po)}><Trash2 size={14} /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {drawerOpen && (
                <Drawer
                    title="New Purchase Order"
                    subtitle="Order stock from a supplier"
                    onClose={() => setDrawerOpen(false)}
                    footer={<>
                        <button type="button" onClick={() => setDrawerOpen(false)}>Cancel</button>
                        <button type="submit" form="po-form" className="primary" disabled={submitting}>
                            {submitting ? "Creating…" : "Create Purchase Order"}
                        </button>
                    </>}
                >
                    <form id="po-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 15 }}>
                        <label>Supplier
                            <select name="supplier" required defaultValue="">
                                <option value="" disabled>Select supplier…</option>
                                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </label>
                        <div style={{ display: "grid", gap: 10 }}>
                            <strong style={{ fontSize: 13 }}>Line Items</strong>
                            {lines.map((line, i) => (
                                <div key={i} className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
                                    <label>Medicine
                                        <select
                                            value={line.medicineId}
                                            onChange={(e) => {
                                                const med = medicines.find((m) => m.id === e.target.value);
                                                updateLine(i, { medicineId: e.target.value, name: med?.name || "" });
                                            }}
                                        >
                                            <option value="">Select…</option>
                                            {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </label>
                                    <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
                                        <label style={{ flex: 1 }}>Quantity
                                            <input type="number" min={1} value={line.qty} onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} />
                                        </label>
                                        <label style={{ flex: 1 }}>Unit Cost (₹)
                                            <input type="number" min={0} step="0.01" value={line.unitCost} onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })} />
                                        </label>
                                        <button type="button" className="quickDemoBtn" style={{ margin: 0, height: 40 }} onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" className="quickDemoBtn" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                                + Add line item
                            </button>
                        </div>
                    </form>
                </Drawer>
            )}

            {receiving && (
                <Drawer
                    title="Receive Purchase Order"
                    subtitle={`${receiving.poNumber} · each line becomes a new batch`}
                    onClose={() => setReceiving(null)}
                    footer={<>
                        <button type="button" onClick={() => setReceiving(null)}>Cancel</button>
                        <button type="button" className="primary" disabled={receiveSubmitting} onClick={confirmReceive}>
                            {receiveSubmitting ? "Receiving…" : "Confirm Receipt"}
                        </button>
                    </>}
                >
                    <div style={{ display: "grid", gap: 12 }}>
                        {receiveLines.map((line, i) => (
                            <div key={i} className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
                                <strong style={{ fontSize: 13 }}>{line.name} · {line.qty} units</strong>
                                <div className="two">
                                    <label>Batch No.
                                        <input value={line.batchNo} onChange={(e) => setReceiveLines((prev) => prev.map((l, idx) => idx === i ? { ...l, batchNo: e.target.value } : l))} />
                                    </label>
                                    <label>Expiry Date
                                        <input type="date" value={line.expiryDate} onChange={(e) => setReceiveLines((prev) => prev.map((l, idx) => idx === i ? { ...l, expiryDate: e.target.value } : l))} />
                                    </label>
                                </div>
                                <label>MRP per unit (₹)
                                    <input type="number" min={0} step="0.01" value={line.mrp} onChange={(e) => setReceiveLines((prev) => prev.map((l, idx) => idx === i ? { ...l, mrp: Number(e.target.value) } : l))} />
                                </label>
                            </div>
                        ))}
                    </div>
                </Drawer>
            )}

            {deleting && (
                <ConfirmModal
                    title="Delete purchase order?"
                    message={`This permanently removes ${deleting.poNumber}.`}
                    confirmLabel="Delete"
                    danger
                    loading={submitting}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </>
    );
}
