import {
    collection, doc, getDocs, query, where,
    runTransaction, writeBatch, Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import type { Batch, Prescription, PurchaseOrder, SalesReturnAction } from "./types";

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
 * Commits a previously computed dispense plan: deducts each allocated batch,
 * logs a stock transaction per batch touched, creates the pharmacy invoice,
 * and marks the prescription dispensed — all atomically.
 */
export async function commitDispense(
    prescription: Prescription,
    plan: DispensePlan,
    invoiceNo: string
): Promise<void> {
    await runTransaction(db, async (tx) => {
        const batchRefs = plan.lines.map((l) => doc(db, "batches", l.batchId));
        const batchSnaps = await Promise.all(batchRefs.map((ref) => tx.get(ref)));

        batchSnaps.forEach((snap, i) => {
            const line = plan.lines[i];
            const current = snap.data() as Batch | undefined;
            if (!current || current.quantityRemaining < line.qty) {
                throw new Error(`${line.name} batch ${line.batchNo} no longer has enough stock — someone else may have dispensed it first.`);
            }
        });

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
                date: new Date().toISOString().slice(0, 10),
                createdAt: Timestamp.now().toMillis()
            });
        });

        const invoiceRef = doc(collection(db, "pharmacyInvoices"));
        tx.set(invoiceRef, {
            invoiceNo,
            patientId: prescription.patientId,
            prescriptionId: prescription.id,
            lines: plan.lines,
            totalAmount: plan.totalAmount,
            date: new Date().toISOString().slice(0, 10),
            createdAt: Timestamp.now().toMillis()
        });

        tx.update(doc(db, "prescriptions", prescription.id), { dispensed: true });
    });
}

export type ReceivedLine = {
    medicineId: string;
    name: string;
    qty: number;
    unitCost: number;
    batchNo: string;
    expiryDate: string;
    mrp: number;
};

/**
 * Receiving a purchase order is what actually creates stock: one batch per
 * line, plus a matching Receipt stock transaction, plus flipping the PO to
 * Received — all in a single atomic write.
 */
export async function receivePurchaseOrder(po: PurchaseOrder, lines: ReceivedLine[]): Promise<void> {
    const batchWrite = writeBatch(db);
    const today = new Date().toISOString().slice(0, 10);

    for (const line of lines) {
        const batchRef = doc(collection(db, "batches"));
        batchWrite.set(batchRef, {
            medicineId: line.medicineId,
            batchNo: line.batchNo,
            expiryDate: line.expiryDate,
            quantityReceived: line.qty,
            quantityRemaining: line.qty,
            unitCost: line.unitCost,
            mrp: line.mrp,
            supplierId: po.supplierId,
            poId: po.id,
            receivedDate: today,
            createdAt: Timestamp.now().toMillis()
        });

        const stRef = doc(collection(db, "stockTransactions"));
        batchWrite.set(stRef, {
            medicineId: line.medicineId,
            batchId: batchRef.id,
            type: "Receipt",
            qty: line.qty,
            refId: po.id,
            date: today,
            createdAt: Timestamp.now().toMillis()
        });
    }

    batchWrite.update(doc(db, "purchaseOrders", po.id), { status: "Received", receivedDate: today });
    await batchWrite.commit();
}

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
