"use client";

import { useState } from "react";
import { useDoctorAuth } from "@/lib/hooks/useDoctorAuth";
import { useCollection } from "@/lib/firestore-hooks";
import { getDoctorDiagnosisQuery, createDiagnosisReport } from "@/lib/firestore/doctorPortal";
import { DiagnosisReport, Patient } from "@/lib/types";
import { Plus, Activity } from "lucide-react";

export default function DoctorDiagnosisPage() {
    const { claims } = useDoctorAuth();
    const doctorId = claims?.doctorId || "";

    const { data: reports, loading } = useCollection<DiagnosisReport>(
        "diagnosisReports",
        doctorId ? getDoctorDiagnosisQuery(doctorId) : [],
        [doctorId]
    );

    const { data: patients } = useCollection<Patient>("patients");

    const [showModal, setShowModal] = useState(false);
    const [patientId, setPatientId] = useState("");
    const [reportType, setReportType] = useState<DiagnosisReport["reportType"]>("Dental X-Ray (IOPA/OPG)");
    const [title, setTitle] = useState("");
    const [toothNumber, setToothNumber] = useState("");
    const [clinicalNotes, setClinicalNotes] = useState("");
    const [fileUrl, setFileUrl] = useState("https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80");
    const [submitting, setSubmitting] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientId || !title || !clinicalNotes) {
            alert("Please fill in all required fields.");
            return;
        }

        setSubmitting(true);
        try {
            await createDiagnosisReport({
                patientId,
                doctorId,
                reportType,
                title,
                toothNumber,
                clinicalNotes,
                fileUrl,
                fileName: title.toLowerCase().replace(/[^a-z0-9]/g, "_") + ".jpg",
                fileSizeBytes: 1200000,
                mimeType: "image/jpeg",
                reportDate: new Date().toISOString().slice(0, 10)
            });
            setShowModal(false);
            setTitle("");
            setClinicalNotes("");
            setToothNumber("");
        } catch (err: any) {
            alert("Error creating diagnosis report: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div style={{ padding: 20 }}>Loading diagnosis records...</div>;

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Diagnosis & Clinical Reports</h1>
                    <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>Clinical notes, diagnostic X-rays, and findings by Dr. Strange.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#0369a1", color: "#fff", border: 0, padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                >
                    <Plus size={18} /> Add Diagnosis Report
                </button>
            </div>

            {reports.length === 0 ? (
                <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                    No diagnosis reports created yet.
                </div>
            ) : (
                <div style={{ display: "grid", gap: 16 }}>
                    {reports.map((r) => (
                        <div key={r.id} style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                                <div>
                                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", background: "#e0f2fe", color: "#0369a1", padding: "3px 8px", borderRadius: 4 }}>
                                        {r.reportType}
                                    </span>
                                    <h3 style={{ margin: "6px 0 0", fontSize: 17, color: "#0f172a" }}>{r.title}</h3>
                                </div>
                                <div style={{ fontSize: 12, color: "#64748b" }}>Date: {r.reportDate}</div>
                            </div>

                            {r.toothNumber && <div style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", marginBottom: 6 }}>Tooth Target: #{r.toothNumber}</div>}

                            <div style={{ fontSize: 14, color: "#334155", background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                                <strong>Clinical Notes:</strong> {r.clinicalNotes}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal for New Diagnosis */}
            {showModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100 }}>
                    <div style={{ background: "#fff", padding: 28, borderRadius: 12, width: "100%", maxWidth: 500 }}>
                        <h2 style={{ margin: "0 0 16px", fontSize: 20, color: "#0f172a" }}>New Diagnosis / X-Ray Report</h2>
                        <form onSubmit={handleCreate} style={{ display: "grid", gap: 14 }}>
                            <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Select Patient</label>
                                <select required value={patientId} onChange={e => setPatientId(e.target.value)} style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }}>
                                    <option value="">-- Choose Patient --</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Report Title</label>
                                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Pre-Operative IOPA X-Ray" style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Report Type</label>
                                    <select value={reportType} onChange={e => setReportType(e.target.value as any)} style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }}>
                                        <option value="Dental X-Ray (IOPA/OPG)">Dental X-Ray</option>
                                        <option value="CBCT / CT Scan">CBCT / CT Scan</option>
                                        <option value="Blood Test">Blood Test</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Tooth Number (Optional)</label>
                                    <input type="text" value={toothNumber} onChange={e => setToothNumber(e.target.value)} placeholder="e.g. 21" style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Clinical Findings / Notes</label>
                                <textarea required value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} placeholder="Radiolucency noted around root..." style={{ width: "100%", height: 80, padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4, fontFamily: "inherit" }} />
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f1f5f9", cursor: "pointer" }}>Cancel</button>
                                <button type="submit" disabled={submitting} style={{ padding: "8px 16px", borderRadius: 6, border: 0, background: "#0369a1", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{submitting ? "Saving..." : "Save Diagnosis"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
