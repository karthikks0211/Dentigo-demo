"use client";

import { FormEvent, useMemo, useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { Plus, Trash2, PackageCheck, MoreVertical, History as HistoryIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import {
    approvePurchaseOrder, cancelPurchaseOrder, closePurchaseOrder, createPurchaseOrder,
    receiveGoods, rejectPurchaseOrder, sendToSupplier, submitForApproval,
    type GrnLineInput, type NewPOLine
} from "@/lib/procurement";
import type { GoodsReceipt, Medicine, PurchaseOrder, PurchaseRequest, Supplier } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Drawer from "@/components/ui/Drawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PromptModal from "@/components/ui/PromptModal";
import PillLoader from "@/components/PillLoader";

type DraftLine = NewPOLine & { fromRequestId?: string };

function emptyLine(): DraftLine {
    return { medicineId: "", name: "", qty: 10, unitCost: 0 };
}

export default function PurchaseOrdersPage() {
    const { data: pos, loading } = useCollection<PurchaseOrder>("purchaseOrders");
    const { data: suppliers } = useCollection<Supplier>("suppliers");
    const { data: medicines } = useCollection<Medicine>("medicines");
    const { data: requests } = useCollection<PurchaseRequest>("purchaseRequests");
    const { data: grns } = useCollection<GoodsReceipt>("goodsReceipts");
    const { user } = useAuth();
    const showToast = useToast();
    const actor = user?.email || "unknown";

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [supplierId, setSupplierId] = useState("");
    const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState<PurchaseOrder | null>(null);

    const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
    const [receiveLines, setReceiveLines] = useState<GrnLineInput[]>([]);
    const [receiveSubmitting, setReceiveSubmitting] = useState(false);

    const [confirming, setConfirming] = useState<{ po: PurchaseOrder; action: "send" | "close" } | null>(null);
    const [prompting, setPrompting] = useState<{ po: PurchaseOrder; action: "approve" | "reject" | "cancel" } | null>(null);
    const [historyFor, setHistoryFor] = useState<PurchaseOrder | null>(null);
    const [busy, setBusy] = useState(false);

    const openRequests = useMemo(() => requests.filter((r) => r.status === "OPEN"), [requests]);
    const supplierFor = (id: string) => suppliers.find((s) => s.id === id)?.name || "Unknown supplier";
    const sorted = useMemo(() => [...pos].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [pos]);

    function resetDrawer() {
        setSupplierId("");
        setLines([emptyLine()]);
    }

    function updateLine(i: number, patch: Partial<DraftLine>) {
        setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    }

    function toggleRequest(req: PurchaseRequest, checked: boolean) {
        if (checked) {
            setLines((prev) => [
                ...prev.filter((l) => l.medicineId || l.fromRequestId),
                { medicineId: req.medicineId, name: req.name, qty: req.requestedQty, unitCost: 0, fromRequestId: req.id }
            ]);
        } else {
            setLines((prev) => prev.filter((l) => l.fromRequestId !== req.id));
        }
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!supplierId) {
            showToast("Please select a supplier", "error");
            return;
        }
        setSubmitting(true);
        try {
            const requestIds = lines.filter((l) => l.fromRequestId).map((l) => l.fromRequestId!);
            const { poNumber } = await createPurchaseOrder({
                supplierId,
                lines: lines.map(({ medicineId, name, qty, unitCost }) => ({ medicineId, name, qty, unitCost })),
                requestIds,
                actor
            });
            showToast(`${poNumber} created as Draft`);
            setDrawerOpen(false);
            resetDrawer();
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't create purchase order", "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleSubmitForApproval(po: PurchaseOrder) {
        setBusy(true);
        try {
            await submitForApproval(po, actor);
            showToast(`${po.poNumber} submitted for approval`);
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't submit for approval", "error");
        } finally {
            setBusy(false);
        }
    }

    async function handlePrompt(value: string) {
        if (!prompting) return;
        const { po, action } = prompting;
        setBusy(true);
        try {
            if (action === "approve") {
                await approvePurchaseOrder(po, actor, value || undefined);
                showToast(`${po.poNumber} approved`);
            } else if (action === "reject") {
                await rejectPurchaseOrder(po, actor, value);
                showToast(`${po.poNumber} rejected`);
            } else {
                await cancelPurchaseOrder(po, actor, value);
                showToast(`${po.poNumber} cancelled`);
            }
            setPrompting(null);
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Something went wrong", "error");
        } finally {
            setBusy(false);
        }
    }

    async function handleConfirm() {
        if (!confirming) return;
        const { po, action } = confirming;
        setBusy(true);
        try {
            if (action === "send") {
                await sendToSupplier(po, actor);
                showToast(`${po.poNumber} sent to ${supplierFor(po.supplierId)}`);
            } else {
                await closePurchaseOrder(po, actor);
                showToast(`${po.poNumber} closed`);
            }
            setConfirming(null);
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Something went wrong", "error");
        } finally {
            setBusy(false);
        }
    }

    function openReceive(po: PurchaseOrder) {
        setReceiving(po);
        setReceiveLines(
            po.lines
                .filter((l) => l.receivedQty < l.qty)
                .map((l) => ({
                    medicineId: l.medicineId, name: l.name, receivedQtyNow: l.qty - l.receivedQty,
                    batchNo: `${l.name.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
                    expiryDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
                    unitCost: l.unitCost, mrp: Math.round(l.unitCost * 1.8 * 100) / 100
                }))
        );
    }

    async function confirmReceive() {
        if (!receiving) return;
        setReceiveSubmitting(true);
        try {
            await receiveGoods({ po: receiving, lines: receiveLines, actor });
            showToast(`Goods receipt recorded against ${receiving.poNumber}`);
            setReceiving(null);
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't record goods receipt", "error");
        } finally {
            setReceiveSubmitting(false);
        }
    }

    async function confirmDelete() {
        if (!deleting) return;
        setSubmitting(true);
        try {
            await deleteDoc(doc(db, "purchaseOrders", deleting.id));
            showToast("Draft purchase order deleted");
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
                    <p>Draft → Approve → Send → Receive. Only a confirmed Goods Receipt ever updates stock.</p>
                </div>
                <button className="primary" onClick={() => { resetDrawer(); setDrawerOpen(true); }}>
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
                                <th>Received</th>
                                <th>Status</th>
                                <th>Ordered</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.length === 0 ? (
                                <tr><td colSpan={8}><div className="empty"><strong>No purchase orders yet</strong></div></td></tr>
                            ) : (
                                sorted.map((po) => {
                                    const value = po.lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0);
                                    const orderedQty = po.lines.reduce((sum, l) => sum + l.qty, 0);
                                    const receivedQty = po.lines.reduce((sum, l) => sum + l.receivedQty, 0);
                                    return (
                                        <tr key={po.id}>
                                            <td><b>{po.poNumber}</b></td>
                                            <td>{supplierFor(po.supplierId)}</td>
                                            <td><span className="linesCell" title={po.lines.map((l) => l.name).join(", ")}>{po.lines.map((l) => l.name).join(", ")}</span></td>
                                            <td>₹{value.toLocaleString()}</td>
                                            <td>{receivedQty} / {orderedQty}</td>
                                            <td><span className="poStatusBadge"><Badge status={po.status} /></span></td>
                                            <td>{po.orderedDate}</td>
                                            <td>
                                                <div className="rowActions" tabIndex={0}>
                                                    <button className="rowActionsTrigger" aria-label="Actions" type="button">
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    <div className="rowActionsMenu">
                                                        <button type="button" onClick={() => setHistoryFor(po)}>
                                                            <HistoryIcon size={15} />History
                                                        </button>
                                                        {po.status === "DRAFT" && (
                                                            <>
                                                                <button type="button" disabled={busy} onClick={() => handleSubmitForApproval(po)}>Submit for Approval</button>
                                                                <button type="button" className="danger" onClick={() => setPrompting({ po, action: "cancel" })}>Cancel</button>
                                                                <button type="button" className="danger" onClick={() => setDeleting(po)}>
                                                                    <Trash2 size={15} />Delete
                                                                </button>
                                                            </>
                                                        )}
                                                        {po.status === "PENDING_APPROVAL" && (
                                                            <>
                                                                <button type="button" onClick={() => setPrompting({ po, action: "approve" })}>Approve</button>
                                                                <button type="button" className="danger" onClick={() => setPrompting({ po, action: "reject" })}>Reject</button>
                                                            </>
                                                        )}
                                                        {po.status === "APPROVED" && (
                                                            <>
                                                                <button type="button" onClick={() => setConfirming({ po, action: "send" })}>Send to Supplier</button>
                                                                <button type="button" className="danger" onClick={() => setPrompting({ po, action: "cancel" })}>Cancel</button>
                                                            </>
                                                        )}
                                                        {(po.status === "SENT" || po.status === "PARTIALLY_RECEIVED") && (
                                                            <button type="button" onClick={() => openReceive(po)}>
                                                                <PackageCheck size={15} />Receive Goods
                                                            </button>
                                                        )}
                                                        {po.status === "FULLY_RECEIVED" && (
                                                            <button type="button" onClick={() => setConfirming({ po, action: "close" })}>Close PO</button>
                                                        )}
                                                    </div>
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
                    subtitle="Order stock from a supplier — starts as a Draft, never touches inventory"
                    onClose={() => setDrawerOpen(false)}
                    footer={<>
                        <button type="button" onClick={() => setDrawerOpen(false)}>Cancel</button>
                        <button type="submit" form="po-form" className="primary" disabled={submitting}>
                            {submitting ? "Creating…" : "Create Draft"}
                        </button>
                    </>}
                >
                    <form id="po-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 15 }}>
                        <label>Supplier
                            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                                <option value="" disabled>Select supplier…</option>
                                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </label>

                        {openRequests.length > 0 && (
                            <div style={{ display: "grid", gap: 8 }}>
                                <strong style={{ fontSize: 13 }}>Open Purchase Requests</strong>
                                <div className="card" style={{ padding: 10, display: "grid", gap: 6 }}>
                                    {openRequests.map((r) => (
                                        <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400 }}>
                                            <input
                                                type="checkbox"
                                                checked={lines.some((l) => l.fromRequestId === r.id)}
                                                onChange={(e) => toggleRequest(r, e.target.checked)}
                                            />
                                            {r.name} · requested {r.requestedQty} · <small>{r.requestNo}</small>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ display: "grid", gap: 10 }}>
                            <strong style={{ fontSize: 13 }}>Line Items</strong>
                            {lines.map((line, i) => (
                                <div key={i} className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
                                    <label>Medicine
                                        <select
                                            value={line.medicineId}
                                            disabled={!!line.fromRequestId}
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
                                        <button
                                            type="button" className="quickDemoBtn" style={{ margin: 0, height: 40 }}
                                            onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                                        >
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
                    title="Receive Goods (GRN)"
                    subtitle={`${receiving.poNumber} · confirming receipt is what actually updates stock`}
                    onClose={() => setReceiving(null)}
                    footer={<>
                        <button type="button" onClick={() => setReceiving(null)}>Cancel</button>
                        <button type="button" className="primary" disabled={receiveSubmitting} onClick={confirmReceive}>
                            {receiveSubmitting ? "Receiving…" : "Confirm Receipt"}
                        </button>
                    </>}
                >
                    <div style={{ display: "grid", gap: 12 }}>
                        {receiveLines.length === 0 ? (
                            <p>Nothing left to receive on this order.</p>
                        ) : receiveLines.map((line, i) => {
                            const poLine = receiving.lines.find((l) => l.medicineId === line.medicineId)!;
                            const remaining = poLine.qty - poLine.receivedQty;
                            return (
                                <div key={i} className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
                                    <strong style={{ fontSize: 13 }}>{line.name} · {remaining} of {poLine.qty} pending</strong>
                                    <label>Received Quantity
                                        <input
                                            type="number" min={0} max={remaining} value={line.receivedQtyNow}
                                            onChange={(e) => setReceiveLines((prev) => prev.map((l, idx) => idx === i ? { ...l, receivedQtyNow: Number(e.target.value) } : l))}
                                        />
                                    </label>
                                    <div className="two">
                                        <label>Batch No.
                                            <input value={line.batchNo} onChange={(e) => setReceiveLines((prev) => prev.map((l, idx) => idx === i ? { ...l, batchNo: e.target.value } : l))} />
                                        </label>
                                        <label>Expiry Date
                                            <input type="date" value={line.expiryDate} onChange={(e) => setReceiveLines((prev) => prev.map((l, idx) => idx === i ? { ...l, expiryDate: e.target.value } : l))} />
                                        </label>
                                    </div>
                                    <div className="two">
                                        <label>Unit Cost (₹)
                                            <input type="number" min={0} step="0.01" value={line.unitCost} onChange={(e) => setReceiveLines((prev) => prev.map((l, idx) => idx === i ? { ...l, unitCost: Number(e.target.value) } : l))} />
                                        </label>
                                        <label>MRP per unit (₹)
                                            <input type="number" min={0} step="0.01" value={line.mrp} onChange={(e) => setReceiveLines((prev) => prev.map((l, idx) => idx === i ? { ...l, mrp: Number(e.target.value) } : l))} />
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Drawer>
            )}

            {historyFor && (
                <Drawer
                    title="Purchase Order History"
                    subtitle={`${historyFor.poNumber} · ${supplierFor(historyFor.supplierId)}`}
                    onClose={() => setHistoryFor(null)}
                    footer={<button type="button" onClick={() => setHistoryFor(null)} style={{ width: "100%" }}>Close</button>}
                >
                    <div style={{ display: "grid", gap: 10 }}>
                        <strong style={{ fontSize: 13 }}>Audit Trail</strong>
                        {historyFor.history?.length ? historyFor.history.map((h, i) => (
                            <div key={i} className="card" style={{ padding: 10 }}>
                                <b>{h.action}</b>
                                <div style={{ fontSize: 12, color: "#829295" }}>{h.byEmail} · {new Date(h.at).toLocaleString()}</div>
                                {h.note && <div style={{ fontSize: 13, marginTop: 4 }}>{h.note}</div>}
                            </div>
                        )) : <p>No history recorded.</p>}

                        <strong style={{ fontSize: 13, marginTop: 8 }}>Goods Receipts</strong>
                        {grns.filter((g) => g.poId === historyFor.id).length === 0 ? (
                            <p>No goods received yet.</p>
                        ) : grns.filter((g) => g.poId === historyFor.id).map((g) => (
                            <div key={g.id} className="card" style={{ padding: 10 }}>
                                <b>{g.grnNo}</b> · {g.date} · {g.receivedBy}
                                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                                    {g.lines.map((l, i) => (
                                        <li key={i} style={{ fontSize: 13 }}>{l.name}: +{l.receivedQtyNow} (batch {l.batchNo}, exp {l.expiryDate})</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </Drawer>
            )}

            {confirming && (
                <ConfirmModal
                    title={confirming.action === "send" ? "Send to supplier?" : "Close purchase order?"}
                    message={
                        confirming.action === "send"
                            ? `Marks ${confirming.po.poNumber} as sent to ${supplierFor(confirming.po.supplierId)}.`
                            : `Closes ${confirming.po.poNumber} — this order is fully received and settled.`
                    }
                    confirmLabel={confirming.action === "send" ? "Send" : "Close PO"}
                    loading={busy}
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirming(null)}
                />
            )}

            {prompting && (
                <PromptModal
                    title={
                        prompting.action === "approve" ? "Approve purchase order?"
                            : prompting.action === "reject" ? "Reject purchase order?"
                                : "Cancel purchase order?"
                    }
                    message={`${prompting.po.poNumber} · ${supplierFor(prompting.po.supplierId)}`}
                    label={prompting.action === "approve" ? "Note (optional)" : "Reason"}
                    placeholder={prompting.action === "approve" ? "Any notes for the record…" : "Why is this being " + (prompting.action === "reject" ? "rejected" : "cancelled") + "?"}
                    required={prompting.action !== "approve"}
                    confirmLabel={prompting.action === "approve" ? "Approve" : prompting.action === "reject" ? "Reject" : "Cancel PO"}
                    danger={prompting.action !== "approve"}
                    loading={busy}
                    onConfirm={handlePrompt}
                    onCancel={() => setPrompting(null)}
                />
            )}

            {deleting && (
                <ConfirmModal
                    title="Delete draft purchase order?"
                    message={`This permanently removes ${deleting.poNumber}. Only drafts can be deleted.`}
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
