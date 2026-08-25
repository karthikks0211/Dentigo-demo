"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { cancelPurchaseRequest, createPurchaseRequest } from "@/lib/procurement";
import type { Batch, Medicine, PurchaseRequest } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Drawer from "@/components/ui/Drawer";
import PillLoader from "@/components/PillLoader";

export default function PurchaseRequestsPage() {
    const { data: requests, loading: l1 } = useCollection<PurchaseRequest>("purchaseRequests");
    const { data: medicines, loading: l2 } = useCollection<Medicine>("medicines");
    const { data: batches, loading: l3 } = useCollection<Batch>("batches");
    const { user } = useAuth();
    const showToast = useToast();
    const actor = user?.email || "unknown";

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const remainingByMedicine = useMemo(() => {
        const map = new Map<string, number>();
        for (const b of batches) map.set(b.medicineId, (map.get(b.medicineId) || 0) + b.quantityRemaining);
        return map;
    }, [batches]);

    const requestedMedicineIds = useMemo(
        () => new Set(requests.filter((r) => r.status === "OPEN").map((r) => r.medicineId)),
        [requests]
    );

    const suggestions = useMemo(() => {
        return medicines
            .map((m) => ({ ...m, remaining: remainingByMedicine.get(m.id) || 0 }))
            .filter((m) => m.remaining <= m.reorderLevel && !requestedMedicineIds.has(m.id))
            .sort((a, b) => a.remaining - b.remaining);
    }, [medicines, remainingByMedicine, requestedMedicineIds]);

    const sorted = useMemo(() => [...requests].sort((a, b) => b.createdAt - a.createdAt), [requests]);

    async function raiseFromSuggestion(m: Medicine & { remaining: number }) {
        setBusyId(m.id);
        try {
            const suggestedQty = Math.max(m.reorderLevel * 2 - m.remaining, 1);
            await createPurchaseRequest({
                medicineId: m.id, name: m.name, requestedQty: suggestedQty,
                reason: `Auto-suggested — stock (${m.remaining}) at or below reorder level (${m.reorderLevel}).`,
                currentStock: m.remaining, reorderLevel: m.reorderLevel, requestedBy: actor
            });
            showToast(`Purchase request raised for ${m.name}`);
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't raise request", "error");
        } finally {
            setBusyId(null);
        }
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const medicineId = String(f.get("medicine") || "");
        const requestedQty = Number(f.get("qty") || 0);
        const reason = String(f.get("reason") || "").trim();
        const med = medicines.find((m) => m.id === medicineId);

        if (!med || requestedQty <= 0) {
            showToast("Select a medicine and a valid quantity", "error");
            return;
        }

        setSubmitting(true);
        try {
            await createPurchaseRequest({
                medicineId: med.id, name: med.name, requestedQty, reason,
                currentStock: remainingByMedicine.get(med.id) || 0, reorderLevel: med.reorderLevel, requestedBy: actor
            });
            showToast(`Purchase request raised for ${med.name}`);
            setDrawerOpen(false);
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't raise request", "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCancel(r: PurchaseRequest) {
        setBusyId(r.id);
        try {
            await cancelPurchaseRequest(r, actor);
            showToast(`${r.requestNo} cancelled`);
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't cancel request", "error");
        } finally {
            setBusyId(null);
        }
    }

    if (l1 || l2 || l3) return <PillLoader label="Loading purchase requests…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Purchase Requests</h1>
                    <p>Raised when stock hits reorder level — bundle open requests into a Purchase Order when you're ready.</p>
                </div>
                <button className="primary" onClick={() => setDrawerOpen(true)}>
                    <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />New Request
                </button>
            </div>

            {suggestions.length > 0 && (
                <div className="card tableCard" style={{ marginBottom: 20 }}>
                    <div className="cardHead" style={{ padding: "16px 20px 0" }}><h3>Low Stock Suggestions</h3></div>
                    <div className="tableWrap">
                        <table>
                            <thead>
                                <tr><th>Medicine</th><th>Remaining</th><th>Reorder Level</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {suggestions.map((m) => (
                                    <tr key={m.id}>
                                        <td><b>{m.name}</b></td>
                                        <td><span className="low">{m.remaining} {m.unit}{m.remaining === 1 ? "" : "s"}</span></td>
                                        <td>{m.reorderLevel}</td>
                                        <td>
                                            <button className="quickDemoBtn" style={{ margin: 0 }} disabled={busyId === m.id} onClick={() => raiseFromSuggestion(m)}>
                                                {busyId === m.id ? "Raising…" : "Raise Request"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="card tableCard">
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Request #</th>
                                <th>Medicine</th>
                                <th>Requested Qty</th>
                                <th>Stock at Request</th>
                                <th>Reason</th>
                                <th>Requested By</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.length === 0 ? (
                                <tr><td colSpan={8}><div className="empty"><strong>No purchase requests yet</strong></div></td></tr>
                            ) : (
                                sorted.map((r) => (
                                    <tr key={r.id}>
                                        <td><b>{r.requestNo}</b></td>
                                        <td>{r.name}</td>
                                        <td>{r.requestedQty}</td>
                                        <td>{r.currentStockAtRequest} <small>(reorder {r.reorderLevelAtRequest})</small></td>
                                        <td><span className="linesCell" title={r.reason}>{r.reason || "—"}</span></td>
                                        <td>{r.requestedBy}</td>
                                        <td>
                                            <Badge status={r.status === "OPEN" ? "Open" : r.status === "LINKED" ? "Linked" : "Cancelled"} />
                                            {r.status === "LINKED" && <small style={{ display: "block" }}>{r.poNumber}</small>}
                                        </td>
                                        <td>
                                            {r.status === "OPEN" && (
                                                <button className="more" style={{ color: "#dc2626" }} disabled={busyId === r.id} onClick={() => handleCancel(r)}>
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {drawerOpen && (
                <Drawer
                    title="New Purchase Request"
                    subtitle="Flag a medicine that needs restocking"
                    onClose={() => setDrawerOpen(false)}
                    footer={<>
                        <button type="button" onClick={() => setDrawerOpen(false)}>Cancel</button>
                        <button type="submit" form="pr-form" className="primary" disabled={submitting}>
                            {submitting ? "Raising…" : "Raise Request"}
                        </button>
                    </>}
                >
                    <form id="pr-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 15 }}>
                        <label>Medicine
                            <select name="medicine" required defaultValue="">
                                <option value="" disabled>Select medicine…</option>
                                {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </label>
                        <label>Requested Quantity
                            <input name="qty" type="number" min={1} defaultValue={10} required />
                        </label>
                        <label>Reason
                            <textarea name="reason" placeholder="Why is this needed?" />
                        </label>
                    </form>
                </Drawer>
            )}
        </>
    );
}
