"use client";

import { FormEvent, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import type { Medicine, MedicineCategory, Batch } from "@/lib/types";
import Drawer from "@/components/ui/Drawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PillLoader from "@/components/PillLoader";

const CATEGORIES: MedicineCategory[] = ["Antibiotic", "Analgesic", "Antiseptic", "Anti-inflammatory", "Consumable", "Material", "Other"];

export default function MedicinesPage() {
    const { data: medicines, loading } = useCollection<Medicine>("medicines");
    const { data: batches } = useCollection<Batch>("batches");
    const showToast = useToast();

    const [query, setQuery] = useState("");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editing, setEditing] = useState<Medicine | null>(null);
    const [deleting, setDeleting] = useState<Medicine | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const stockByMedicine = useMemo(() => {
        const map = new Map<string, number>();
        for (const b of batches) map.set(b.medicineId, (map.get(b.medicineId) || 0) + b.quantityRemaining);
        return map;
    }, [batches]);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return medicines.filter((m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
    }, [medicines, query]);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        const f = new FormData(e.currentTarget);
        const name = String(f.get("name") || "").trim();
        const genericName = String(f.get("genericName") || "").trim();
        const category = String(f.get("category") || "Other") as MedicineCategory;
        const unit = String(f.get("unit") || "unit").trim();
        const reorderLevel = Number(f.get("reorderLevel")) || 0;
        const barcode = String(f.get("barcode") || "").trim() || String(Date.now());

        if (!name) {
            showToast("Please enter the medicine name", "error");
            setSubmitting(false);
            return;
        }

        try {
            if (editing) {
                await updateDoc(doc(db, "medicines", editing.id), { name, genericName, category, unit, reorderLevel, barcode });
                showToast("Medicine updated");
            } else {
                await addDoc(collection(db, "medicines"), { name, genericName, category, unit, reorderLevel, barcode, createdAt: Date.now() });
                showToast("Medicine added to catalog");
            }
            setDrawerOpen(false);
            setEditing(null);
        } catch {
            showToast("Something went wrong saving the medicine", "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function confirmDelete() {
        if (!deleting) return;
        setSubmitting(true);
        try {
            await deleteDoc(doc(db, "medicines", deleting.id));
            showToast("Medicine removed from catalog");
            setDeleting(null);
        } catch {
            showToast("Couldn't delete medicine", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return <PillLoader label="Loading medicines…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Medicines</h1>
                    <p>Manage the medicine catalog. Stock quantities live on Batches — this is the reference list.</p>
                </div>
                <button className="primary" onClick={() => { setEditing(null); setDrawerOpen(true); }}>
                    <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />New Medicine
                </button>
            </div>

            <div className="card tableCard">
                <div className="tableTools">
                    <div className="search">
                        <Search size={15} className="searchIcon" />
                        <input placeholder="Search medicines…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Medicine</th>
                                <th>Category</th>
                                <th>Unit</th>
                                <th>Current Stock</th>
                                <th>Reorder Level</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty">⌕<br /><strong>No medicines found</strong></div></td></tr>
                            ) : (
                                filtered.map((m) => {
                                    const stock = stockByMedicine.get(m.id) || 0;
                                    const stockCls = stock === 0 ? "outofstock" : stock <= m.reorderLevel ? "lowstock" : "instock";
                                    return (
                                        <tr key={m.id}>
                                            <td><b>{m.name}</b>{m.genericName && <small>{m.genericName}</small>}</td>
                                            <td>{m.category}</td>
                                            <td>{m.unit}</td>
                                            <td><span className={`stockBadge ${stockCls}`}>{stock} {m.unit}{stock === 1 ? "" : "s"}</span></td>
                                            <td>{m.reorderLevel}</td>
                                            <td>
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    <button className="more" onClick={() => { setEditing(m); setDrawerOpen(true); }}><Pencil size={14} /></button>
                                                    <button className="more" style={{ color: "#dc2626" }} onClick={() => setDeleting(m)}><Trash2 size={14} /></button>
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
                    title={editing ? "Edit Medicine" : "New Medicine"}
                    subtitle={editing ? editing.name : "Add a medicine to the catalog"}
                    onClose={() => { setDrawerOpen(false); setEditing(null); }}
                    footer={<>
                        <button type="button" onClick={() => { setDrawerOpen(false); setEditing(null); }}>Cancel</button>
                        <button type="submit" form="medicine-form" className="primary" disabled={submitting}>
                            {submitting ? "Saving…" : "Save Medicine"}
                        </button>
                    </>}
                >
                    <form id="medicine-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 15 }}>
                        <label>Name
                            <input name="name" defaultValue={editing?.name} placeholder="Amoxicillin 500mg" required />
                        </label>
                        <label>Generic Name
                            <input name="genericName" defaultValue={editing?.genericName} placeholder="Amoxicillin" />
                        </label>
                        <div className="two">
                            <label>Category
                                <select name="category" defaultValue={editing?.category || "Other"}>
                                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </label>
                            <label>Unit
                                <input name="unit" defaultValue={editing?.unit || "tablet"} placeholder="tablet / bottle / box" />
                            </label>
                        </div>
                        <div className="two">
                            <label>Reorder Level
                                <input name="reorderLevel" type="number" min={0} defaultValue={editing?.reorderLevel ?? 20} />
                            </label>
                            <label>Barcode
                                <input name="barcode" defaultValue={editing?.barcode} placeholder="auto-generated if blank" />
                            </label>
                        </div>
                    </form>
                </Drawer>
            )}

            {deleting && (
                <ConfirmModal
                    title="Remove medicine?"
                    message={`This removes ${deleting.name} from the catalog. Existing batches and stock history referencing it are kept as-is.`}
                    confirmLabel="Remove"
                    danger
                    loading={submitting}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </>
    );
}
