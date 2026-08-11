"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import { consultationToPreview, pharmacyToPreview, type InvoicePreviewData } from "@/lib/invoice-preview";
import type { ConsultationInvoice, Patient, PharmacyInvoice } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import InvoicePreviewModal from "@/components/InvoicePreviewModal";
import PillLoader from "@/components/PillLoader";

type Row = {
    id: string;
    type: "Consultation" | "Pharmacy";
    invoiceNo: string;
    patientId: string;
    description: string;
    amount: number;
    date: string;
    status: string;
};

export default function SalesHistoryPage() {
    const { data: consultations, loading: l1 } = useCollection<ConsultationInvoice>("consultationInvoices");
    const { data: pharmacy, loading: l2 } = useCollection<PharmacyInvoice>("pharmacyInvoices");
    const { data: patients } = useCollection<Patient>("patients");
    const [query, setQuery] = useState("");
    const [previewRef, setPreviewRef] = useState<{ id: string; type: "Consultation" | "Pharmacy" } | null>(null);

    const patientFor = (id: string) => patients.find((p) => p.id === id)?.name || "Unknown patient";

    const rows: Row[] = useMemo(() => {
        const a: Row[] = consultations.map((i) => ({
            id: i.id, type: "Consultation", invoiceNo: i.invoiceNo, patientId: i.patientId,
            description: i.items, amount: i.amount, date: i.date, status: i.status
        }));
        const b: Row[] = pharmacy.map((i) => ({
            id: i.id, type: "Pharmacy", invoiceNo: i.invoiceNo, patientId: i.patientId,
            description: i.lines.map((l) => l.name).join(", "), amount: i.totalAmount, date: i.date, status: "Dispensed"
        }));
        return [...a, ...b].sort((x, y) => (x.date < y.date ? 1 : -1));
    }, [consultations, pharmacy]);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return rows.filter((r) => patientFor(r.patientId).toLowerCase().includes(q) || r.invoiceNo.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, query, patients]);

    const totalSales = rows.reduce((sum, r) => sum + r.amount, 0);

    function previewFor(id: string, type: "Consultation" | "Pharmacy"): InvoicePreviewData | null {
        if (type === "Consultation") {
            const inv = consultations.find((i) => i.id === id);
            return inv ? consultationToPreview(inv, patientFor(inv.patientId)) : null;
        }
        const inv = pharmacy.find((i) => i.id === id);
        return inv ? pharmacyToPreview(inv, patientFor(inv.patientId)) : null;
    }

    const previewData = previewRef ? previewFor(previewRef.id, previewRef.type) : null;

    if (l1 || l2) return <PillLoader label="Loading sales history…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Sales History</h1>
                    <p>Every pharmacy and consultation invoice issued, newest first.</p>
                </div>
            </div>

            <div className="summary">
                <div><span>{rows.length}</span><strong>Total Invoices</strong></div>
                <div><span>₹{totalSales.toLocaleString()}</span><strong>Total Billed</strong></div>
                <div><span>{pharmacy.length}</span><strong>Pharmacy</strong></div>
                <div><span>{consultations.length}</span><strong>Consultation</strong></div>
            </div>

            <div className="card tableCard">
                <div className="tableTools">
                    <div className="search">
                        <Search size={15} className="searchIcon" />
                        <input placeholder="Search invoices…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Type</th>
                                <th>Patient</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={7}><div className="empty">⌕<br /><strong>No invoices found</strong></div></td></tr>
                            ) : (
                                filtered.map((r) => (
                                    <tr key={`${r.type}-${r.id}`}>
                                        <td><button className="invoiceNoLink" onClick={() => setPreviewRef({ id: r.id, type: r.type })}>{r.invoiceNo}</button></td>
                                        <td><span className={`badge ${r.type === "Pharmacy" ? "teal" : "confirmed"}`}><i />{r.type}</span></td>
                                        <td>{patientFor(r.patientId)}</td>
                                        <td>{r.description}</td>
                                        <td>₹{r.amount.toLocaleString()}</td>
                                        <td>{r.date}</td>
                                        <td><Badge status={r.status} /></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {previewData && (
                <InvoicePreviewModal invoice={previewData} onClose={() => setPreviewRef(null)} />
            )}
        </>
    );
}
