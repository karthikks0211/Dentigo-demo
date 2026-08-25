import {
    collection, doc, getDocs, query, where,
    runTransaction, Timestamp, type Transaction, type DocumentSnapshot
} from "firebase/firestore";
import { db } from "./firebase";
import type { Batch, Prescription, SalesReturnAction } from "./types";

export type DispenseAllocationLine = {
    medicineId: string;
    name: string;
    batchId: string;
    batchNo: string;
    qty: number;
    unitPrice: number;
    total: number;
};

export type DispensePlan = {
    lines: DispenseAllocationLine[];
    totalAmount: number;
    shortfalls: { medicineId: string; name: string; missing: number }[];
};

/**
 * Reads all batches for the medicines on a prescription and greedily allocates
 * quantity from the earliest-expiring batch first (FEFO). Query is unfiltered/
 * unordered on purpose — sorting client-side avoids needing a Firestore
 * composite index for a demo-scale dataset.
 */
export async function planDispense(prescription: Prescription): Promise<DispensePlan> {
    const lines: DispenseAllocationLine[] = [];
    const shortfalls: DispensePlan["shortfalls"] = [];

    for (const med of prescription.medicines) {
        const snap = await getDocs(query(collection(db, "batches"), where("medicineId", "==", med.medicineId)));
        const batches = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Batch))
            .filter((b) => b.quantityRemaining > 0)
            .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1));

        let remaining = med.quantity;
        for (const batch of batches) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, batch.quantityRemaining);
            lines.push({
                medicineId: med.medicineId,
                name: med.name,
                batchId: batch.id,
                batchNo: batch.batchNo,
                qty: take,
                unitPrice: batch.mrp,
                total: take * batch.mrp
            });
            remaining -= take;
        }

        if (remaining > 0) {
            shortfalls.push({ medicineId: med.medicineId, name: med.name, missing: remaining });
        }
    }

    return {
        lines,
        totalAmount: lines.reduce((sum, l) => sum + l.total, 0),
        shortfalls
    };
}

/**
 * Reads the batch docs a dispense plan allocates from, inside an in-flight
 * transaction. Split out from commitDispense so a caller composing a bigger
 * transaction (POS checkout, which also writes a consultation invoice) can
 * do this read alongside its own — Firestore requires every tx.get() across
 * a transaction to happen before any tx.set()/tx.update().
 */
export async function readDispenseBatchSnaps(tx: Transaction, plan: DispensePlan): Promise<DocumentSnapshot[]> {
    const batchRefs = plan.lines.map((l) => doc(db, "batches", l.batchId));
    return Promise.all(batchRefs.map((ref) => tx.get(ref)));
}

/** Throws if any allocated batch no longer has enough stock — re-check right before committing. */
export function assertBatchesAvailable(plan: DispensePlan, batchSnaps: DocumentSnapshot[]): void {
    batchSnaps.forEach((snap, i) => {
        const line = plan.lines[i];
        const current = snap.data() as Batch | undefined;
        if (!current || current.quantityRemaining < line.qty) {
            throw new Error(`${line.name} batch ${line.batchNo} no longer has enough stock — someone else may have dispensed it first.`);
        }
    });
}

/**
 * Writes the dispense side-effects (batch deduction, stock transactions,
 * pharmacy invoice, prescription.dispensed flag) into an in-flight
 * transaction. Assumes assertBatchesAvailable already passed. Returns the
 * new pharmacy invoice's doc id.
 */
export function writeDispense(
    tx: Transaction,
    prescription: Prescription,
    plan: DispensePlan,
    batchSnaps: DocumentSnapshot[],
    invoiceNo: string
): string {
    const batchRefs = plan.lines.map((l) => doc(db, "batches", l.batchId));
    const date = new Date().toISOString().slice(0, 10);

    batchSnaps.forEach((snap, i) => {
        const line = plan.lines[i];
        const current = snap.data() as Batch;
        tx.update(batchRefs[i], { quantityRemaining: current.quantityRemaining - line.qty });

        const stRef = doc(collection(db, "stockTransactions"));
        tx.set(stRef, {
            medicineId: line.medicineId,
            batchId: line.batchId,
            type: "Dispense",
            qty: -line.qty,
            refId: prescription.id,
            date,
            createdAt: Timestamp.now().toMillis()
        });
    });

    const invoiceRef = doc(collection(db, "pharmacyInvoices"));
    tx.set(invoiceRef, {
        invoiceNo,
        patientId: prescription.patientId,
        prescriptionId: prescription.id,
        appointmentId: prescription.appointmentId,
        lines: plan.lines,
        totalAmount: plan.totalAmount,
        date,
        createdAt: Timestamp.now().toMillis()
    });

    tx.update(doc(db, "prescriptions", prescription.id), { dispensed: true });
    return invoiceRef.id;
}

/**
 * Commits a previously computed dispense plan: deducts each allocated batch,
 * logs a stock transaction per batch touched, creates the pharmacy invoice,
 * and marks the prescription dispensed — all atomically. Stock/money should
 * only ever move together at the moment a POS payment is confirmed, so this
 * is called from lib/pos.ts's checkoutVisit (composing
 * readDispenseBatchSnaps/assertBatchesAvailable/writeDispense directly inside
 * its own bigger transaction), not from the Prescriptions page anymore — a
 * "Dispense" click there just flags the prescription readyForPos so it shows
 * up as a pending line on the token in POS. Kept as a standalone entry point
 * for any future non-POS commit path.
 */
export async function commitDispense(
    prescription: Prescription,
    plan: DispensePlan,
    invoiceNo: string
): Promise<void> {
    await runTransaction(db, async (tx) => {
        const batchSnaps = await readDispenseBatchSnaps(tx, plan);
        assertBatchesAvailable(plan, batchSnaps);
        writeDispense(tx, prescription, plan, batchSnaps, invoiceNo);
    });
}

// Purchase-order receiving used to live here as a single-shot writeBatch.
// It's been superseded by receiveGoods() in lib/procurement.ts, which adds
// partial deliveries, duplicate-batch merging, and PO status-machine
// validation — see that file for the full PR -> PO -> GRN flow.

/**
 * Processes a sales return against a dispensed pharmacy invoice line. Restock
 * puts the quantity back on the same batch (if it still exists) and logs a
 * Return transaction; Writeoff just logs the loss without touching stock.
 */
export async function processReturn(params: {
    pharmacyInvoiceId: string;
    pharmacyInvoiceNo: string;
    medicineId: string;
    name: string;
    batchId: string;
    qty: number;
    action: SalesReturnAction;
    reason: string;
}): Promise<void> {
    await runTransaction(db, async (tx) => {
        if (params.action === "Restock") {
            const batchRef = doc(db, "batches", params.batchId);
            const batchSnap = await tx.get(batchRef);
            const batch = batchSnap.data() as Batch | undefined;
            if (batch) {
                tx.update(batchRef, { quantityRemaining: batch.quantityRemaining + params.qty });
            }
        }

        const returnRef = doc(collection(db, "salesReturns"));
        tx.set(returnRef, {
            pharmacyInvoiceId: params.pharmacyInvoiceId,
            pharmacyInvoiceNo: params.pharmacyInvoiceNo,
            medicineId: params.medicineId,
            name: params.name,
            batchId: params.batchId,
            qty: params.qty,
            action: params.action,
            reason: params.reason,
            date: new Date().toISOString().slice(0, 10),
            createdAt: Timestamp.now().toMillis()
        });

        const stRef = doc(collection(db, "stockTransactions"));
        tx.set(stRef, {
            medicineId: params.medicineId,
            batchId: params.batchId,
            type: params.action === "Restock" ? "Return" : "Writeoff",
            qty: params.action === "Restock" ? params.qty : 0,
            refId: params.pharmacyInvoiceId,
            date: new Date().toISOString().slice(0, 10),
            createdAt: Timestamp.now().toMillis()
        });
    });
}

export function generateInvoiceNo(prefix: string): string {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${stamp}-${rand}`;
}
