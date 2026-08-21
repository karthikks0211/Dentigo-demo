"use client";

import { useDoctorAuth } from "@/lib/hooks/useDoctorAuth";
import { useCollection } from "@/lib/firestore-hooks";
import { getDoctorAppointmentsQuery, updateAppointmentStatus } from "@/lib/firestore/doctorPortal";
import { Appointment } from "@/lib/types";
import { useState } from "react";
import { Check, X, CheckCircle, Clock } from "lucide-react";

export default function DoctorAppointmentsPage() {
    const { claims } = useDoctorAuth();
    const doctorId = claims?.doctorId || "";

    const { data: appointments, loading } = useCollection<Appointment>(
        "appointments",
        doctorId ? getDoctorAppointmentsQuery(doctorId) : [],
        [doctorId]
    );

    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleAction = async (id: string, status: Appointment["status"]) => {
        setProcessingId(id);
        try {
            await updateAppointmentStatus(id, status);
        } catch (e: any) {
            alert("Error updating status: " + e.message);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <div style={{ padding: 20 }}>Loading doctor appointments...</div>;

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Appointment Management</h1>
            <p style={{ color: "#64748b", margin: "0 0 24px", fontSize: 14 }}>Review pending appointments, confirm bookings, or mark visits complete.</p>

            {appointments.length === 0 ? (
                <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                    No appointments scheduled for you.
                </div>
            ) : (
                <div style={{ display: "grid", gap: 16 }}>
                    {appointments.map((app) => (
                        <div key={app.id} style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>{app.treatment}</span>
                                    <span style={{
                                        padding: "3px 10px",
                                        borderRadius: 20,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        background: app.status === "Completed" ? "#dcfce7" : app.status === "Confirmed" ? "#e0f2fe" : app.status === "Pending" ? "#fef3c7" : "#fef2f2",
                                        color: app.status === "Completed" ? "#166534" : app.status === "Confirmed" ? "#0369a1" : app.status === "Pending" ? "#92400e" : "#991b1b"
                                    }}>
                                        {app.status}
                                    </span>
                                </div>
                                <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                                    📅 Date: {app.date} at {app.time} | Patient Doc ID: <code>{app.patientId}</code>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 8 }}>
                                {app.status === "Pending" && (
                                    <>
                                        <button
                                            onClick={() => handleAction(app.id, "Confirmed")}
                                            disabled={processingId === app.id}
                                            style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#0369a1", color: "#fff", border: 0, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                                        >
                                            <Check size={16} /> Confirm
                                        </button>
                                        <button
                                            onClick={() => handleAction(app.id, "Cancelled")}
                                            disabled={processingId === app.id}
                                            style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                                        >
                                            <X size={16} /> Reject
                                        </button>
                                    </>
                                )}

                                {app.status === "Confirmed" && (
                                    <button
                                        onClick={() => handleAction(app.id, "Completed")}
                                        disabled={processingId === app.id}
                                        style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#16a34a", color: "#fff", border: 0, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                                    >
                                        <CheckCircle size={16} /> Mark Complete
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
