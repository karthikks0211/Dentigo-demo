import { addDoc, collection, doc, runTransaction, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { generateInvoiceNo } from "./pharmacy";
import type { PaymentInvoiceType, PaymentMethod } from "./types";

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
