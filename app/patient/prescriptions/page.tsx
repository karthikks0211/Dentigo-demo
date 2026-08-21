"use client";

import { usePatientAuth } from "@/lib/hooks/usePatientAuth";
import { useCollection } from "@/lib/firestore-hooks";
import { getPatientPrescriptionsQuery } from "@/lib/firestore/patientPortal";
import { Prescription } from "@/lib/types";
import { FileText, Pill } from "lucide-react";

export default function PatientPrescriptionsPage() {
    const { claims } = usePatientAuth();
    const patientId = claims?.patientId || "";

    const { data: prescriptions, loading } = useCollection<Prescription>(
        "prescriptions",
        patientId ? getPatientPrescriptionsQuery(patientId) : [],
        [patientId]
    );

    if (loading) return <div style={{ padding: 20 }}>Loading your prescriptions...</div>;

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>My Prescriptions</h1>
            <p style={{ color: "#64748b", margin: "0 0 24px", fontSize: 14 }}>Issued medications and treatment instructions from your doctor.</p>

            {prescriptions.length === 0 ? (
                <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                    No prescriptions found.
                </div>
            ) : (
                <div style={{ display: "grid", gap: 20 }}>
                    {prescriptions.map((rx) => (
                        <div key={rx.id} style={{ background: "#fff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Diagnosis: {rx.diagnosis}</h3>
                                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Date: {rx.date}</div>
                                </div>
                                <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: rx.dispensed ? "#e0f2fe" : "#fef3c7", color: rx.dispensed ? "#0369a1" : "#92400e" }}>
                                    {rx.dispensed ? "Dispensed" : "Active"}
                                </span>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                                    <Pill size={16} /> Prescribed Medicines:
                                </h4>
                                <div style={{ display: "grid", gap: 8 }}>
                                    {rx.medicines?.map((med, idx) => (
                                        <div key={idx} style={{ background: "#f8fafc", padding: 12, borderRadius: 8, display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                                            <div>
                                                <strong>{med.name}</strong>
                                                <div style={{ fontSize: 12, color: "#64748b" }}>Dosage: {med.dosage} | Frequency: {med.frequency}</div>
                                            </div>
                                            <div style={{ textAlign: "right", fontSize: 13, color: "#475569" }}>
                                                Duration: {med.durationDays} days (Qty: {med.quantity})
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {rx.notes && (
                                <div style={{ fontSize: 13, background: "#fffbebe6", border: "1px solid #fde68a", color: "#b45309", padding: 10, borderRadius: 8 }}>
                                    <strong>Doctor Notes:</strong> {rx.notes}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
