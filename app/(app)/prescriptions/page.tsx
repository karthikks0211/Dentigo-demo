"use client";

import { FormEvent, useMemo, useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { Plus, Search, Trash2, Beaker, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { planDispense, type DispensePlan } from "@/lib/pharmacy";
import { logAppointmentEvent } from "@/lib/audit";
import type { Prescription, PrescriptionMedicine, Patient, Doctor, Medicine, Appointment } from "@/lib/types";
import Drawer from "@/components/ui/Drawer";
import PillLoader from "@/components/PillLoader";

function emptyLine(): PrescriptionMedicine {
    return { medicineId: "", name: "", dosage: "1 tablet", frequency: "Twice daily", durationDays: 5, quantity: 10 };
}

export default function PrescriptionsPage() {
    const { data: prescriptions, loading } = useCollection<Prescription>("prescriptions");
    const { data: patients } = useCollection<Patient>("patients");
    const { data: doctors } = useCollection<Doctor>("doctors");
    const { data: medicines } = useCollection<Medicine>("medicines");
    const { data: appointments } = useCollection<Appointment>("appointments");
    const showToast = useToast();
    const { user } = useAuth();
    const actorEmail = user?.email || "unknown";

    const [query, setQuery] = useState("");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [lines, setLines] = useState<PrescriptionMedicine[]>([emptyLine()]);
    const [formPatientId, setFormPatientId] = useState("");
    const [formAppointmentId, setFormAppointmentId] = useState("");
    const [formDiagnosis, setFormDiagnosis] = useState("");

    // Appointments for whichever patient is picked — so the prescription can
    // be tied to the specific visit it was written during. That link is what
    // lets POS find "the" prescription to bill for a token.
    const appointmentsForFormPatient = useMemo(
        () => appointments
            .filter((a) => a.patientId === formPatientId && a.status !== "Cancelled")
            .sort((a, b) => (a.date < b.date ? 1 : -1)),
        [appointments, formPatientId]
    );

    const [dispensing, setDispensing] = useState<Prescription | null>(null);
    const [plan, setPlan] = useState<DispensePlan | null>(null);
    const [planLoading, setPlanLoading] = useState(false);
    const [committing, setCommitting] = useState(false);

    const patientFor = (id: string) => patients.find((p) => p.id === id)?.name || "Unknown patient";
    const doctorFor = (id: string) => doctors.find((d) => d.id === id)?.name || "Unassigned";

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return [...prescriptions]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .filter((rx) =>
                patientFor(rx.patientId).toLowerCase().includes(q) ||
                rx.diagnosis.toLowerCase().includes(q) ||
                rx.medicines.some((m) => m.name.toLowerCase().includes(q))
            );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prescriptions, query, patients]);

    function updateLine(i: number, patch: Partial<PrescriptionMedicine>) {
        setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const patientId = String(f.get("patient") || "");
        const doctorId = String(f.get("doctor") || "");
        const appointmentId = String(f.get("appointmentId") || "");
        const diagnosis = String(f.get("diagnosis") || "").trim();
        const notes = String(f.get("notes") || "");
        const validLines = lines.filter((l) => l.medicineId && l.quantity > 0);

        if (!patientId || !doctorId || !appointmentId || !diagnosis) {
            showToast("Please select patient, doctor, the visit, and enter a diagnosis", "error");
            return;
        }
        if (validLines.length === 0) {
            showToast("Add at least one medicine to the prescription", "error");
            return;
        }

        setSubmitting(true);
        try {
            await addDoc(collection(db, "prescriptions"), {
                patientId, doctorId, appointmentId, diagnosis, notes,
                medicines: validLines,
                date: new Date().toISOString().slice(0, 10),
                readyForPos: false,
                dispensed: false,
                createdAt: Date.now()
            });
            await logAppointmentEvent({
                appointmentId,
                action: "PrescriptionCreated",
                detail: `${diagnosis} — ${validLines.map((l) => l.name).join(", ")}`,
                byEmail: actorEmail
            });
            showToast("Prescription created");
            setDrawerOpen(false);
            setLines([emptyLine()]);
            setFormPatientId("");
            setFormAppointmentId("");
            setFormDiagnosis("");
        } catch {
            showToast("Couldn't save the prescription", "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function openDispense(rx: Prescription) {
        setDispensing(rx);
        setPlan(null);
        setPlanLoading(true);
        try {
            const computed = await planDispense(rx);
            setPlan(computed);
        } catch {
            showToast("Couldn't compute stock allocation", "error");
            setDispensing(null);
        } finally {
            setPlanLoading(false);
        }
    }

    // Stock is only ever deducted at the moment POS payment is confirmed —
    // this just flags the prescription so it shows up as a pending line on
    // its token in POS. See lib/pos.ts's checkoutVisit for the actual commit.
    async function confirmDispense() {
        if (!dispensing || !plan || plan.shortfalls.length > 0) return;
        setCommitting(true);
        try {
            await updateDoc(doc(db, "prescriptions", dispensing.id), { readyForPos: true });
            await logAppointmentEvent({
                appointmentId: dispensing.appointmentId,
                action: "PrescriptionSentToPos",
                detail: `${dispensing.medicines.map((m) => m.name).join(", ")} — est. ₹${plan.totalAmount.toLocaleString()}`,
                byEmail: actorEmail
            });
            showToast("Sent to POS — pay it there to deduct stock and collect payment");
            setDispensing(null);
            setPlan(null);
        } catch (err: any) {
            showToast(err?.message || "Couldn't send to POS", "error");
        } finally {
            setCommitting(false);
        }
    }

    if (loading) return <PillLoader label="Loading prescriptions…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Prescriptions</h1>
                    <p>Write prescriptions and click Dispense to send them to POS — stock is deducted (FEFO) only once paid there.</p>
                </div>
                <button className="primary" onClick={() => { setLines([emptyLine()]); setFormPatientId(""); setFormAppointmentId(""); setFormDiagnosis(""); setDrawerOpen(true); }}>
                    <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />New Prescription
                </button>
            </div>

            <div className="card tableCard">
                <div className="tableTools">
                    <div className="search">
                        <Search size={15} className="searchIcon" />
                        <input placeholder="Search prescriptions…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Patient</th>
                                <th>Diagnosis</th>
                                <th>Medicines</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty">⌕<br /><strong>No prescriptions found</strong></div></td></tr>
                            ) : (
                                filtered.map((rx) => (
                                    <tr key={rx.id}>
                                        <td><b>{patientFor(rx.patientId)}</b><small>{doctorFor(rx.doctorId)}</small></td>
                                        <td>{rx.diagnosis}</td>
                                        <td>
                                            <span style={{ fontSize: 12 }}>{rx.medicines.map((m) => m.name).join(", ")}</span>
                                            <span className="medCountBadge" style={{ display: "block", width: "fit-content", marginTop: 4 }}>{rx.medicines.length} medicine{rx.medicines.length === 1 ? "" : "s"}</span>
                                        </td>
                                        <td>{rx.date}</td>
                                        <td>
                                            {rx.dispensed
                                                ? <span className="badge completed"><i />Dispensed</span>
                                                : rx.readyForPos
                                                    ? <span className="badge confirmed"><i />Awaiting payment in POS</span>
                                                    : <span className="badge pending"><i />Not dispensed</span>}
                                        </td>
                                        <td>
                                            {!rx.dispensed && !rx.readyForPos && (
                                                <button className="quickDemoBtn" style={{ margin: 0 }} onClick={() => openDispense(rx)}>
                                                    <Beaker size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Dispense
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {drawerOpen && (
                <Drawer
                    title="New Prescription"
                    subtitle="Add medicine lines with dosage, frequency, and duration"
                    onClose={() => setDrawerOpen(false)}
                    footer={<>
                        <button type="button" onClick={() => setDrawerOpen(false)}>Cancel</button>
                        <button type="submit" form="rx-form" className="primary" disabled={submitting}>
                            {submitting ? "Saving…" : "Save Prescription"}
                        </button>
                    </>}
                >
                    <form id="rx-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 15 }}>
                        <div className="two">
                            <label>Patient
                                <select
                                    name="patient" required value={formPatientId}
                                    onChange={(e) => { setFormPatientId(e.target.value); setFormAppointmentId(""); setFormDiagnosis(""); }}
                                >
                                    <option value="" disabled>Select patient…</option>
                                    {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </label>
                            <label>Doctor
                                <select name="doctor" required defaultValue="">
                                    <option value="" disabled>Select doctor…</option>
                                    {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </label>
                        </div>
                        <label>Appointment / Visit
                            <select
                                name="appointmentId" required value={formAppointmentId}
                                onChange={(e) => {
                                    setFormAppointmentId(e.target.value);
                                    const appt = appointmentsForFormPatient.find((a) => a.id === e.target.value);
                                    if (appt) setFormDiagnosis(appt.treatment);
                                }}
                            >
                                <option value="" disabled>{formPatientId ? "Select the visit this is for…" : "Select a patient first…"}</option>
                                {appointmentsForFormPatient.map((a) => (
                                    <option key={a.id} value={a.id}>{a.date} · {a.time} · {a.treatment}</option>
                                ))}
                            </select>
                        </label>
                        <label>Diagnosis
                            <input
                                name="diagnosis" placeholder="Gingivitis" required
                                value={formDiagnosis} onChange={(e) => setFormDiagnosis(e.target.value)}
                            />
                            <small className="muted">Auto-filled from the selected visit&rsquo;s treatment — edit as needed.</small>
                        </label>

                        <div style={{ display: "grid", gap: 10 }}>
                            <strong style={{ fontSize: 13 }}>Medicines</strong>
                            {lines.map((line, i) => (
                                <div key={i} className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
                                    <div className="two">
                                        <label>Medicine
                                            <select
                                                value={line.medicineId}
                                                onChange={(e) => {
                                                    const med = medicines.find((m) => m.id === e.target.value);
                                                    updateLine(i, { medicineId: e.target.value, name: med?.name || "" });
                                                }}
                                            >
                                                <option value="">Select…</option>
                                                {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                            </select>
                                        </label>
                                        <label>Quantity
                                            <input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                                        </label>
                                    </div>
                                    <div className="two">
                                        <label>Dosage
                                            <input value={line.dosage} onChange={(e) => updateLine(i, { dosage: e.target.value })} />
                                        </label>
                                        <label>Frequency
                                            <input value={line.frequency} onChange={(e) => updateLine(i, { frequency: e.target.value })} />
                                        </label>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
                                        <label style={{ flex: 1 }}>Duration (days)
                                            <input type="number" min={1} value={line.durationDays} onChange={(e) => updateLine(i, { durationDays: Number(e.target.value) })} />
                                        </label>
                                        <button type="button" className="quickDemoBtn" style={{ margin: 0, height: 40 }} onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" className="quickDemoBtn" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                                + Add medicine
                            </button>
                        </div>

                        <label>Notes
                            <textarea name="notes" placeholder="Optional notes for the patient" />
                        </label>
                    </form>
                </Drawer>
            )}

            {dispensing && (
                <Drawer
                    title="Dispense Prescription"
                    subtitle={`${patientFor(dispensing.patientId)} · ${dispensing.diagnosis}`}
                    onClose={() => setDispensing(null)}
                    footer={<>
                        <button type="button" onClick={() => setDispensing(null)}>Cancel</button>
                        <button
                            type="button"
                            className="primary"
                            disabled={planLoading || committing || !plan || plan.shortfalls.length > 0}
                            onClick={confirmDispense}
                        >
                            {committing ? "Sending…" : "Dispense — Send to POS"}
                        </button>
                    </>}
                >
                    {planLoading || !plan ? (
                        <PillLoader label="Allocating stock (FEFO)…" />
                    ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                            <p className="muted" style={{ margin: 0 }}>Earliest-expiring batches are previewed here (FEFO), but stock is only actually deducted when this is paid at POS. This adds it as a pending line on the patient&rsquo;s token there.</p>
                            {plan.lines.map((l, i) => (
                                <div key={i} className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <strong style={{ fontSize: 13, display: "block" }}>{l.name}</strong>
                                        <span className="muted">Batch {l.batchNo} · {l.qty} units</span>
                                    </div>
                                    <strong>₹{l.total.toLocaleString()}</strong>
                                </div>
                            ))}
                            {plan.shortfalls.length > 0 && (
                                <div className="card" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                                    <strong style={{ color: "#dc2626", fontSize: 13 }}>Not enough stock</strong>
                                    {plan.shortfalls.map((s, i) => (
                                        <p key={i} style={{ margin: "4px 0 0", fontSize: 12, color: "#991b1b" }}>
                                            {s.name}: short by {s.missing} units. Receive a purchase order before dispensing.
                                        </p>
                                    ))}
                                </div>
                            )}
                            {plan.shortfalls.length === 0 && (
                                <div className="card" style={{ background: "var(--dg-teal-50)", border: "1px solid var(--dg-teal-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--dg-teal-700)" }}>
                                        <CheckCircle2 size={15} />Total
                                    </span>
                                    <strong>₹{plan.totalAmount.toLocaleString()}</strong>
                                </div>
                            )}
                        </div>
                    )}
                </Drawer>
            )}
        </>
    );
}
