"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import type { Appointment, AppointmentStatus, Doctor, Patient } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PillLoader from "@/components/PillLoader";

const STATUSES: AppointmentStatus[] = ["Pending", "Confirmed", "Completed", "No-show", "Cancelled"];

export default function AppointmentsPage() {
    const { data: appointments, loading } = useCollection<Appointment>("appointments");
    const { data: patients } = useCollection<Patient>("patients");
    const { data: doctors } = useCollection<Doctor>("doctors");
    const showToast = useToast();

    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [deleting, setDeleting] = useState<Appointment | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const patientFor = (id: string) => patients.find((p) => p.id === id)?.name || "Unknown patient";
    const doctorFor = (id: string) => doctors.find((d) => d.id === id)?.name || "Unassigned";

    const sorted = useMemo(
        () => [...appointments].sort((a, b) => (a.date + a.time > b.date + b.time ? -1 : 1)),
        [appointments]
    );

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return sorted.filter((a) => {
            const matchesQuery = patientFor(a.patientId).toLowerCase().includes(q) ||
                a.treatment.toLowerCase().includes(q) ||
                doctorFor(a.doctorId).toLowerCase().includes(q);
            const matchesStatus = statusFilter === "All" || a.status === statusFilter;
            return matchesQuery && matchesStatus;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sorted, query, statusFilter, patients, doctors]);

    async function changeStatus(a: Appointment, status: AppointmentStatus) {
        try {
            await updateDoc(doc(db, "appointments", a.id), { status });
            showToast(`Marked ${status.toLowerCase()}`);
        } catch {
            showToast("Couldn't update status", "error");
        }
    }

    async function confirmDelete() {
        if (!deleting) return;
        setSubmitting(true);
        try {
            await deleteDoc(doc(db, "appointments", deleting.id));
            showToast("Appointment deleted");
            setDeleting(null);
        } catch {
            showToast("Couldn't delete appointment", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return <PillLoader label="Loading appointments…" />;

    const summary = [
        { label: "All", count: appointments.length },
        ...STATUSES.map((s) => ({ label: s, count: appointments.filter((a) => a.status === s).length }))
    ];

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Appointments</h1>
                    <p>View and manage the clinic schedule across every doctor.</p>
                </div>
                <Link href="/book" className="primary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                    <Plus size={14} style={{ marginRight: 4 }} />New Appointment
                </Link>
            </div>

            <div className="summary">
                {summary.map((s) => (
                    <div key={s.label} onClick={() => setStatusFilter(s.label)} style={{ cursor: "pointer", outline: statusFilter === s.label ? "2px solid var(--dg-teal-500)" : "none" }}>
                        <span>{s.count}</span>
                        <strong>{s.label}</strong>
                    </div>
                ))}
            </div>

            <div className="card tableCard">
                <div className="tableTools">
                    <div className="search">
                        <Search size={15} className="searchIcon" />
                        <input placeholder="Search appointments…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
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
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty">⌕<br /><strong>No appointments found</strong></div></td></tr>
                            ) : (
                                filtered.map((a) => (
                                    <tr key={a.id}>
                                        <td><b>{patientFor(a.patientId)}</b></td>
                                        <td><b>{a.date}</b><small>{a.time}</small></td>
                                        <td>{a.treatment}</td>
                                        <td>{doctorFor(a.doctorId)}</td>
                                        <td><Badge status={a.status} /></td>
                                        <td>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                <select
                                                    value={a.status}
                                                    onChange={(e) => changeStatus(a, e.target.value as AppointmentStatus)}
                                                    style={{ border: "1px solid #dce6e5", borderRadius: 5, padding: "6px 8px", fontSize: 12 }}
                                                >
                                                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <button className="more" style={{ color: "#dc2626" }} onClick={() => setDeleting(a)}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {deleting && (
                <ConfirmModal
                    title="Delete appointment?"
                    message={`This permanently removes the ${deleting.treatment} appointment for ${patientFor(deleting.patientId)}.`}
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
