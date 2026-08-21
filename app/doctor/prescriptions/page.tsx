"use client";

import { useState } from "react";
import { useDoctorAuth } from "@/lib/hooks/useDoctorAuth";
import { useCollection } from "@/lib/firestore-hooks";
import { getDoctorPrescriptionsQuery, createPrescription } from "@/lib/firestore/doctorPortal";
import { Prescription, Patient } from "@/lib/types";
import { Plus, Pill, FileText } from "lucide-react";

export default function DoctorPrescriptionsPage() {
    const { claims } = useDoctorAuth();
    const doctorId = claims?.doctorId || "";

    const { data: prescriptions, loading } = useCollection<Prescription>(
        "prescriptions",
        doctorId ? getDoctorPrescriptionsQuery(doctorId) : [],
        [doctorId]
    );

    const { data: patients } = useCollection<Patient>("patients");

    const [showModal, setShowModal] = useState(false);
    const [patientId, setPatientId] = useState("");
    const [diagnosis, setDiagnosis] = useState("");
    const [medName, setMedName] = useState("");
    const [dosage, setDosage] = useState("1 tablet");
    const [frequency, setFrequency] = useState("Twice daily");
    const [durationDays, setDurationDays] = useState(5);
    const [quantity, setQuantity] = useState(10);
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientId || !diagnosis || !medName) {
            alert("Please fill in all required fields.");
            return;
        }

        setSubmitting(true);
        try {
            await createPrescription({
                patientId,
                doctorId,
                diagnosis,
                medicines: [
                    {
                        medicineId: "custom-" + Date.now(),
                        name: medName,
                        dosage,
                        frequency,
                        durationDays,
                        quantity
                    }
                ],
                notes,
                date: new Date().toISOString().slice(0, 10)
            });
            setShowModal(false);
            setDiagnosis("");
            setMedName("");
            setNotes("");
        } catch (err: any) {
            alert("Error creating prescription: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div style={{ padding: 20 }}>Loading prescriptions...</div>;

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Prescriptions</h1>
                    <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>Issued prescription records and quick issuance.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#0369a1", color: "#fff", border: 0, padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                >
                    <Plus size={18} /> New Prescription
                </button>
            </div>

            {prescriptions.length === 0 ? (
                <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                    No prescriptions issued yet.
                </div>
            ) : (
                <div style={{ display: "grid", gap: 16 }}>
                    {prescriptions.map((rx) => (
                        <div key={rx.id} style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>{rx.diagnosis}</div>
                                    <div style={{ fontSize: 12, color: "#64748b" }}>Patient ID: <code>{rx.patientId}</code> | Date: {rx.date}</div>
                                </div>
                                <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>
                                    Issued
                                </span>
                            </div>

                            <div style={{ fontSize: 14 }}>
                                {rx.medicines?.map((m, i) => (
                                    <div key={i} style={{ background: "#f8fafc", padding: 10, borderRadius: 6, marginBottom: 6 }}>
                                        <strong>{m.name}</strong> — {m.dosage}, {m.frequency} ({m.durationDays} days)
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal for New Prescription */}
            {showModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100 }}>
                    <div style={{ background: "#fff", padding: 28, borderRadius: 12, width: "100%", maxWidth: 500 }}>
                        <h2 style={{ margin: "0 0 16px", fontSize: 20, color: "#0f172a" }}>Issue New Prescription</h2>
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
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Diagnosis</label>
                                <input type="text" required value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="e.g. Periapical Abscess" style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Medicine Name</label>
                                <input type="text" required value={medName} onChange={e => setMedName(e.target.value)} placeholder="e.g. Amoxicillin 500mg" style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Dosage</label>
                                    <input type="text" value={dosage} onChange={e => setDosage(e.target.value)} style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Frequency</label>
                                    <input type="text" value={frequency} onChange={e => setFrequency(e.target.value)} style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Instructions / Notes</label>
                                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Take after meal..." style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f1f5f9", cursor: "pointer" }}>Cancel</button>
                                <button type="submit" disabled={submitting} style={{ padding: "8px 16px", borderRadius: 6, border: 0, background: "#0369a1", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{submitting ? "Saving..." : "Issue Prescription"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
