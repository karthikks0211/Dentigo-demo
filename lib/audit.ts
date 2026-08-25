import { addDoc, collection, doc, Timestamp, type Transaction } from "firebase/firestore";
import { db } from "./firebase";
import type { AppointmentAuditAction } from "./types";

export type LogAppointmentEventParams = {
    appointmentId: string;
    action: AppointmentAuditAction;
    detail: string;
    byEmail: string;
};

/**
 * Appends one entry to an appointment's audit trail — every status change and
 * every clinical/billing event tied to that visit (prescription written/sent
 * to POS/dispensed, diagnosis report added/billed, consultation billed,
 * payment collected). Powers the Appointments → Audit Log page.
 *
 * Two variants, same split as lib/pharmacy.ts's writeDispense/commitDispense:
 * this one for standalone one-off call sites, logAppointmentEventTx for a
 * caller composing a bigger transaction (POS checkout) so the audit entry
 * for a payment stays atomic with the payment itself.
 */
export async function logAppointmentEvent(params: LogAppointmentEventParams): Promise<void> {
    await addDoc(collection(db, "appointmentAuditLog"), {
        ...params,
        at: Timestamp.now().toMillis()
    });
}

export function logAppointmentEventTx(tx: Transaction, params: LogAppointmentEventParams): void {
    const ref = doc(collection(db, "appointmentAuditLog"));
    tx.set(ref, {
        ...params,
        at: Timestamp.now().toMillis()
    });
}
