"use client";

import { useEffect, useState } from "react";
import { useDoctorAuth } from "@/lib/hooks/useDoctorAuth";
import { getDoctorPatients, getDoctorAppointmentsQuery } from "@/lib/firestore/doctorPortal";
import { Patient, Appointment } from "@/lib/types";
import { useCollection } from "@/lib/firestore-hooks";
import { User, Calendar, Phone, Mail } from "lucide-react";

export default function DoctorPatientsPage() {
    const { claims } = useDoctorAuth();
    const doctorId = claims?.doctorId || "";

    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);

    const { data: appointments } = useCollection<Appointment>(
        "appointments",
        doctorId ? getDoctorAppointmentsQuery(doctorId) : [],
        [doctorId]
    );

    useEffect(() => {
        if (doctorId) {
            getDoctorPatients(doctorId)
                .then(setPatients)
                .finally(() => setLoading(false));
        }
    }, [doctorId]);

    if (loading) return <div style={{ padding: 20 }}>Loading your patient directory...</div>;

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Patients Directory</h1>
            <p style={{ color: "#64748b", margin: "0 0 24px", fontSize: 14 }}>Patients who have scheduled visits or received treatment under Dr. Strange.</p>

            {patients.length === 0 ? (
                <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                    No patient records found.
                </div>
            ) : (
                <div style={{ display: "grid", gap: 20 }}>
                    {patients.map((pat) => {
                        const patAppts = appointments.filter(a => a.patientId === pat.id);
                        return (
                            <div key={pat.id} style={{ background: "#fff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{pat.name}</h3>
                                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                                            Age: {pat.age} | Gender: {pat.gender} | ID: <code>{pat.id}</code>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 13, color: "#475569", textAlign: "right" }}>
                                        <div><Phone size={14} style={{ display: "inline", marginRight: 4 }} />{pat.phone}</div>
                                        <div><Mail size={14} style={{ display: "inline", marginRight: 4 }} />{pat.email}</div>
                                    </div>
                                </div>

                                <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8 }}>
                                    <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                                        <Calendar size={15} /> Visit History with Dr. Strange:
                                    </h4>
                                    {patAppts.length === 0 ? (
                                        <div style={{ fontSize: 13, color: "#94a3b8" }}>No appointments logged.</div>
                                    ) : (
                                        <div style={{ display: "grid", gap: 8 }}>
                                            {patAppts.map(a => (
                                                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 10px", background: "#fff", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                                                    <div><strong>{a.treatment}</strong> ({a.date} at {a.time})</div>
                                                    <span style={{ fontWeight: 600, color: a.status === "Completed" ? "#16a34a" : "#d97706" }}>{a.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
