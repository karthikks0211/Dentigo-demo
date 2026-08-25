"use client";

import { useMemo, useState } from "react";
import { Search, User, ScrollText, CalendarClock, Pill, Activity, IndianRupee, Wallet } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import type { Appointment, AppointmentAuditAction, AppointmentAuditEntry, Doctor, Patient } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import PillLoader from "@/components/PillLoader";

function actionIcon(action: AppointmentAuditAction) {
    switch (action) {
        case "StatusChanged": return CalendarClock;
        case "PrescriptionCreated":
        case "PrescriptionSentToPos":
        case "PrescriptionDispensed":
            return Pill;
        case "DiagnosisReportAdded":
        case "DiagnosisReportBilled":
            return Activity;
        case "ConsultationBilled": return IndianRupee;
        case "PaymentCollected": return Wallet;
        default: return ScrollText;
    }
}

function actionLabel(action: AppointmentAuditAction) {
    switch (action) {
        case "StatusChanged": return "Status changed";
        case "PrescriptionCreated": return "Prescription written";
        case "PrescriptionSentToPos": return "Prescription sent to POS";
        case "PrescriptionDispensed": return "Prescription dispensed";
        case "DiagnosisReportAdded": return "Diagnosis report added";
        case "DiagnosisReportBilled": return "Diagnosis report billed";
        case "ConsultationBilled": return "Consultation billed";
        case "PaymentCollected": return "Payment collected";
        default: return action;
    }
}

export default function AppointmentAuditLogPage() {
    const { data: appointments, loading: l1 } = useCollection<Appointment>("appointments");
    const { data: patients, loading: l2 } = useCollection<Patient>("patients");
    const { data: doctors, loading: l3 } = useCollection<Doctor>("doctors");
    const { data: entries, loading: l4 } = useCollection<AppointmentAuditEntry>("appointmentAuditLog");

    const [query, setQuery] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const patientFor = (id: string) => patients.find((p) => p.id === id)?.name || "Unknown patient";
    const doctorFor = (id: string) => doctors.find((d) => d.id === id)?.name || "Unassigned";

    const sorted = useMemo(
        () => [...appointments].sort((a, b) => (a.date + a.time > b.date + b.time ? -1 : 1)),
        [appointments]
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return sorted;
        return sorted.filter((a) =>
            patientFor(a.patientId).toLowerCase().includes(q) ||
            doctorFor(a.doctorId).toLowerCase().includes(q) ||
            a.treatment.toLowerCase().includes(q) ||
            a.date.includes(q)
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sorted, query, patients, doctors]);

    const selected = useMemo(() => appointments.find((a) => a.id === selectedId) || null, [appointments, selectedId]);

    const timeline = useMemo(() => {
        if (!selected) return [];
        return entries
            .filter((e) => e.appointmentId === selected.id)
            .sort((a, b) => b.at - a.at);
    }, [entries, selected]);

    if (l1 || l2 || l3 || l4) return <PillLoader label="Loading audit log…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Appointment Audit Log</h1>
                    <p>Pick an appointment to see every status change, prescription, report, and payment tied to that visit.</p>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
                <div className="card tableCard">
                    <div className="tableTools" style={{ padding: "16px 20px 0" }}>
                        <div className="search">
                            <Search size={15} className="searchIcon" />
                            <input placeholder="Search by patient, doctor, treatment, or date…" value={query} onChange={(e) => setQuery(e.target.value)} />
                        </div>
                    </div>
                    <div className="tableWrap" style={{ maxHeight: 560, overflowY: "auto" }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>Date &amp; Time</th>
                                    <th>Doctor</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={4}><div className="empty">⌕<br /><strong>No appointments found</strong></div></td></tr>
                                ) : (
                                    filtered.map((a) => (
                                        <tr
                                            key={a.id}
                                            onClick={() => setSelectedId(a.id)}
                                            style={{ cursor: "pointer", background: selectedId === a.id ? "var(--dg-teal-50)" : undefined }}
                                        >
                                            <td><b>{patientFor(a.patientId)}</b></td>
                                            <td><b>{a.date}</b><small>{a.time}</small></td>
                                            <td>{doctorFor(a.doctorId)}</td>
                                            <td><Badge status={a.status} /></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card" style={{ padding: 18, position: "sticky", top: 20 }}>
                    {!selected ? (
                        <div className="empty" style={{ padding: "30px 0" }}>Select an appointment<br /><small>Its full history will show here</small></div>
                    ) : (
                        <>
                            <div style={{ marginBottom: 14 }}>
                                <strong style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 5 }}>
                                    <User size={14} />{patientFor(selected.patientId)}
                                </strong>
                                <div className="muted" style={{ fontSize: 12 }}>{selected.date} · {selected.time} · {doctorFor(selected.doctorId)} · {selected.treatment}</div>
                            </div>

                            {timeline.length === 0 ? (
                                <div className="empty" style={{ padding: "20px 0" }}>No history recorded yet for this appointment.</div>
                            ) : (
                                <div style={{ display: "grid", gap: 10, maxHeight: 460, overflowY: "auto" }}>
                                    {timeline.map((e) => {
                                        const Icon = actionIcon(e.action);
                                        return (
                                            <div key={e.id} className="card" style={{ padding: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
                                                <span style={{ color: "var(--dg-teal-600)", marginTop: 2 }}><Icon size={15} /></span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <strong style={{ fontSize: 13, display: "block" }}>{actionLabel(e.action)}</strong>
                                                    <span style={{ fontSize: 12, color: "var(--dg-muted)" }}>{e.detail}</span>
                                                    <small className="muted" style={{ display: "block", marginTop: 2 }}>
                                                        {new Date(e.at).toLocaleString()} · {e.byEmail}
                                                    </small>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
