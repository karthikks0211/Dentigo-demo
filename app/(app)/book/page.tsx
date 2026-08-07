"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection } from "firebase/firestore";
import { Check, ChevronLeft } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { getAvailableSlots, nextNDates } from "@/lib/scheduling";
import type { Appointment, Doctor, Patient } from "@/lib/types";
import PillLoader from "@/components/PillLoader";

function initials(name: string) {
    return name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
}

const STEPS = ["Doctor", "Time Slot", "Confirm"];

export default function BookPage() {
    const router = useRouter();
    const showToast = useToast();
    const { data: doctors, loading: loadingDoctors } = useCollection<Doctor>("doctors");
    const { data: patients, loading: loadingPatients } = useCollection<Patient>("patients");
    const { data: appointments } = useCollection<Appointment>("appointments");

    const [step, setStep] = useState(1);
    const [doctorId, setDoctorId] = useState<string | null>(null);
    const [date, setDate] = useState(nextNDates(14)[0]);
    const [time, setTime] = useState<string | null>(null);
    const [patientId, setPatientId] = useState<string | null>(null);
    const [treatment, setTreatment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const doctor = doctors.find((d) => d.id === doctorId) || null;
    const patient = patients.find((p) => p.id === patientId) || null;
    const dates = useMemo(() => nextNDates(14), []);
    const slots = useMemo(() => (doctor ? getAvailableSlots(doctor, date, appointments) : []), [doctor, date, appointments]);

    async function confirmBooking() {
        if (!doctor || !patient || !time || !treatment.trim()) {
            showToast("Please complete every step before confirming", "error");
            return;
        }
        setSubmitting(true);
        try {
            await addDoc(collection(db, "appointments"), {
                patientId: patient.id, doctorId: doctor.id, date, time,
                treatment: treatment.trim(), status: "Confirmed", createdAt: Date.now()
            });
            showToast(`Booked ${treatment.trim()} for ${patient.name} with ${doctor.name}`);
            router.push("/appointments");
        } catch {
            showToast("Couldn't book the appointment", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (loadingDoctors || loadingPatients) return <PillLoader label="Loading booking data…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Book Appointment</h1>
                    <p>Doctor → time slot → confirm.</p>
                </div>
            </div>

            <div className="wizardSteps">
                {STEPS.map((label, i) => {
                    const n = i + 1;
                    const state = n === step ? "active" : n < step ? "done" : "";
                    return (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, flex: n < 3 ? "0 0 auto" : undefined }}>
                            <div className={`wizardStep ${state}`}>
                                <b>{n < step ? <Check size={13} /> : n}</b>{label}
                            </div>
                            {n < 3 && <div className="wizardLine" />}
                        </div>
                    );
                })}
            </div>

            {step === 1 && (
                <div className="card">
                    {doctors.length === 0 ? (
                        <div className="empty"><strong>No doctors yet</strong><br />Add a doctor first from the Doctors page.</div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                            {doctors.map((d) => (
                                <button key={d.id} className={`pickCard ${doctorId === d.id ? "selected" : ""}`} onClick={() => setDoctorId(d.id)}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ width: 38, height: 38, borderRadius: "50%", background: d.photoColor || "#087f78", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12 }}>{initials(d.name)}</span>
                                        <div>
                                            <strong style={{ fontSize: 13, display: "block" }}>{d.name}</strong>
                                            <span className="muted">{d.specialty}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="wizardFoot">
                        <span />
                        <button className="primary" disabled={!doctorId} onClick={() => setStep(2)}>Next: Time Slot</button>
                    </div>
                </div>
            )}

            {step === 2 && doctor && (
                <div className="card">
                    <p className="muted" style={{ marginBottom: 12 }}>Booking with <b style={{ color: "var(--dg-ink)" }}>{doctor.name}</b></p>
                    <div className="dateChipRow">
                        {dates.map((d) => {
                            const dt = new Date(d + "T00:00:00");
                            return (
                                <div key={d} className={`dateChip ${date === d ? "active" : ""}`} onClick={() => { setDate(d); setTime(null); }}>
                                    <small>{dt.toLocaleDateString(undefined, { weekday: "short" })}</small>
                                    <strong>{dt.getDate()}</strong>
                                </div>
                            );
                        })}
                    </div>
                    {slots.length === 0 ? (
                        <div className="empty"><strong>No open slots this day</strong><br />Try another date or check this doctor's weekly availability.</div>
                    ) : (
                        <div className="slotGrid">
                            {slots.map((s) => (
                                <button key={s} className={`slotBtn ${time === s ? "active" : ""}`} onClick={() => setTime(s)}>{s}</button>
                            ))}
                        </div>
                    )}
                    <div className="wizardFoot">
                        <button onClick={() => setStep(1)}><ChevronLeft size={14} style={{ verticalAlign: -2 }} />Back</button>
                        <button className="primary" disabled={!time} onClick={() => setStep(3)}>Next: Confirm</button>
                    </div>
                </div>
            )}

            {step === 3 && doctor && (
                <div className="card">
                    <div style={{ display: "grid", gap: 15, maxWidth: 420 }}>
                        <label>Patient
                            <select value={patientId || ""} onChange={(e) => setPatientId(e.target.value || null)}>
                                <option value="">Select a patient…</option>
                                {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </label>
                        <label>Treatment
                            <input value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="Routine Checkup" />
                        </label>

                        <div className="card" style={{ background: "var(--dg-teal-50)", border: "1px solid var(--dg-teal-100)" }}>
                            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "var(--dg-teal-700)" }}>Summary</p>
                            <p style={{ margin: 0, fontSize: 13 }}>{doctor.name} · {new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} · {time}</p>
                        </div>
                    </div>
                    <div className="wizardFoot">
                        <button onClick={() => setStep(2)}><ChevronLeft size={14} style={{ verticalAlign: -2 }} />Back</button>
                        <button className="primary" disabled={submitting} onClick={confirmBooking}>
                            {submitting ? "Booking…" : "Confirm Booking"}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
