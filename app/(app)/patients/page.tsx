"use client";

import { FormEvent, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import type { Patient } from "@/lib/types";
import Drawer from "@/components/ui/Drawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PillLoader from "@/components/PillLoader";

function initials(name: string) {
    return name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
}

export default function PatientsPage() {
    const { data: patients, loading } = useCollection<Patient>("patients");
    const showToast = useToast();

    const [query, setQuery] = useState("");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editing, setEditing] = useState<Patient | null>(null);
    const [deleting, setDeleting] = useState<Patient | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return patients.filter((p) =>
            p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q)
        );
    }, [patients, query]);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        const f = new FormData(e.currentTarget);
        const name = String(f.get("name") || "").trim();
        const email = String(f.get("email") || "").trim();
        const phone = String(f.get("phone") || "").trim();
        const age = Number(f.get("age")) || 0;
        const gender = String(f.get("gender") || "Female") as Patient["gender"];
        const address = String(f.get("address") || "");

        if (name.length < 2) {
            showToast("Patient name must be at least 2 characters", "error");
            setSubmitting(false);
            return;
        }
        if (!email.includes("@")) {
            showToast("Please enter a valid email address", "error");
            setSubmitting(false);
            return;
        }

        try {
            if (editing) {
                await updateDoc(doc(db, "patients", editing.id), { name, email, phone, age, gender, address });
                showToast("Patient details updated");
            } else {
                await addDoc(collection(db, "patients"), { name, email, phone, age, gender, address, createdAt: Date.now() });
                showToast("New patient added");
            }
            setDrawerOpen(false);
            setEditing(null);
        } catch {
            showToast("Something went wrong saving the patient", "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function confirmDelete() {
        if (!deleting) return;
        setSubmitting(true);
        try {
            await deleteDoc(doc(db, "patients", deleting.id));
            showToast("Patient removed");
            setDeleting(null);
        } catch {
            showToast("Couldn't delete patient", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return <PillLoader label="Loading patients…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Patients</h1>
                    <p>Manage your patient records and clinical history.</p>
                </div>
                <button className="primary" onClick={() => { setEditing(null); setDrawerOpen(true); }}>
                    <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Add Patient
                </button>
            </div>

            <div className="card tableCard">
                <div className="tableTools">
                    <div className="search">
                        <Search size={15} className="searchIcon" />
                        <input placeholder="Search patients…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Patient Name</th>
                                <th>Email &amp; Phone</th>
                                <th>Age</th>
                                <th>Gender</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={5}><div className="empty">⌕<br /><strong>No patients found</strong></div></td></tr>
                            ) : (
                                filtered.map((p) => (
                                    <tr key={p.id}>
                                        <td>
                                            <div className="person">
                                                <span className="avatar">{initials(p.name)}</span>
                                                <b>{p.name}</b>
                                            </div>
                                        </td>
                                        <td><b>{p.email}</b><small>{p.phone}</small></td>
                                        <td>{p.age}</td>
                                        <td>{p.gender}</td>
                                        <td>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <button className="more" onClick={() => { setEditing(p); setDrawerOpen(true); }}><Pencil size={14} /></button>
                                                <button className="more" style={{ color: "#dc2626" }} onClick={() => setDeleting(p)}><Trash2 size={14} /></button>
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
                    title={editing ? "Edit Patient" : "Add Patient"}
                    subtitle={editing ? editing.name : "Register a new patient"}
                    onClose={() => { setDrawerOpen(false); setEditing(null); }}
                    footer={<>
                        <button type="button" onClick={() => { setDrawerOpen(false); setEditing(null); }}>Cancel</button>
                        <button type="submit" form="patient-form" className="primary" disabled={submitting}>
                            {submitting ? "Saving…" : "Save Patient"}
                        </button>
                    </>}
                >
                    <form id="patient-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 15 }}>
                        <label>Full Name
                            <input name="name" defaultValue={editing?.name} placeholder="Jane Doe" required />
                        </label>
                        <label>Email
                            <input name="email" type="email" defaultValue={editing?.email} placeholder="jane@email.com" required />
                        </label>
                        <div className="two">
                            <label>Phone
                                <input name="phone" defaultValue={editing?.phone} placeholder="+91 90000 00000" />
                            </label>
                            <label>Age
                                <input name="age" type="number" min={0} defaultValue={editing?.age} placeholder="32" />
                            </label>
                        </div>
                        <label>Gender
                            <select name="gender" defaultValue={editing?.gender || "Female"}>
                                <option>Female</option>
                                <option>Male</option>
                                <option>Other</option>
                            </select>
                        </label>
                        <label>Address
                            <textarea name="address" defaultValue={editing?.address} placeholder="Street, City" />
                        </label>
                    </form>
                </Drawer>
            )}

            {deleting && (
                <ConfirmModal
                    title="Remove patient?"
                    message={`This removes ${deleting.name} from the patient list. Their appointment and prescription history is kept as-is.`}
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
