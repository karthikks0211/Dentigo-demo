"use client";

import Link from "next/link";
import { ArrowUpRight, Circle, Compass } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import PillLoader from "@/components/PillLoader";
import { useTour } from "@/lib/tour-context";
import type { Patient, Doctor, Appointment, Payment, Employee, AttendanceEntry } from "@/lib/types";

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function initials(n: string) {
    if (!n) return "?";
    return n.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
}

const demoSteps = [
    { label: "Add a doctor and set their weekly availability", href: "/doctors" },
    { label: "Book an appointment for a patient", href: "/book" },
    { label: "Mark the appointment Completed once the visit is done", href: "/appointments" },
    { label: "Write a prescription for the patient and send it to POS", href: "/prescriptions" },
    { label: "Settle the patient's token — dispense (FEFO) and pay — on Point of Sale", href: "/pos" },
    { label: "Check its status history on the Appointment Audit Log", href: "/appointments/audit-log" },
    { label: "Mark today's staff attendance", href: "/hr/attendance" },
    { label: "Generate this month's payroll", href: "/hr/payroll" },
    { label: "Check the ledger and revenue report reflect every payment", href: "/ledger" }
];

export default function DashboardPage() {
    const { startTour } = useTour();
    const { data: patients, loading: loadingPatients } = useCollection<Patient>("patients");
    const { data: doctors } = useCollection<Doctor>("doctors");
    const { data: appointments, loading: loadingAppts } = useCollection<Appointment>("appointments");
    const { data: payments } = useCollection<Payment>("payments");
    const { data: employees } = useCollection<Employee>("employees");
    const { data: attendance } = useCollection<AttendanceEntry>("attendance");

    const loading = loadingPatients || loadingAppts;
    const today = todayIso();
    const todayAppts = appointments.filter((a) => a.date === today);
    const pendingAppts = appointments.filter((a) => a.status === "Pending");
    const revenue = payments.reduce((sum, p) => sum + p.amount, 0);

    const todaysPayments = payments.filter((p) => p.date === today);
    const revenueToday = todaysPayments.reduce((sum, p) => sum + p.amount, 0);
    const activeEmployees = employees.filter((e) => e.active);
    const presentToday = attendance.filter((a) => a.date === today && (a.status === "Present" || a.status === "Half Day")).length;

    const patientFor = (id: string) => patients.find((p) => p.id === id)?.name || "Unknown patient";
    const doctorFor = (id: string) => doctors.find((d) => d.id === id)?.name || "Unassigned";

    if (loading) {
        return <PillLoader label="Loading your dashboard…" />;
    }

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Welcome to DentiGO</h1>
                    <p>Here&rsquo;s what&rsquo;s happening at the clinic today.</p>
                </div>
            </div>

            <div className="stats">
                <div className="stat heroStat">
                    <div className="statTop"><p>Total Patients</p></div>
                    <h2>{patients.length}</h2>
                    <div className="statBottom"><small className="statSubtitle">across the clinic</small></div>
                </div>
                <div className="stat">
                    <div className="statTop"><p>Today&rsquo;s Appointments</p></div>
                    <h2>{String(todayAppts.length).padStart(2, "0")}</h2>
                    <div className="statBottom"><small className="statSubtitle">scheduled today</small></div>
                </div>
                <div className="stat">
                    <div className="statTop"><p>Pending Appointments</p></div>
                    <h2>{String(pendingAppts.length).padStart(2, "0")}</h2>
                    <div className="statBottom"><small className="statSubtitle">need confirmation</small></div>
                </div>
                <div className="stat">
                    <div className="statTop"><p>Revenue Collected</p></div>
                    <h2>₹ {revenue.toLocaleString()}</h2>
                    <div className="statBottom"><small className="statSubtitle">from recorded payments</small></div>
                </div>
            </div>

            <div className="stats" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                <div className="stat">
                    <div className="statTop"><p>Revenue Today</p></div>
                    <h2>₹ {revenueToday.toLocaleString()}</h2>
                    <div className="statBottom"><small className="statSubtitle">{todaysPayments.length} payment{todaysPayments.length === 1 ? "" : "s"} collected</small></div>
                </div>
                <div className="stat">
                    <div className="statTop"><p>Staff Present Today</p></div>
                    <h2>{presentToday}/{activeEmployees.length}</h2>
                    <div className="statBottom"><small className="statSubtitle">of active employees</small></div>
                </div>
            </div>

            <div className="bottomGrid">
                <div className="card appointments">
                    <div className="cardHead">
                        <div>
                            <h3>Today&rsquo;s Appointments</h3>
                            <p className="subtitle">{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                        </div>
                        <Link href="/appointments" className="cardActionBtn" aria-label="View all appointments">
                            <ArrowUpRight size={15} />
                        </Link>
                    </div>
                    <div className="apptList">
                        {todayAppts.length === 0 ? (
                            <div className="empty">
                                ⌕<br />
                                <strong>No appointments today</strong><br />
                                Book one from the Appointments section.
                            </div>
                        ) : (
                            todayAppts.map((a) => (
                                <div className="appt" key={a.id}>
                                    <div className="avatar">{initials(patientFor(a.patientId))}</div>
                                    <div className="apptName">
                                        <strong>{patientFor(a.patientId)}</strong>
                                        <span>{a.treatment} · {doctorFor(a.doctorId)}</span>
                                    </div>
                                    <div className="apptTime">{a.time}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="card quick">
                    <div className="cardHead">
                        <div>
                            <h3>Run the Demo Script</h3>
                            <p className="subtitle">Click through end-to-end</p>
                        </div>
                        <button className="cardActionBtn" aria-label="Start guided walkthrough" title="Start guided walkthrough" onClick={startTour}>
                            <Compass size={15} />
                        </button>
                    </div>
                    {demoSteps.map((step, i) => (
                        <Link key={i} href={step.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", textDecoration: "none", color: "inherit" }}>
                            <Circle size={14} style={{ color: "var(--dg-teal-500)", flexShrink: 0 }} />
                            <span style={{ fontSize: 13 }}>{step.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </>
    );
}
