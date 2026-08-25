"use client";

import { FormEvent, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import type { Supplier } from "@/lib/types";
import Drawer from "@/components/ui/Drawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PillLoader from "@/components/PillLoader";

export default function SuppliersPage() {
    const { data: suppliers, loading } = useCollection<Supplier>("suppliers");
    const showToast = useToast();

    const [query, setQuery] = useState("");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editing, setEditing] = useState<Supplier | null>(null);
    const [deleting, setDeleting] = useState<Supplier | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return suppliers.filter((s) => s.name.toLowerCase().includes(q) || s.contactPerson.toLowerCase().includes(q));
    }, [suppliers, query]);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        const f = new FormData(e.currentTarget);
        const name = String(f.get("name") || "").trim();
        const contactPerson = String(f.get("contactPerson") || "").trim();
        const phone = String(f.get("phone") || "").trim();
        const email = String(f.get("email") || "").trim();
        const address = String(f.get("address") || "").trim();
        const gstin = String(f.get("gstin") || "").trim();

        if (!name) {
            showToast("Please enter the supplier name", "error");
            setSubmitting(false);
            return;
        }

        try {
            if (editing) {
                await updateDoc(doc(db, "suppliers", editing.id), { name, contactPerson, phone, email, address, gstin });
                showToast("Supplier updated");
            } else {
                await addDoc(collection(db, "suppliers"), { name, contactPerson, phone, email, address, gstin, createdAt: Date.now() });
                showToast("Supplier added");
            }
            setDrawerOpen(false);
            setEditing(null);
        } catch {
            showToast("Something went wrong saving the supplier", "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function confirmDelete() {
        if (!deleting) return;
        setSubmitting(true);
        try {
            await deleteDoc(doc(db, "suppliers", deleting.id));
            showToast("Supplier removed");
            setDeleting(null);
        } catch {
            showToast("Couldn't delete supplier", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return <PillLoader label="Loading suppliers…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Suppliers</h1>
                    <p>Manage supplier contacts and details for purchase orders.</p>
                </div>
                <button className="primary" onClick={() => { setEditing(null); setDrawerOpen(true); }}>
                    <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />New Supplier
                </button>
            </div>

            <div className="card tableCard">
                <div className="tableTools">
                    <div className="search">
                        <Search size={15} className="searchIcon" />
                        <input placeholder="Search suppliers…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Supplier</th>
                                <th>Contact Person</th>
                                <th>Phone &amp; Email</th>
                                <th>GSTIN</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={5}><div className="empty">⌕<br /><strong>No suppliers found</strong></div></td></tr>
                            ) : (
                                filtered.map((s) => (
                                    <tr key={s.id}>
                                        <td><b>{s.name}</b><small>{s.address}</small></td>
                                        <td>{s.contactPerson}</td>
                                        <td><b>{s.phone}</b><small>{s.email}</small></td>
                                        <td>{s.gstin || "—"}</td>
                                        <td>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <button className="more" onClick={() => { setEditing(s); setDrawerOpen(true); }}><Pencil size={14} /></button>
                                                <button className="more" style={{ color: "#dc2626" }} onClick={() => setDeleting(s)}><Trash2 size={14} /></button>
                                            </div>
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
                    title={editing ? "Edit Supplier" : "New Supplier"}
                    subtitle={editing ? editing.name : "Register a new supplier"}
                    onClose={() => { setDrawerOpen(false); setEditing(null); }}
                    footer={<>
                        <button type="button" onClick={() => { setDrawerOpen(false); setEditing(null); }}>Cancel</button>
                        <button type="submit" form="supplier-form" className="primary" disabled={submitting}>
                            {submitting ? "Saving…" : "Save Supplier"}
                        </button>
                    </>}
                >
                    <form id="supplier-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 15 }}>
                        <label>Supplier Name
                            <input name="name" defaultValue={editing?.name} placeholder="CarePlus Pharma" required />
                        </label>
                        <label>Contact Person
                            <input name="contactPerson" defaultValue={editing?.contactPerson} placeholder="Sunil Rathi" />
                        </label>
                        <div className="two">
                            <label>Phone
                                <input name="phone" defaultValue={editing?.phone} placeholder="+91 90000 00000" />
                            </label>
                            <label>Email
                                <input name="email" type="email" defaultValue={editing?.email} placeholder="orders@supplier.com" />
                            </label>
                        </div>
                        <label>Address
                            <textarea name="address" defaultValue={editing?.address} placeholder="Street, City" />
                        </label>
                        <label>GSTIN
                            <input name="gstin" defaultValue={editing?.gstin} placeholder="27AACCC1234F1Z5" />
                        </label>
                    </form>
                </Drawer>
            )}

            {deleting && (
                <ConfirmModal
                    title="Remove supplier?"
                    message={`This removes ${deleting.name}. Past purchase orders referencing them are kept as-is.`}
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
