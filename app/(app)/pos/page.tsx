"use client";

import { useMemo, useState } from "react";
import { Banknote, CreditCard, Sparkles, User, AlertTriangle, Search } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { planDispense, type DispensePlan } from "@/lib/pharmacy";
import { checkoutVisit } from "@/lib/pos";
import { consultationToPreview, pharmacyToPreview, type InvoicePreviewData } from "@/lib/invoice-preview";
import type {
    Appointment, Patient, Doctor, Prescription, DiagnosisReport,
    ConsultationInvoice, PharmacyInvoice, PaymentMethod
} from "@/lib/types";
import Badge from "@/components/ui/Badge";
import InvoicePreviewModal from "@/components/InvoicePreviewModal";
import PaymentSimModal from "@/components/PaymentSimModal";
import PaymentSuccessOverlay from "@/components/PaymentSuccessOverlay";
import PillLoader from "@/components/PillLoader";

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

// "09:30 AM" -> 570, so today's tokens sort into visit order.
function timeToMinutes(label: string): number {
    const m = label.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return 0;
    let h = Number(m[1]) % 12;
    if (m[3].toUpperCase() === "PM") h += 12;
    return h * 60 + Number(m[2]);
}

type SalesRow = {
    id: string;
    type: "Consultation" | "Pharmacy";
    invoiceNo: string;
    patientId: string;
    description: string;
    amount: number;
};

export default function PosPage() {
    const { data: appointments, loading: l1 } = useCollection<Appointment>("appointments");
    const { data: patients, loading: l2 } = useCollection<Patient>("patients");
    const { data: doctors, loading: l3 } = useCollection<Doctor>("doctors");
    const { data: prescriptions, loading: l4 } = useCollection<Prescription>("prescriptions");
    const { data: diagnosisReports, loading: l5 } = useCollection<DiagnosisReport>("diagnosisReports");
    const { data: consultationInvoices, loading: l6 } = useCollection<ConsultationInvoice>("consultationInvoices");
    const { data: pharmacyInvoices, loading: l7 } = useCollection<PharmacyInvoice>("pharmacyInvoices");
    const showToast = useToast();
    const { user } = useAuth();
    const actorEmail = user?.email || "unknown";

    const [date, setDate] = useState(todayIso());
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [doctorFeeInput, setDoctorFeeInput] = useState("");
    const [activePrescription, setActivePrescription] = useState<Prescription | null>(null);
    const [dispensePlan, setDispensePlan] = useState<DispensePlan | null>(null);
    const [planLoading, setPlanLoading] = useState(false);
    const [checkingOut, setCheckingOut] = useState(false);
    const [showRazorpay, setShowRazorpay] = useState(false);
    const [previewInvoice, setPreviewInvoice] = useState<InvoicePreviewData | null>(null);
    const [paidInfo, setPaidInfo] = useState<{ amount: number; method: PaymentMethod } | null>(null);

    const patientFor = (id: string) => patients.find((p) => p.id === id)?.name || "Unknown patient";
    const doctorFor = (id: string) => doctors.find((d) => d.id === id) || null;

    const alreadyInvoicedAppointmentIds = useMemo(
        () => new Set(consultationInvoices.map((i) => i.appointmentId)),
        [consultationInvoices]
    );

    const tokens = useMemo(() => {
        const q = search.trim().toLowerCase();
        return appointments
            .filter((a) => a.date === date && a.status !== "Cancelled")
            .filter((a) => !q || patientFor(a.patientId).toLowerCase().includes(q) || a.treatment.toLowerCase().includes(q))
            .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appointments, date, search, patients]);

    const tokenNumber = useMemo(() => {
        const map = new Map<string, number>();
        tokens.forEach((a, i) => map.set(a.id, i + 1));
        return map;
    }, [tokens]);

    // Strict match by token: only a prescription staff have explicitly sent to
    // POS (clicked Dispense) for this exact appointment shows up here — no more
    // patient-level guessing.
    function findPrescriptionFor(appt: Appointment): Prescription | null {
        return prescriptions.find((p) => p.appointmentId === appt.id && p.readyForPos && !p.dispensed) || null;
    }

    const selected = useMemo(() => appointments.find((a) => a.id === selectedId) || null, [appointments, selectedId]);
    const selectedDoctor = selected ? doctorFor(selected.doctorId) : null;
    const consultationBilled = selected ? alreadyInvoicedAppointmentIds.has(selected.id) : false;

    // Only reports not yet folded into a payment — once billed:true a report
    // drops off the tab, so reopening a token later (after paying) doesn't
    // recharge it.
    const scanReports = useMemo(
        () => (selected ? diagnosisReports.filter((r) => r.appointmentId === selected.id && !r.billed) : []),
        [diagnosisReports, selected]
    );
    const scanFeeTotal = scanReports.reduce((sum, r) => sum + (r.fee || 0), 0);

    const doctorFee = consultationBilled ? 0 : Number(doctorFeeInput) || 0;
    const consultationAmount = doctorFee + scanFeeTotal;
    const pharmacyAmount = dispensePlan?.totalAmount || 0;
    const totalAmount = consultationAmount + pharmacyAmount;
    const hasShortfalls = !!dispensePlan && dispensePlan.shortfalls.length > 0;
    const isCompleted = selected?.status === "Completed";
    // totalAmount already excludes the doctor fee once the consultation is
    // billed elsewhere (see doctorFee above) — an unbilled scan fee or a
    // prescription still leaves something payable, so just check the total.
    const canPay = totalAmount > 0 && !hasShortfalls && isCompleted;

    async function selectToken(appt: Appointment) {
        setSelectedId(appt.id);
        setDispensePlan(null);
        setActivePrescription(null);
        const doctor = doctorFor(appt.doctorId);
        setDoctorFeeInput(doctor?.consultationFee ? String(doctor.consultationFee) : "");

        const rx = findPrescriptionFor(appt);
        setActivePrescription(rx);
        if (rx) {
            setPlanLoading(true);
            try {
                setDispensePlan(await planDispense(rx));
            } catch {
                showToast("Couldn't compute stock allocation for this patient's prescription", "error");
            } finally {
                setPlanLoading(false);
            }
        }
    }

    function resetSelection() {
        setSelectedId(null);
        setDispensePlan(null);
        setActivePrescription(null);
        setDoctorFeeInput("");
    }

    async function handleCheckout(method: PaymentMethod) {
        if (!selected || !canPay) return;
        setCheckingOut(true);
        try {
            const itemParts: string[] = [];
            if (!consultationBilled) itemParts.push(`Consultation${selected.treatment ? ` – ${selected.treatment}` : ""}`);
            scanReports.forEach((r) => itemParts.push(r.title || r.reportType));
            const result = await checkoutVisit({
                appointment: selected,
                consultationAmount,
                consultationItems: itemParts.join(" + "),
                scanReportIds: scanReports.map((r) => r.id),
                prescription: activePrescription || undefined,
                dispensePlan: dispensePlan || undefined,
                method,
                actorEmail
            });
            showToast(`${patientFor(selected.patientId)}'s visit billed — ₹${result.totalAmount.toLocaleString()} collected`);
            if (method !== "razorpay_sim") setPaidInfo({ amount: result.totalAmount, method });
            resetSelection();
        } catch (err: any) {
            showToast(err?.message || "Checkout failed", "error");
        } finally {
            setCheckingOut(false);
            setShowRazorpay(false);
        }
    }

    const salesRows: SalesRow[] = useMemo(() => {
        const c: SalesRow[] = consultationInvoices
            .filter((i) => i.date === date)
            .map((i) => ({ id: i.id, type: "Consultation", invoiceNo: i.invoiceNo, patientId: i.patientId, description: i.items, amount: i.amount }));
        const p: SalesRow[] = pharmacyInvoices
            .filter((i) => i.date === date)
            .map((i) => ({ id: i.id, type: "Pharmacy", invoiceNo: i.invoiceNo, patientId: i.patientId, description: i.lines.map((l) => l.name).join(", "), amount: i.totalAmount }));
        return [...c, ...p];
    }, [consultationInvoices, pharmacyInvoices, date]);

    function openPreview(row: SalesRow) {
        if (row.type === "Consultation") {
            const inv = consultationInvoices.find((i) => i.id === row.id);
            if (inv) setPreviewInvoice(consultationToPreview(inv, patientFor(inv.patientId)));
        } else {
            const inv = pharmacyInvoices.find((i) => i.id === row.id);
            if (inv) setPreviewInvoice(pharmacyToPreview(inv, patientFor(inv.patientId)));
        }
    }

    if (l1 || l2 || l3 || l4 || l5 || l6 || l7) return <PillLoader label="Loading Point of Sale…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Point of Sale</h1>
                    <p>Pick a patient&rsquo;s token — doctor fee, prescriptions sent here, and scan charges are pulled in automatically. Pay once the visit is marked Completed.</p>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>
                <div>
                    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                        <input type="date" value={date} onChange={(e) => { setDate(e.target.value); resetSelection(); }} style={{ maxWidth: 180 }} />
                        <div className="search" style={{ flex: 1, minWidth: 220 }}>
                            <Search size={15} className="searchIcon" />
                            <input placeholder="Search patient or treatment…" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                    </div>

                    {tokens.length === 0 ? (
                        <div className="card" style={{ padding: 30 }}>
                            <div className="empty">⌕<br /><strong>No appointments for this date</strong><br />Book one from Appointments to see it here.</div>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                            {tokens.map((a) => {
                                const billed = alreadyInvoicedAppointmentIds.has(a.id);
                                return (
                                    <button
                                        key={a.id}
                                        className="pickCard"
                                        onClick={() => selectToken(a)}
                                        style={{
                                            textAlign: "left",
                                            border: selectedId === a.id ? "1px solid var(--dg-teal-500)" : undefined,
                                            background: selectedId === a.id ? "var(--dg-teal-50)" : undefined
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                            <strong style={{ fontSize: 13 }}>Token #{tokenNumber.get(a.id)}</strong>
                                            <Badge status={a.status} />
                                        </div>
                                        <strong style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14 }}>
                                            <User size={13} />{patientFor(a.patientId)}
                                        </strong>
                                        <small style={{ display: "block", color: "var(--dg-muted)", marginTop: 2 }}>
                                            {a.time} · {doctorFor(a.doctorId)?.name || "Unassigned"}
                                        </small>
                                        <small style={{ display: "block", color: "var(--dg-muted)" }}>{a.treatment}</small>
                                        {billed && <span className="badge completed" style={{ marginTop: 6 }}><i />Consultation billed</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="card tableCard" style={{ marginTop: 24 }}>
                        <div className="cardHead" style={{ padding: "16px 20px 0" }}><h3>Billed on {date}</h3></div>
                        <div className="tableWrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Invoice #</th>
                                        <th>Type</th>
                                        <th>Patient</th>
                                        <th>Items</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salesRows.length === 0 ? (
                                        <tr><td colSpan={5}><div className="empty"><strong>Nothing billed yet for this date</strong></div></td></tr>
                                    ) : (
                                        salesRows.map((r) => (
                                            <tr key={`${r.type}-${r.id}`}>
                                                <td><button className="invoiceNoLink" onClick={() => openPreview(r)}>{r.invoiceNo}</button></td>
                                                <td><span className={`badge ${r.type === "Pharmacy" ? "teal" : "confirmed"}`}><i />{r.type}</span></td>
                                                <td>{patientFor(r.patientId)}</td>
                                                <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</td>
                                                <td>₹{r.amount.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: 18, position: "sticky", top: 20, display: "grid", gap: 14 }}>
                    {!selected ? (
                        <div className="empty" style={{ padding: "30px 0" }}>Select a token to start billing<br /><small>Its consultation, prescription, and scans will load here</small></div>
                    ) : (
                        <>
                            <div>
                                <strong style={{ fontSize: 15 }}>{patientFor(selected.patientId)}</strong>
                                <div className="muted" style={{ fontSize: 12 }}>Token #{tokenNumber.get(selected.id)} · {selected.time} · {selectedDoctor?.name || "Unassigned"}</div>
                            </div>

                            <div style={{ display: "grid", gap: 10, maxHeight: 340, overflowY: "auto" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                    <div style={{ flex: 1 }}>
                                        <strong style={{ fontSize: 13, display: "block" }}>Consultation — {selected.treatment}</strong>
                                        {consultationBilled && <small className="muted">Already invoiced separately</small>}
                                    </div>
                                    {consultationBilled ? (
                                        <strong>—</strong>
                                    ) : (
                                        <input
                                            type="number" min={0} value={doctorFeeInput}
                                            onChange={(e) => setDoctorFeeInput(e.target.value)}
                                            style={{ width: 90 }} placeholder="0"
                                        />
                                    )}
                                </div>

                                {scanReports.map((r) => (
                                    <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <strong style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</strong>
                                            <small className="muted">{r.reportType}</small>
                                        </div>
                                        <strong>₹{(r.fee || 0).toLocaleString()}</strong>
                                    </div>
                                ))}

                                {planLoading && <PillLoader label="Allocating stock (FEFO)…" />}

                                {dispensePlan && dispensePlan.lines.map((l, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <strong style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</strong>
                                            <small className="muted">Batch {l.batchNo} · {l.qty} units</small>
                                        </div>
                                        <strong>₹{l.total.toLocaleString()}</strong>
                                    </div>
                                ))}

                                {dispensePlan && dispensePlan.shortfalls.length > 0 && (
                                    <div className="card" style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 10 }}>
                                        <strong style={{ color: "#dc2626", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                                            <AlertTriangle size={13} />Not enough stock
                                        </strong>
                                        {dispensePlan.shortfalls.map((s, i) => (
                                            <p key={i} style={{ margin: "4px 0 0", fontSize: 11, color: "#991b1b" }}>{s.name}: short by {s.missing} units</p>
                                        ))}
                                    </div>
                                )}

                                {!activePrescription && !planLoading && (
                                    <small className="muted">No undispensed prescription for this patient.</small>
                                )}
                            </div>

                            <div style={{ borderTop: "1px solid var(--dg-border)", paddingTop: 12, display: "grid", gap: 6, fontSize: 13 }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Consultation + Scans</span><span>₹{consultationAmount.toLocaleString()}</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Medicines</span><span>₹{pharmacyAmount.toLocaleString()}</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800 }}><span>Total</span><span>₹{totalAmount.toLocaleString()}</span></div>
                            </div>

                            <div style={{ display: "grid", gap: 8 }}>
                                <button className="pickCard" disabled={checkingOut || !canPay} onClick={() => handleCheckout("Cash")} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <Banknote size={17} /> Pay with Cash
                                </button>
                                <button className="pickCard" disabled={checkingOut || !canPay} onClick={() => handleCheckout("Card")} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <CreditCard size={17} /> Pay with Card
                                </button>
                                <button className="pickCard" disabled={checkingOut || !canPay} onClick={() => setShowRazorpay(true)} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <Sparkles size={17} /> Pay via UPI / Razorpay
                                </button>
                                {!isCompleted && (
                                    <small className="muted" style={{ textAlign: "center" }}>Mark this visit Completed in Appointments to collect payment</small>
                                )}
                                {isCompleted && !canPay && !hasShortfalls && <small className="muted" style={{ textAlign: "center" }}>Nothing to collect for this visit yet</small>}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {showRazorpay && selected && (
                <PaymentSimModal
                    amount={totalAmount}
                    invoiceNo={`Token #${tokenNumber.get(selected.id)} · ${patientFor(selected.patientId)}`}
                    onClose={() => setShowRazorpay(false)}
                    onSuccess={() => handleCheckout("razorpay_sim")}
                />
            )}

            {previewInvoice && (
                <InvoicePreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />
            )}

            {paidInfo && (
                <PaymentSuccessOverlay
                    amount={paidInfo.amount}
                    label={paidInfo.method === "Cash" ? "Paid in cash" : "Paid by card"}
                    onDone={() => setPaidInfo(null)}
                />
            )}
        </>
    );
}
