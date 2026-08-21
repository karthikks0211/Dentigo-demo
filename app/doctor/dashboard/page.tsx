"use client";

import { useDoctorAuth } from "@/lib/hooks/useDoctorAuth";
import { useCollection } from "@/lib/firestore-hooks";
import { getDoctorAppointmentsQuery, getDoctorInvoicesQuery } from "@/lib/firestore/doctorPortal";
import { Appointment, ConsultationInvoice } from "@/lib/types";
import { Calendar, Users, Clock, CreditCard, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function DoctorDashboardPage() {
    const { claims } = useDoctorAuth();
    const doctorId = claims?.doctorId || "";

    const { data: appointments, loading: apptsLoading } = useCollection<Appointment>(
        "appointments",
        doctorId ? getDoctorAppointmentsQuery(doctorId) : [],
        [doctorId]
    );

    const { data: invoices, loading: invLoading } = useCollection<ConsultationInvoice>(
        "consultationInvoices",
        doctorId ? getDoctorInvoicesQuery(doctorId) : [],
        [doctorId]
    );

    const todayStr = new Date().toISOString().slice(0, 10);

    const todaysAppts = appointments.filter(a => a.date === todayStr);
    const pendingAppts = appointments.filter(a => a.status === "Pending");
    const treatedPatientIds = Array.from(new Set(appointments.filter(a => a.status === "Completed").map(a => a.patientId)));
    const pendingInvoices = invoices.filter(i => i.status === "Pending");
    const pendingInvoiceAmount = pendingInvoices.reduce((sum, i) => sum + i.amount, 0);

    if (apptsLoading || invLoading) {
        return <div style={{ padding: 20 }}>Loading doctor dashboard...</div>;
    }

    return (
        <div>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", margin: 0 }}>Dr. Stephen Strange Overview</h1>
                <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>Clinical metrics, appointment queues, and patient stats.</p>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
                <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ color: "#0369a1", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <Calendar size={18} /> Today's Appointments
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: "#0f172a" }}>
                        {todaysAppts.length}
                    </div>
                </div>

                <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ color: "#d97706", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <Clock size={18} /> Pending Approvals
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: "#0f172a" }}>
                        {pendingAppts.length}
                    </div>
                </div>

                <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <Users size={18} /> Patients Treated
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: "#0f172a" }}>
                        {treatedPatientIds.length}
                    </div>
                </div>

                <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <CreditCard size={18} /> Pending Invoice Amount
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: "#0f172a" }}>
                        ₹{pendingInvoiceAmount.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Quick Sections */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div style={{ background: "#fff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Pending Appointments</h3>
                        <Link href="/doctor/appointments" style={{ fontSize: 13, color: "#0369a1", textDecoration: "none", fontWeight: 600 }}>View All</Link>
                    </div>

                    {pendingAppts.length > 0 ? (
                        <div style={{ display: "grid", gap: 12 }}>
                            {pendingAppts.slice(0, 3).map((a) => (
                                <div key={a.id} style={{ background: "#f8fafc", padding: 12, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{a.treatment}</div>
                                        <div style={{ fontSize: 12, color: "#64748b" }}>Date: {a.date} | Time: {a.time}</div>
                                    </div>
                                    <span style={{ fontSize: 12, padding: "4px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 4, fontWeight: 600 }}>Pending</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ color: "#64748b", fontSize: 14 }}>No pending appointments for approval.</div>
                    )}
                </div>

                <div style={{ background: "#fff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "#0f172a" }}>Recent Patient Visits</h3>
                    {appointments.filter(a => a.status === "Completed").length > 0 ? (
                        <div style={{ display: "grid", gap: 12 }}>
                            {appointments.filter(a => a.status === "Completed").slice(0, 3).map((a) => (
                                <div key={a.id} style={{ background: "#f8fafc", padding: 12, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{a.treatment}</div>
                                        <div style={{ fontSize: 12, color: "#64748b" }}>Completed on: {a.date}</div>
                                    </div>
                                    <CheckCircle size={18} color="#16a34a" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ color: "#64748b", fontSize: 14 }}>No completed visits recorded yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
