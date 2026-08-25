"use client";

import { FormEvent, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Stethoscope, Plus, Pencil, CalendarClock, Trash2, Phone, Mail } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import type { AvailabilitySlot, DayOfWeek, Doctor } from "@/lib/types";
import Drawer from "@/components/ui/Drawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PillLoader from "@/components/PillLoader";

const DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLORS = ["#087f78", "#0369a1", "#c026d3", "#b45309", "#4338ca", "#0f766e"];

function initials(name: string) {
    return name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
}

function emptySlot(): AvailabilitySlot {
    return { day: "Mon", startTime: "09:00", endTime: "17:00", slotDurationMins: 30 };
}

export default function DoctorsPage() {
    const { data: doctors, loading } = useCollection<Doctor>("doctors");
    const showToast = useToast();

    const [drawerMode, setDrawerMode] = useState<"profile" | "availability" | null>(null);
    const [editing, setEditing] = useState<Doctor | null>(null);
    const [deleting, setDeleting] = useState<Doctor | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

    function openCreate() {
        setEditing(null);
        setDrawerMode("profile");
    }

    function openEdit(doctor: Doctor) {
        setEditing(doctor);
        setDrawerMode("profile");
    }

    function openAvailability(doctor: Doctor) {
        setEditing(doctor);
        setSlots(doctor.weeklyAvailability.length ? doctor.weeklyAvailability : [emptySlot()]);
        setDrawerMode("availability");
    }

    async function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        const f = new FormData(e.currentTarget);
        const name = String(f.get("name") || "").trim();
        const specialty = String(f.get("specialty") || "").trim();
        const phone = String(f.get("phone") || "").trim();
        const email = String(f.get("email") || "").trim();
        const consultationFee = Number(f.get("consultationFee")) || 0;

        if (!name || !specialty) {
            showToast("Please enter the doctor's name and specialty", "error");
            setSubmitting(false);
            return;
        }

        try {
            if (editing) {
                await updateDoc(doc(db, "doctors", editing.id), { name, specialty, phone, email, consultationFee });
                showToast("Doctor details updated");
            } else {
                const photoColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                await addDoc(collection(db, "doctors"), {
                    name, specialty, phone, email, photoColor, consultationFee,
                    weeklyAvailability: [], blockedDates: [], createdAt: Date.now()
                });
                showToast("Doctor added");
            }
            setDrawerMode(null);
        } catch {
            showToast("Something went wrong saving the doctor", "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleAvailabilitySubmit(e: FormEvent) {
        e.preventDefault();
        if (!editing) return;
        setSubmitting(true);
        try {
            await updateDoc(doc(db, "doctors", editing.id), { weeklyAvailability: slots });
            showToast(`Weekly availability updated for ${editing.name}`);
            setDrawerMode(null);
        } catch {
            showToast("Couldn't save availability", "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function confirmDelete() {
        if (!deleting) return;
        setSubmitting(true);
        try {
            await deleteDoc(doc(db, "doctors", deleting.id));
            showToast("Doctor removed");
            setDeleting(null);
        } catch {
            showToast("Couldn't delete doctor", "error");
        } finally {
            setSubmitting(false);
        }
    }

    function updateSlot(index: number, patch: Partial<AvailabilitySlot>) {
        setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    }

    if (loading) return <PillLoader label="Loading doctors…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Doctors</h1>
                    <p>Manage doctor profiles and set the weekly availability that generates bookable slots.</p>
                </div>
                <button className="primary" onClick={openCreate}><Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Add Doctor</button>
            </div>

            {doctors.length === 0 ? (
                <div className="card empty">
                    <Stethoscope size={22} /><br />
                    <strong>No doctors yet</strong><br />
                    Add your first doctor to start building the schedule.
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                    {doctors.map((d) => (
                        <div className="card" key={d.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{
                                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                                    background: d.photoColor || "#087f78", color: "#fff",
                                    display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14
                                }}>{initials(d.name)}</span>
                                <div>
                                    <strong style={{ fontSize: 14 }}>{d.name}</strong>
                                    <div className="muted">{d.specialty}</div>
                                </div>
                            </div>
                            <div style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--dg-muted)" }}>
                                {d.phone && <span><Phone size={12} style={{ verticalAlign: -1, marginRight: 6 }} />{d.phone}</span>}
                                {d.email && <span><Mail size={12} style={{ verticalAlign: -1, marginRight: 6 }} />{d.email}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--dg-teal-700)", fontWeight: 600 }}>
                                {d.weeklyAvailability.length === 0
                                    ? "No availability set"
                                    : [...new Set(d.weeklyAvailability.map((s) => s.day))].join(", ")}
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                <button className="quickDemoBtn" style={{ flex: 1, margin: 0 }} onClick={() => openAvailability(d)}>
                                    <CalendarClock size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Availability
                                </button>
                                <button className="quickDemoBtn" style={{ margin: 0 }} onClick={() => openEdit(d)}><Pencil size={13} /></button>
                                <button className="quickDemoBtn" style={{ margin: 0, color: "#dc2626" }} onClick={() => setDeleting(d)}><Trash2 size={13} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {drawerMode === "profile" && (
                <Drawer
                    title={editing ? "Edit Doctor" : "Add Doctor"}
                    subtitle={editing ? editing.name : "Register a new doctor on the clinic roster"}
                    onClose={() => setDrawerMode(null)}
                    footer={<>
                        <button type="button" onClick={() => setDrawerMode(null)}>Cancel</button>
                        <button type="submit" form="doctor-form" className="primary" disabled={submitting}>
                            {submitting ? "Saving…" : "Save Doctor"}
                        </button>
                    </>}
                >
                    <form id="doctor-form" onSubmit={handleProfileSubmit} style={{ display: "grid", gap: 15 }}>
                        <label>Full Name
                            <input name="name" defaultValue={editing?.name} placeholder="Dr. Jane Doe" required />
                        </label>
                        <label>Specialty
                            <input name="specialty" defaultValue={editing?.specialty} placeholder="Orthodontics" required />
                        </label>
                        <div className="two">
                            <label>Phone
                                <input name="phone" defaultValue={editing?.phone} placeholder="+91 90000 00000" />
                            </label>
                            <label>Email
                                <input name="email" type="email" defaultValue={editing?.email} placeholder="doctor@dentigo.dev" />
                            </label>
                        </div>
                        <label>Consultation Fee (₹)
                            <input name="consultationFee" type="number" min={0} defaultValue={editing?.consultationFee || ""} placeholder="500" />
                            <small className="muted">Pre-fills the doctor fee at POS checkout — staff can still override it per visit.</small>
                        </label>
                    </form>
                </Drawer>
            )}

            {drawerMode === "availability" && editing && (
                <Drawer
                    title="Weekly Availability"
                    subtitle={editing.name}
                    onClose={() => setDrawerMode(null)}
                    footer={<>
                        <button type="button" onClick={() => setDrawerMode(null)}>Cancel</button>
                        <button type="submit" form="availability-form" className="primary" disabled={submitting}>
                            {submitting ? "Saving…" : "Save Availability"}
                        </button>
                    </>}
                >
                    <form id="availability-form" onSubmit={handleAvailabilitySubmit} style={{ display: "grid", gap: 12 }}>
                        {slots.map((slot, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                                <label>Day
                                    <select value={slot.day} onChange={(e) => updateSlot(i, { day: e.target.value as DayOfWeek })}>
                                        {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </label>
                                <label>Start
                                    <input type="time" value={slot.startTime} onChange={(e) => updateSlot(i, { startTime: e.target.value })} />
                                </label>
                                <label>End
                                    <input type="time" value={slot.endTime} onChange={(e) => updateSlot(i, { endTime: e.target.value })} />
                                </label>
                                <button type="button" className="quickDemoBtn" style={{ margin: 0, height: 40 }}
                                    onClick={() => setSlots((prev) => prev.filter((_, idx) => idx !== i))}>
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                        <button type="button" className="quickDemoBtn" onClick={() => setSlots((prev) => [...prev, emptySlot()])}>
                            + Add a day
                        </button>
                    </form>
                </Drawer>
            )}

            {deleting && (
                <ConfirmModal
                    title="Remove doctor?"
                    message={`This removes ${deleting.name} from the roster. Existing appointments and prescriptions referencing them are kept as-is.`}
                    confirmLabel="Remove"
                    danger
                    loading={submitting}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </>
    );
}
