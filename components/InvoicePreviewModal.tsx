"use client";

import { Download } from "lucide-react";
import type { InvoicePreviewData } from "@/lib/invoice-preview";

export default function InvoicePreviewModal({
    invoice,
    onClose
}: {
    invoice: InvoicePreviewData;
    onClose: () => void;
}) {
    return (
        <div className="modalOverlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modalCard invoicePreviewCard">
                <div className="modalHead">
                    <h3>Invoice Preview</h3>
                    <button className="closeBtn" onClick={onClose} aria-label="Close">&times;</button>
                </div>
                <div className="modalBody" style={{ padding: 0 }}>
                    <div className="invoicePrintArea">
                        <div className="invoicePreviewHead">
                            <div>
                                <strong>DentiGO Dental Clinic</strong>
                                <p>Dental Care Platform</p>
                            </div>
                            <div className="invoicePreviewMeta">
                                <p><span>Invoice #</span><b>{invoice.invoiceNo}</b></p>
                                <p><span>Type</span><b>{invoice.type}</b></p>
                                <p><span>Date</span><b>{invoice.date}</b></p>
                                {invoice.dueDate && <p><span>Due Date</span><b>{invoice.dueDate}</b></p>}
                                {invoice.status && <p><span>Status</span><b>{invoice.status}</b></p>}
                            </div>
                        </div>

                        <div className="invoicePreviewParty">
                            <span>Billed To</span>
                            <b>{invoice.patientName}</b>
                        </div>

                        <table className="invoicePreviewTable">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th>Unit Price</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.lines.map((l, i) => (
                                    <tr key={i}>
                                        <td>{l.name}</td>
                                        <td>{l.qty}</td>
                                        <td>₹{l.unitPrice.toLocaleString()}</td>
                                        <td>₹{l.total.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={3}>Total</td>
                                    <td>₹{invoice.amount.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                <div className="modalFoot">
                    <button onClick={onClose}>Close</button>
                    <button className="primary" onClick={() => window.print()}>
                        <Download size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Download / Print
                    </button>
                </div>
            </div>
        </div>
    );
}
