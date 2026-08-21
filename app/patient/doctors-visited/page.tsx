"use client";

import { useEffect, useState } from "react";
import { usePatientAuth } from "@/lib/hooks/usePatientAuth";
import { getVisitedDoctors } from "@/lib/firestore/patientPortal";
import { Doctor } from "@/lib/types";
import { User, Phone, Mail } from "lucide-react";

export default function DoctorsVisitedPage() {
    const { claims } = usePatientAuth();
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (claims?.patientId) {
            getVisitedDoctors(claims.patientId)
                .then(setDoctors)
                .finally(() => setLoading(false));
        }
    }, [claims]);

    if (loading) return <div style={{ padding: 20 }}>Loading visited doctors...</div>;

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Doctors Visited</h1>
            <p style={{ color: "#64748b", margin: "0 0 24px", fontSize: 14 }}>Doctors who have provided treatment during your visits.</p>

            {doctors.length === 0 ? (
                <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                    No recorded doctor visits yet.
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                    {doctors.map((doc) => (
                        <div key={doc.id} style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                                <div style={{ width: 48, height: 48, borderRadius: "50%", background: doc.photoColor || "#087f78", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 18 }}>
                                    {doc.name.replace("Dr. ", "").charAt(0)}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>{doc.name}</div>
                                    <div style={{ fontSize: 13, color: "#087f78", fontWeight: 600 }}>{doc.specialty}</div>
                                </div>
                            </div>
                            <div style={{ fontSize: 13, color: "#475569", display: "grid", gap: 6 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Phone size={14} /> {doc.phone}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Mail size={14} /> {doc.email}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
