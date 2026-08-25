import { collection, doc, runTransaction, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { generateInvoiceNo, readDispenseBatchSnaps, assertBatchesAvailable, writeDispense, type DispensePlan } from "./pharmacy";
import { logAppointmentEventTx } from "./audit";
import type { Appointment, PaymentMethod, Prescription } from "./types";

export type VisitCheckoutParams = {
    appointment: Appointment;
    /** Doctor fee plus any not-yet-billed scan/diagnostic fees for this visit, already summed. 0 if the consultation was invoiced elsewhere. */
    consultationAmount: number;
    /** Human-readable line, e.g. "Consultation + Dental X-Ray (IOPA/OPG)" — becomes the ConsultationInvoice's items text. */
    consultationItems: string;
    /** Diagnosis report ids whose fee is included in consultationAmount — flipped billed:true so a later payment for this token doesn't recharge them. */
    scanReportIds?: string[];
    /** The prescription being dispensed at this visit, if any. */
    prescription?: Prescription;
    /** Its pre-computed FEFO allocation (from planDispense), if any. */
    dispensePlan?: DispensePlan;
    method: PaymentMethod;
    /** Acting staff user's email, for the appointment audit trail. */
    actorEmail: string;
};

export type VisitCheckoutResult = {
    consultationInvoiceNo?: string;
    pharmacyInvoiceNo?: string;
    totalAmount: number;
};

/**
 * Settles whatever's currently outstanding on a patient's token — POS gates
 * payment on the appointment already being Completed, and a token can be
 * paid across several calls to this as bills (a sent-to-POS prescription, a
 * scan report) get added to it over time; each call only ever includes
 * what's still unbilled/undispensed at the moment it's invoked. Reuses the
 * same collections lib/invoices.ts's manual flow used to write
 * (consultationInvoices, pharmacyInvoices, payments), so Sales History, the
 * Ledger, and Reports need no changes to pick up a POS-originated visit.
 *
 * One atomic transaction: create+pay a consultation invoice covering the
 * doctor fee and any not-yet-billed scan fees (if there's something to
 * collect), dispense a sent-to-POS prescription via the same FEFO batch
 * logic (if one was picked — this is also where its stock is actually
 * deducted, for the first time), and log every part of it to the
 * appointment's audit trail. Either half can be absent — a payment for just
 * a later-added scan, or just a dispense, is a normal, separate call.
 */
export async function checkoutVisit(params: VisitCheckoutParams): Promise<VisitCheckoutResult> {
    const { appointment, consultationAmount, consultationItems, scanReportIds, prescription, dispensePlan, method, actorEmail } = params;
    const hasDispense = !!(prescription && dispensePlan && dispensePlan.lines.length > 0);

    if (consultationAmount <= 0 && !hasDispense) {
        throw new Error("Nothing to bill for this visit.");
    }

    const date = new Date().toISOString().slice(0, 10);
    const consultationInvoiceNo = consultationAmount > 0 ? generateInvoiceNo("CN") : undefined;
    const pharmacyInvoiceNo = hasDispense ? generateInvoiceNo("PH") : undefined;

    await runTransaction(db, async (tx) => {
        // All reads before any writes — dispense batch reads (if any) go first.
        const batchSnaps = hasDispense ? await readDispenseBatchSnaps(tx, dispensePlan!) : null;
        if (hasDispense && batchSnaps) assertBatchesAvailable(dispensePlan!, batchSnaps);

        if (consultationAmount > 0 && consultationInvoiceNo) {
            const invoiceRef = doc(collection(db, "consultationInvoices"));
            tx.set(invoiceRef, {
                invoiceNo: consultationInvoiceNo,
                patientId: appointment.patientId,
                appointmentId: appointment.id,
                items: consultationItems,
                amount: consultationAmount,
                status: "Paid",
                dueDate: date,
                date,
                createdAt: Timestamp.now().toMillis()
            });

            const paymentRef = doc(collection(db, "payments"));
            tx.set(paymentRef, {
                invoiceId: invoiceRef.id,
                invoiceType: "Consultation",
                invoiceNo: consultationInvoiceNo,
                patientId: appointment.patientId,
                amount: consultationAmount,
                method,
                date,
                createdAt: Timestamp.now().toMillis()
            });

            (scanReportIds || []).forEach((id) => {
                tx.update(doc(db, "diagnosisReports", id), { billed: true });
            });

            logAppointmentEventTx(tx, {
                appointmentId: appointment.id,
                action: "ConsultationBilled",
                detail: `${consultationItems} — ₹${consultationAmount.toLocaleString()}`,
                byEmail: actorEmail
            });
        }

        if (hasDispense && batchSnaps && pharmacyInvoiceNo) {
            const pharmacyInvoiceId = writeDispense(tx, prescription!, dispensePlan!, batchSnaps, pharmacyInvoiceNo);

            const paymentRef = doc(collection(db, "payments"));
            tx.set(paymentRef, {
                invoiceId: pharmacyInvoiceId,
                invoiceType: "Pharmacy",
                invoiceNo: pharmacyInvoiceNo,
                patientId: appointment.patientId,
                amount: dispensePlan!.totalAmount,
                method,
                date,
                createdAt: Timestamp.now().toMillis()
            });

            logAppointmentEventTx(tx, {
                appointmentId: appointment.id,
                action: "PrescriptionDispensed",
                detail: `${prescription!.medicines.map((m) => m.name).join(", ")} — ₹${dispensePlan!.totalAmount.toLocaleString()}`,
                byEmail: actorEmail
            });
        }

        if (appointment.status !== "Completed") {
            tx.update(doc(db, "appointments", appointment.id), { status: "Completed" });
        }

        if (consultationAmount > 0 || (hasDispense && dispensePlan)) {
            logAppointmentEventTx(tx, {
                appointmentId: appointment.id,
                action: "PaymentCollected",
                detail: `₹${(consultationAmount + (dispensePlan?.totalAmount || 0)).toLocaleString()} via ${method === "razorpay_sim" ? "Razorpay" : method}`,
                byEmail: actorEmail
            });
        }
    });

    return {
        consultationInvoiceNo,
        pharmacyInvoiceNo,
        totalAmount: consultationAmount + (dispensePlan?.totalAmount || 0)
    };
}
