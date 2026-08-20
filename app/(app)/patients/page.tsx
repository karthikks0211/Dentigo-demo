"use client";

import { FormEvent, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Search, Pencil, Trash2, Activity, Eye, Download, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { formatBytes } from "@/lib/diagnosis";
import type { Patient, DiagnosisReport, Doctor } from "@/lib/types";
import Drawer from "@/components/ui/Drawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PillLoader from "@/components/PillLoader";

function initials(name: string) {
    return name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
}

export default function PatientsPage() {
    const { data: patients, loading: loadingPatients } = useCollection<Patient>("patients");
    const { data: diagnosisReports, loading: loadingReports } = useCollection<DiagnosisReport>("diagnosisReports");
    const { data: doctors } = useCollection<Doctor>("doctors");
    const showToast = useToast();

    const [query, setQuery] = useState("");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editing, setEditing] = useState<Patient | null>(null);
    const [deleting, setDeleting] = useState<Patient | null>(null);
    const [viewingDiagnosisPatient, setViewingDiagnosisPatient] = useState<Patient | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const loading = loadingPatients || loadingReports;

    const doctorMap = useMemo(() => {
        const map = new Map<string, Doctor>();
        doctors.forEach((d) => map.set(d.id, d));
        return map;
    }, [doctors]);

    const doctorFor = (id: string) => doctorMap.get(id)?.name || "Attending Specialist";

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return patients.filter((p) =>
            p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q)
        );
    }, [patients, query]);

    const patientReports = useMemo(() => {
        if (!viewingDiagnosisPatient) return [];
        return diagnosisReports
            .filter((r) => r.patientId === viewingDiagnosisPatient.id)
            .sort((a, b) => (b.reportDate || "").localeCompare(a.reportDate || "") || b.createdAt - a.createdAt);
    }, [diagnosisReports, viewingDiagnosisPatient]);

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
                    <p>Manage your patient records, contact information, and clinical diagnosis history.</p>
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
                                <th>Reports</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty">⌕<br /><strong>No patients found</strong></div></td></tr>
                            ) : (
                                filtered.map((p) => {
                                    const reportCount = diagnosisReports.filter((r) => r.patientId === p.id).length;
                                    return (
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
                                                <button
                                                    onClick={() => setViewingDiagnosisPatient(p)}
                                                    className="quickDemoBtn"
                                                    style={{ margin: 0, padding: "4px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
                                                >
                                                    <Activity size={13} color="#087f78" />
                                                    <span>{reportCount} {reportCount === 1 ? "Report" : "Reports"}</span>
                                                </button>
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    <button className="more" title="Edit Patient" onClick={() => { setEditing(p); setDrawerOpen(true); }}><Pencil size={14} /></button>
                                                    <button className="more" title="Delete Patient" style={{ color: "#dc2626" }} onClick={() => setDeleting(p)}><Trash2 size={14} /></button>
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

            {/* Patient Diagnostic History Drawer */}
            {viewingDiagnosisPatient && (
                <Drawer
                    title={`Diagnostic History`}
                    subtitle={`Clinical records, X-Rays, and laboratory reports for ${viewingDiagnosisPatient.name}`}
                    onClose={() => setViewingDiagnosisPatient(null)}
                    footer={
                        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                            <Link
                                href="/diagnosis"
                                className="primary"
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", padding: "8px 14px", fontSize: 13 }}
                                onClick={() => setViewingDiagnosisPatient(null)}
                            >
                                <Plus size={14} /> Upload New Report in Diagnosis
                            </Link>
                            <button type="button" onClick={() => setViewingDiagnosisPatient(null)}>Close</button>
                        </div>
                    }
                >
                    <div style={{ display: "grid", gap: 14 }}>
                        {patientReports.length === 0 ? (
                            <div className="empty" style={{ padding: "36px 16px" }}>
                                <Activity size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                                <br />
                                <strong>No diagnostic scans recorded yet</strong>
                                <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                                    You can upload X-Rays, CT scans, or blood tests from the Diagnosis tab.
                                </p>
                            </div>
                        ) : (
                            patientReports.map((report) => {
                                const isImage = report.mimeType.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(report.fileName);
                                return (
                                    <div
                                        key={report.id}
                                        style={{
                                            border: "1px solid #e2e8f0",
                                            borderRadius: 8,
                                            padding: "12px 14px",
                                            background: "#fff",
                                            display: "grid",
                                            gap: 8
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                            <div>
                                                <strong style={{ fontSize: 14, color: "#0f172a", display: "block" }}>{report.title}</strong>
                                                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                                                    <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                                        {report.reportType}
                                                    </span>
                                                    {report.toothNumber && (
                                                        <span style={{ background: "#f1f5f9", color: "#334155", padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                                            Tooth #{report.toothNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: 12, color: "#64748b" }}>
                                                {report.reportDate || new Date(report.createdAt).toISOString().slice(0, 10)}
                                            </span>
                                        </div>

                                        {isImage && report.fileUrl && (
                                            <div style={{ maxHeight: 180, overflow: "hidden", borderRadius: 6, background: "#0f172a", textAlign: "center" }}>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={report.fileUrl}
                                                    alt={report.title}
                                                    style={{ maxHeight: 180, maxWidth: "100%", objectFit: "contain" }}
                                                />
                                            </div>
                                        )}

                                        {report.clinicalNotes && (
                                            <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: 6, fontSize: 12, color: "#334155" }}>
                                                <span style={{ fontWeight: 600, color: "#087f78" }}>Findings: </span>
                                                {report.clinicalNotes}
                                            </div>
                                        )}

                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: 6 }}>
                                            <span>Doctor: {doctorFor(report.doctorId)}</span>
                                            {report.fileUrl && (
                                                <a
                                                    href={report.fileUrl}
                                                    download={report.fileName || "scan"}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: "#087f78", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3, textDecoration: "none" }}
                                                >
                                                    <Download size={12} /> Download ({formatBytes(report.fileSizeBytes)})
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Drawer>
            )}
        </>
    );
}
