"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePatientAuth } from "@/lib/hooks/usePatientAuth";
import { useCollection } from "@/lib/firestore-hooks";
import { bookPatientAppointment } from "@/lib/firestore/patientPortal";
import { Doctor } from "@/lib/types";

export default function BookAppointmentPage() {
    const { claims } = usePatientAuth();
    const router = useRouter();

    const { data: doctors, loading: docsLoading } = useCollection<Doctor>("doctors");

    const [doctorId, setDoctorId] = useState("");
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [time, setTime] = useState("10:00 AM");
    const [treatment, setTreatment] = useState("General Checkup & Consultation");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!claims?.patientId) {
            setMessage("Error: Patient record not found.");
            return;
        }
        if (!doctorId) {
            setMessage("Please select a doctor.");
            return;
        }

        setSubmitting(true);
        setMessage(null);
        try {
            await bookPatientAppointment({
                patientId: claims.patientId,
                doctorId,
                date,
                time,
                treatment
            });
            setMessage("Appointment request submitted successfully! Status: Pending");
            setTimeout(() => {
                router.push("/patient/dashboard");
            }, 1500);
        } catch (err: any) {
            setMessage(err.message || "Failed to book appointment.");
        } finally {
            setSubmitting(false);
        }
    };

    if (docsLoading) return <div style={{ padding: 20 }}>Loading available doctors...</div>;

    return (
        <div style={{ maxWidth: 600 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Book an Appointment</h1>

            {message && (
                <div style={{ padding: 12, borderRadius: 8, marginBottom: 16, background: message.includes("Error") || message.includes("Failed") ? "#fef2f2" : "#f0fdf4", color: message.includes("Error") || message.includes("Failed") ? "#991b1b" : "#166534" }}>
                    {message}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ background: "#fff", padding: 28, borderRadius: 12, border: "1px solid #e2e8f0", display: "grid", gap: 16 }}>
                <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                        Select Doctor
                    </label>
                    <select
                        required
                        value={doctorId}
                        onChange={(e) => setDoctorId(e.target.value)}
                        style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                    >
                        <option value="">-- Choose Doctor --</option>
                        {doctors.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name} ({d.specialty})
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                        Preferred Date
                    </label>
                    <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                    />
                </div>

                <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                        Preferred Time Slot
                    </label>
                    <select
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                    >
                        <option value="09:00 AM">09:00 AM</option>
                        <option value="10:00 AM">10:00 AM</option>
                        <option value="11:15 AM">11:15 AM</option>
                        <option value="02:00 PM">02:00 PM</option>
                        <option value="03:30 PM">03:30 PM</option>
                        <option value="05:00 PM">05:00 PM</option>
                    </select>
                </div>

                <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                        Reason / Treatment Needed
                    </label>
                    <input
                        type="text"
                        required
                        value={treatment}
                        onChange={(e) => setTreatment(e.target.value)}
                        placeholder="e.g. Root Canal, Checkup, Cleaning"
                        style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    style={{
                        height: 44,
                        background: "#087f78",
                        color: "#fff",
                        border: 0,
                        borderRadius: 8,
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: "pointer",
                        marginTop: 12
                    }}
                >
                    {submitting ? "Booking..." : "Confirm Booking Request"}
                </button>
            </form>
        </div>
    );
}
