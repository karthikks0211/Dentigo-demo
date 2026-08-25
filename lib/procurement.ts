import {
    addDoc, collection, doc, getDocs, query, where,
    runTransaction, writeBatch, updateDoc, arrayUnion, Timestamp,
    type DocumentReference
} from "firebase/firestore";
import { db } from "./firebase";
import { generateInvoiceNo } from "./pharmacy";
import type {
    Batch, GoodsReceipt, GrnLine, POHistoryEntry, PurchaseOrder,
    PurchaseOrderLine, PurchaseOrderStatus, PurchaseRequest
} from "./types";

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function historyEntry(action: string, byEmail: string, note?: string): POHistoryEntry {
    return { action, byEmail, at: Timestamp.now().toMillis(), note: note || "" };
}

// ---------------------------------------------------------------- requests

export type NewRequestParams = {
    medicineId: string;
    name: string;
    requestedQty: number;
    reason: string;
    currentStock: number;
    reorderLevel: number;
    requestedBy: string;
};

/**
 * Raises a purchase request. Duplicate prevention: if an OPEN, not-yet-linked
 * request already exists for this medicine, its quantity is topped up instead
 * of piling up a second request for the same shortage.
 */
export async function createPurchaseRequest(params: NewRequestParams): Promise<string> {
    if (params.requestedQty <= 0) throw new Error("Requested quantity must be greater than zero.");

    const existingSnap = await getDocs(query(
        collection(db, "purchaseRequests"),
        where("medicineId", "==", params.medicineId),
        where("status", "==", "OPEN")
    ));

    if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const existing = existingDoc.data() as PurchaseRequest;
        await updateDoc(doc(db, "purchaseRequests", existingDoc.id), {
            requestedQty: existing.requestedQty + params.requestedQty,
            reason: params.reason || existing.reason
        });
        return existingDoc.id;
    }

    const requestNo = generateInvoiceNo("PR");
    const ref = await addDoc(collection(db, "purchaseRequests"), {
        requestNo,
        medicineId: params.medicineId,
        name: params.name,
        requestedQty: params.requestedQty,
        reason: params.reason,
        currentStockAtRequest: params.currentStock,
        reorderLevelAtRequest: params.reorderLevel,
        status: "OPEN",
        requestedBy: params.requestedBy,
        createdAt: Timestamp.now().toMillis()
    });
    return ref.id;
}

export async function cancelPurchaseRequest(request: PurchaseRequest, actor: string): Promise<void> {
    if (request.status !== "OPEN") throw new Error("Only open requests can be cancelled.");
    await updateDoc(doc(db, "purchaseRequests", request.id), { status: "CANCELLED", cancelledBy: actor });
}

// ----------------------------------------------------------------- creation

export type NewPOLine = { medicineId: string; name: string; qty: number; unitCost: number };

/**
 * Drafts a new purchase order. IMPORTANT: this never touches inventory — a
 * PO only records intent to buy. Stock only ever changes via a confirmed
 * Goods Receipt (see receiveGoods below).
 */
export async function createPurchaseOrder(params: {
    supplierId: string;
    lines: NewPOLine[];
    requestIds?: string[];
    actor: string;
}): Promise<{ id: string; poNumber: string }> {
    if (!params.supplierId) throw new Error("Select a supplier.");
    const validLines = params.lines.filter((l) => l.medicineId && l.qty > 0);
    if (validLines.length === 0) throw new Error("Add at least one line item.");

    const poNumber = generateInvoiceNo("PO");
    const lines: PurchaseOrderLine[] = validLines.map((l) => ({ ...l, receivedQty: 0 }));
    const poRef = doc(collection(db, "purchaseOrders"));

    const batchWrite = writeBatch(db);
    batchWrite.set(poRef, {
        poNumber,
        supplierId: params.supplierId,
        status: "DRAFT",
        lines,
        requestIds: params.requestIds || [],
        orderedDate: today(),
        createdBy: params.actor,
        history: [historyEntry("Created as Draft", params.actor)],
        createdAt: Timestamp.now().toMillis()
    });
    for (const id of params.requestIds || []) {
        batchWrite.update(doc(db, "purchaseRequests", id), { status: "LINKED", poId: poRef.id, poNumber });
    }
    await batchWrite.commit();

    return { id: poRef.id, poNumber };
}

// ------------------------------------------------------------- status machine

const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
    DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "REJECTED"],
    APPROVED: ["SENT", "CANCELLED"],
    SENT: ["PARTIALLY_RECEIVED", "FULLY_RECEIVED"],
    PARTIALLY_RECEIVED: ["FULLY_RECEIVED"],
    FULLY_RECEIVED: ["CLOSED"],
    CLOSED: [],
    REJECTED: [],
    CANCELLED: []
};

function assertTransition(from: PurchaseOrderStatus, to: PurchaseOrderStatus) {
    if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
        throw new Error(`Can't move a purchase order from ${from.replace(/_/g, " ")} to ${to.replace(/_/g, " ")}.`);
    }
}

export async function submitForApproval(po: PurchaseOrder, actor: string): Promise<void> {
    assertTransition(po.status, "PENDING_APPROVAL");
    await updateDoc(doc(db, "purchaseOrders", po.id), {
        status: "PENDING_APPROVAL",
        history: arrayUnion(historyEntry("Submitted for Approval", actor))
    });
}

/** A distinct, deliberate action separate from creation — a PO can never auto-approve itself. */
export async function approvePurchaseOrder(po: PurchaseOrder, actor: string, note?: string): Promise<void> {
    assertTransition(po.status, "APPROVED");
    await updateDoc(doc(db, "purchaseOrders", po.id), {
        status: "APPROVED",
        approvedBy: actor,
        approvedDate: today(),
        history: arrayUnion(historyEntry("Approved", actor, note))
    });
}

export async function rejectPurchaseOrder(po: PurchaseOrder, actor: string, reason: string): Promise<void> {
    assertTransition(po.status, "REJECTED");
    if (!reason.trim()) throw new Error("A rejection reason is required.");
    await updateDoc(doc(db, "purchaseOrders", po.id), {
        status: "REJECTED",
        rejectedBy: actor,
        rejectionReason: reason,
        history: arrayUnion(historyEntry("Rejected", actor, reason))
    });
}

export async function sendToSupplier(po: PurchaseOrder, actor: string): Promise<void> {
    assertTransition(po.status, "SENT");
    await updateDoc(doc(db, "purchaseOrders", po.id), {
        status: "SENT",
        sentBy: actor,
        sentDate: today(),
        history: arrayUnion(historyEntry("Sent to Supplier", actor))
    });
}

export async function cancelPurchaseOrder(po: PurchaseOrder, actor: string, reason: string): Promise<void> {
    assertTransition(po.status, "CANCELLED");
    await updateDoc(doc(db, "purchaseOrders", po.id), {
        status: "CANCELLED",
        cancelledBy: actor,
        cancellationReason: reason || "",
        history: arrayUnion(historyEntry("Cancelled", actor, reason))
    });
}

export async function closePurchaseOrder(po: PurchaseOrder, actor: string): Promise<void> {
    assertTransition(po.status, "CLOSED");
    await updateDoc(doc(db, "purchaseOrders", po.id), {
        status: "CLOSED",
        closedBy: actor,
        closedDate: today(),
        history: arrayUnion(historyEntry("Closed", actor))
    });
}

// -------------------------------------------------------------- goods receipt

export type GrnLineInput = {
    medicineId: string;
    name: string;
    receivedQtyNow: number;
    batchNo: string;
    expiryDate: string;
    unitCost: number;
    mrp: number;
};

/**
 * Confirms a Goods Receipt against a PO. This is the ONLY place in the whole
 * procurement flow where inventory increases — creating, approving, or
 * sending a PO never touches batches/stockTransactions. Supports partial
 * deliveries: call this as many times as shipments arrive until every line
 * is fully received, at which point the PO flips to FULLY_RECEIVED.
 *
 * Duplicate prevention: an existing batch with the same medicine + batch
 * number + supplier is topped up rather than duplicated (covers split
 * shipments of the same manufacturer batch across multiple GRNs).
 */
export async function receiveGoods(params: {
    po: PurchaseOrder;
    lines: GrnLineInput[];
    actor: string;
    notes?: string;
}): Promise<string> {
    const { po, actor } = params;

    if (po.status !== "SENT" && po.status !== "PARTIALLY_RECEIVED") {
        throw new Error(`${po.poNumber} isn't ready to receive goods — it must be Sent to Supplier first.`);
    }

    const activeLines = params.lines.filter((l) => l.receivedQtyNow > 0);
    if (activeLines.length === 0) throw new Error("Enter a received quantity for at least one line.");

    for (const line of activeLines) {
        const poLine = po.lines.find((l) => l.medicineId === line.medicineId);
        if (!poLine) throw new Error(`${line.name} isn't on this purchase order.`);
        const remaining = poLine.qty - poLine.receivedQty;
        if (line.receivedQtyNow > remaining) {
            throw new Error(`Can't receive ${line.receivedQtyNow} of ${line.name} — only ${remaining} still pending.`);
        }
        if (!line.batchNo.trim()) throw new Error(`Enter a batch number for ${line.name}.`);
        if (!line.expiryDate) throw new Error(`Enter an expiry date for ${line.name}.`);
    }

    // Firestore transactions can't run queries — resolve (or create) each
    // line's batch reference up front, then re-verify everything for real
    // inside the transaction below.
    const batchRefs = new Map<string, DocumentReference>();
    for (const line of activeLines) {
        const key = `${line.medicineId}::${line.batchNo.trim()}`;
        if (batchRefs.has(key)) continue;
        const existing = await getDocs(query(
            collection(db, "batches"),
            where("medicineId", "==", line.medicineId),
            where("batchNo", "==", line.batchNo.trim()),
            where("supplierId", "==", po.supplierId)
        ));
        batchRefs.set(key, existing.empty ? doc(collection(db, "batches")) : existing.docs[0].ref);
    }

    const grnNo = generateInvoiceNo("GRN");
    const grnRef = doc(collection(db, "goodsReceipts"));
    const poRef = doc(db, "purchaseOrders", po.id);
    const date = today();

    await runTransaction(db, async (tx) => {
        const poSnap = await tx.get(poRef);
        const freshPo = poSnap.data() as PurchaseOrder | undefined;
        if (!freshPo) throw new Error("Purchase order no longer exists.");
        if (freshPo.status !== "SENT" && freshPo.status !== "PARTIALLY_RECEIVED") {
            throw new Error(`${freshPo.poNumber} isn't ready to receive goods.`);
        }

        const batchSnaps = new Map<string, Awaited<ReturnType<typeof tx.get>>>();
        for (const [key, ref] of batchRefs) {
            batchSnaps.set(key, await tx.get(ref));
        }

        const updatedLines = freshPo.lines.map((l) => ({ ...l }));
        const grnLines: GrnLine[] = [];

        for (const line of activeLines) {
            const key = `${line.medicineId}::${line.batchNo.trim()}`;
            const ref = batchRefs.get(key)!;
            const snap = batchSnaps.get(key)!;
            const poLine = updatedLines.find((l) => l.medicineId === line.medicineId)!;
            const remaining = poLine.qty - poLine.receivedQty;
            if (line.receivedQtyNow > remaining) {
                throw new Error(`Can't receive ${line.receivedQtyNow} of ${line.name} — only ${remaining} still pending (someone else may have just recorded a receipt).`);
            }

            if (snap.exists()) {
                const current = snap.data() as Batch;
                tx.update(ref, {
                    quantityReceived: current.quantityReceived + line.receivedQtyNow,
                    quantityRemaining: current.quantityRemaining + line.receivedQtyNow,
                    unitCost: line.unitCost,
                    mrp: line.mrp,
                    expiryDate: line.expiryDate
                });
            } else {
                tx.set(ref, {
                    medicineId: line.medicineId,
                    batchNo: line.batchNo.trim(),
                    expiryDate: line.expiryDate,
                    quantityReceived: line.receivedQtyNow,
                    quantityRemaining: line.receivedQtyNow,
                    unitCost: line.unitCost,
                    mrp: line.mrp,
                    supplierId: po.supplierId,
                    poId: po.id,
                    receivedDate: date,
                    createdAt: Timestamp.now().toMillis()
                });
            }

            const stRef = doc(collection(db, "stockTransactions"));
            tx.set(stRef, {
                medicineId: line.medicineId,
                batchId: ref.id,
                type: "Receipt",
                qty: line.receivedQtyNow,
                refId: grnRef.id,
                date,
                createdAt: Timestamp.now().toMillis()
            });

            grnLines.push({
                medicineId: line.medicineId,
                name: line.name,
                orderedQty: poLine.qty,
                receivedQtyBefore: poLine.receivedQty,
                receivedQtyNow: line.receivedQtyNow,
                batchNo: line.batchNo.trim(),
                expiryDate: line.expiryDate,
                unitCost: line.unitCost,
                mrp: line.mrp,
                batchId: ref.id
            });

            poLine.receivedQty += line.receivedQtyNow;
        }

        const fullyReceived = updatedLines.every((l) => l.receivedQty >= l.qty);
        const newStatus: PurchaseOrderStatus = fullyReceived ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED";

        tx.set(grnRef, {
            grnNo,
            poId: po.id,
            poNumber: po.poNumber,
            supplierId: po.supplierId,
            lines: grnLines,
            receivedBy: actor,
            notes: params.notes || "",
            date,
            createdAt: Timestamp.now().toMillis()
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const poUpdate: { [key: string]: any } = {
            lines: updatedLines,
            status: newStatus,
            history: arrayUnion(historyEntry(
                fullyReceived ? "Goods Received — fully received" : "Goods Received — partial",
                actor,
                grnNo
            ))
        };
        if (fullyReceived) poUpdate.receivedDate = date;
        tx.update(poRef, poUpdate);
    });

    return grnRef.id;
}
