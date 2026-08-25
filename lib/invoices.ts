import { addDoc, collection, doc, getDocs, query, runTransaction, Timestamp, where } from "firebase/firestore";
import { db } from "./firebase";
import { generateInvoiceNo } from "./pharmacy";
import type { PaymentInvoiceType, PaymentMethod, SupplierInvoice, SupplierPaymentMethod } from "./types";

export async function generateConsultationInvoice(params: {
    patientId: string;
    appointmentId: string;
    items: string;
    amount: number;
    dueDate: string;
}): Promise<string> {
    const invoiceNo = generateInvoiceNo("CN");
    await addDoc(collection(db, "consultationInvoices"), {
        invoiceNo,
        patientId: params.patientId,
        appointmentId: params.appointmentId,
        items: params.items,
        amount: params.amount,
        status: "Pending",
        dueDate: params.dueDate,
        date: new Date().toISOString().slice(0, 10),
        createdAt: Timestamp.now().toMillis()
    });
    return invoiceNo;
}

/** Records a payment against an invoice and flips it to Paid — atomic so the ledger and invoice status never disagree. */
export async function recordPayment(params: {
    invoiceId: string;
    invoiceType: PaymentInvoiceType;
    invoiceNo: string;
    patientId: string;
    amount: number;
    method: PaymentMethod;
}): Promise<void> {
    const collectionName = params.invoiceType === "Consultation" ? "consultationInvoices" : "pharmacyInvoices";
    const invoiceRef = doc(db, collectionName, params.invoiceId);

    await runTransaction(db, async (tx) => {
        const paymentRef = doc(collection(db, "payments"));
        tx.set(paymentRef, {
            invoiceId: params.invoiceId,
            invoiceType: params.invoiceType,
            invoiceNo: params.invoiceNo,
            patientId: params.patientId,
            amount: params.amount,
            method: params.method,
            date: new Date().toISOString().slice(0, 10),
            createdAt: Timestamp.now().toMillis()
        });

        if (params.invoiceType === "Consultation") {
            tx.update(invoiceRef, { status: "Paid" });
        }
    });
}

// -------------------------------------------------------------------------
// Supplier side (payables) — same Invoice/Payment pattern as above, mirrored
// against suppliers instead of patients, and feeding the same Ledger.

/**
 * Generates a payable against a received PO. Duplicate prevention: only one
 * active (non-cancelled) supplier invoice is allowed per PO.
 */
export async function generateSupplierInvoice(params: {
    poId: string;
    poNumber: string;
    supplierId: string;
    amount: number;
    dueDate: string;
    supplierRefNo?: string;
}): Promise<string> {
    const existing = await getDocs(query(collection(db, "supplierInvoices"), where("poId", "==", params.poId)));
    const active = existing.docs.find((d) => (d.data() as SupplierInvoice).status !== "Cancelled");
    if (active) throw new Error("A supplier invoice already exists for this purchase order.");

    const invoiceNo = generateInvoiceNo("SINV");
    await addDoc(collection(db, "supplierInvoices"), {
        invoiceNo,
        supplierRefNo: params.supplierRefNo || "",
        poId: params.poId,
        poNumber: params.poNumber,
        supplierId: params.supplierId,
        amount: params.amount,
        status: "Pending",
        dueDate: params.dueDate,
        date: new Date().toISOString().slice(0, 10),
        createdAt: Timestamp.now().toMillis()
    });
    return invoiceNo;
}

/** Records a payment against a supplier invoice and flips it to Paid — same atomic pairing as recordPayment. */
export async function recordSupplierPayment(params: {
    invoiceId: string;
    invoiceNo: string;
    supplierId: string;
    amount: number;
    method: SupplierPaymentMethod;
}): Promise<void> {
    const invoiceRef = doc(db, "supplierInvoices", params.invoiceId);

    await runTransaction(db, async (tx) => {
        const paymentRef = doc(collection(db, "supplierPayments"));
        tx.set(paymentRef, {
            invoiceId: params.invoiceId,
            invoiceNo: params.invoiceNo,
            supplierId: params.supplierId,
            amount: params.amount,
            method: params.method,
            date: new Date().toISOString().slice(0, 10),
            createdAt: Timestamp.now().toMillis()
        });

        tx.update(invoiceRef, { status: "Paid" });
    });
}
