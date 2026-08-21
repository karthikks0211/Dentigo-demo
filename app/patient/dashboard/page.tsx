"use client";

import { usePatientAuth } from "@/lib/hooks/usePatientAuth";
import { useCollection } from "@/lib/firestore-hooks";
import {
    getPatientAppointmentsQuery,
    getPatientPrescriptionsQuery,
    getPatientInvoicesQuery
} from "@/lib/firestore/patientPortal";
import { Appointment, Prescription, ConsultationInvoice } from "@/lib/types";
import Link from "next/link";
import { Calendar, FileText, CreditCard, Activity, ArrowRight } from "lucide-react";

export default function PatientDashboardPage() {
    const { claims } = usePatientAuth();
    const patientId = claims?.patientId || "";

    const { data: appointments, loading: apptsLoading } = useCollection<Appointment>(
        "appointments",
        patientId ? getPatientAppointmentsQuery(patientId) : [],
        [patientId]
    );

    const { data: prescriptions, loading: rxLoading } = useCollection<Prescription>(
        "prescriptions",
        patientId ? getPatientPrescriptionsQuery(patientId) : [],
        [patientId]
    );

    const { data: invoices, loading: invLoading } = useCollection<ConsultationInvoice>(
        "consultationInvoices",
        patientId ? getPatientInvoicesQuery(patientId) : [],
        [patientId]
    );

    const upcomingAppt = appointments.find(a => a.status === "Confirmed" || a.status === "Pending");
    const lastVisit = appointments.find(a => a.status === "Completed");
    const pendingInvoices = invoices.filter(i => i.status === "Pending");
    const activePrescriptions = prescriptions.filter(p => !p.dispensed);

    if (apptsLoading || rxLoading || invLoading) {
        return <div style={{ padding: 20 }}>Loading dashboard data...</div>;
    }

    return (
        <div>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", margin: 0 }}>Welcome Back, John</h1>
                <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>Here is a summary of your dental health and appointments.</p>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
                <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ color: "#087f78", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <Calendar size={18} /> Upcoming Visit
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: "#0f172a" }}>
                        {upcomingAppt ? `${upcomingAppt.date} (${upcomingAppt.time})` : "No upcoming visit"}
                    </div>
                    {upcomingAppt && <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{upcomingAppt.treatment}</div>}
                </div>

                <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ color: "#0284c7", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <Activity size={18} /> Last Visit
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: "#0f172a" }}>
                        {lastVisit ? lastVisit.date : "None"}
                    </div>
                    {lastVisit && <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{lastVisit.treatment}</div>}
                </div>

                <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ color: "#d97706", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <CreditCard size={18} /> Pending Invoices
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: "#0f172a" }}>
                        {pendingInvoices.length} Pending
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                        Total: ₹{pendingInvoices.reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                    </div>
                </div>

                <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <FileText size={18} /> Active Prescriptions
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: "#0f172a" }}>
                        {activePrescriptions.length} Active
                    </div>
                </div>
            </div>

            {/* Quick Actions & Recent Activity */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div style={{ background: "#fff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "#0f172a" }}>Upcoming Appointment</h3>
                    {upcomingAppt ? (
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: "#087f78" }}>{upcomingAppt.treatment}</div>
                            <div style={{ color: "#475569", marginTop: 6, fontSize: 14 }}>
                                📅 Date: {upcomingAppt.date} at {upcomingAppt.time}
                            </div>
                            <div style={{ display: "inline-block", marginTop: 12, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: upcomingAppt.status === "Confirmed" ? "#dcfce7" : "#fef3c7", color: upcomingAppt.status === "Confirmed" ? "#166534" : "#92400e" }}>
                                Status: {upcomingAppt.status}
                            </div>
                        </div>
                    ) : (
                        <div style={{ color: "#64748b", fontSize: 14 }}>
                            No upcoming appointment scheduled.
                            <div style={{ marginTop: 12 }}>
                                <Link href="/patient/appointments/book" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#087f78", color: "#fff", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
                                    Book New Appointment <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ background: "#fff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "#0f172a" }}>Pending Payments</h3>
                    {pendingInvoices.length > 0 ? (
                        <div style={{ display: "grid", gap: 12 }}>
                            {pendingInvoices.map(inv => (
                                <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#f8fafc", borderRadius: 8 }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{inv.invoiceNo}</div>
                                        <div style={{ fontSize: 12, color: "#64748b" }}>Due: {inv.dueDate}</div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontWeight: 700, color: "#0f172a" }}>₹{inv.amount.toLocaleString()}</div>
                                        <Link href="/patient/invoices" style={{ fontSize: 12, color: "#087f78", textDecoration: "underline" }}>View & Pay</Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ color: "#64748b", fontSize: 14 }}>No pending invoices. All bills are clear!</div>
                    )}
                </div>
            </div>
        </div>
    );
}
