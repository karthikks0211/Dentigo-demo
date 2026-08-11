import type { ConsultationInvoice, PharmacyInvoice } from "@/lib/types";

export type InvoicePreviewLine = {
    name: string;
    qty: number;
    unitPrice: number;
    total: number;
};

export type InvoicePreviewData = {
    invoiceNo: string;
    type: "Consultation" | "Pharmacy";
    patientName: string;
    date: string;
    status?: string;
    dueDate?: string;
    lines: InvoicePreviewLine[];
    amount: number;
};

export function consultationToPreview(inv: ConsultationInvoice, patientName: string): InvoicePreviewData {
    return {
        invoiceNo: inv.invoiceNo,
        type: "Consultation",
        patientName,
        date: inv.date,
        status: inv.status,
        dueDate: inv.dueDate,
        lines: [{ name: inv.items, qty: 1, unitPrice: inv.amount, total: inv.amount }],
        amount: inv.amount
    };
}

export function pharmacyToPreview(inv: PharmacyInvoice, patientName: string): InvoicePreviewData {
    return {
        invoiceNo: inv.invoiceNo,
        type: "Pharmacy",
        patientName,
        date: inv.date,
        lines: inv.lines.map((l) => ({ name: l.name, qty: l.qty, unitPrice: l.unitPrice, total: l.total })),
        amount: inv.totalAmount
    };
}
