"use client";

import { useState } from "react";
import { useDoctorAuth } from "@/lib/hooks/useDoctorAuth";
import { useCollection } from "@/lib/firestore-hooks";
import {
    getDoctorInvoicesQuery,
    createDoctorInvoice,
    recordPayment,
    recordInventoryUsageAndDeduct
} from "@/lib/firestore/doctorPortal";
import { ConsultationInvoice, Patient, InventoryItem, InventoryUsage } from "@/lib/types";
import { Plus, CreditCard, Box, AlertTriangle, CheckCircle } from "lucide-react";

export default function DoctorInvoicesPage() {
    const { claims } = useDoctorAuth();
    const doctorId = claims?.doctorId || "";

    const { data: invoices, loading: invLoading } = useCollection<ConsultationInvoice>(
        "consultationInvoices",
        doctorId ? getDoctorInvoicesQuery(doctorId) : [],
        [doctorId]
    );

    const { data: patients } = useCollection<Patient>("patients");
    const { data: inventory, loading: stockLoading } = useCollection<InventoryItem>("inventory");
    const { data: usageList } = useCollection<InventoryUsage>("inventoryUsage");

    const [activeTab, setActiveTab] = useState<"invoices" | "inventory">("invoices");

    // Modal state for Invoice
    const [showInvModal, setShowInvModal] = useState(false);
    const [patientId, setPatientId] = useState("");
    const [items, setItems] = useState("");
    const [amount, setAmount] = useState(2500);
    const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
    const [submittingInv, setSubmittingInv] = useState(false);

    // Modal state for Inventory Usage
    const [showStockModal, setShowStockModal] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState("");
    const [qtyUsed, setQtyUsed] = useState(1);
    const [appId, setAppId] = useState("appt-general");
    const [submittingStock, setSubmittingStock] = useState(false);

    const handleCreateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientId || !items || !amount) {
            alert("Please fill in required invoice fields.");
            return;
        }

        setSubmittingInv(true);
        try {
            await createDoctorInvoice({
                invoiceNo: "CN-STRANGE-" + Math.floor(100 + Math.random() * 900),
                patientId,
                appointmentId: "appt-custom-" + Date.now(),
                items,
                amount,
                status: "Pending",
                dueDate,
                date: new Date().toISOString().slice(0, 10)
            });
            setShowInvModal(false);
            setItems("");
        } catch (err: any) {
            alert("Error creating invoice: " + err.message);
        } finally {
            setSubmittingInv(false);
        }
    };

    const handleDeductStock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItemId || qtyUsed <= 0) {
            alert("Please select item and quantity.");
            return;
        }

        setSubmittingStock(true);
        try {
            await recordInventoryUsageAndDeduct({
                appointmentId: appId,
                itemId: selectedItemId,
                qtyUsed,
                date: new Date().toISOString().slice(0, 10)
            });
            setShowStockModal(false);
            setQtyUsed(1);
        } catch (err: any) {
            alert(err.message || "Failed to record usage.");
        } finally {
            setSubmittingStock(false);
        }
    };

    if (invLoading || stockLoading) return <div style={{ padding: 20 }}>Loading billing & inventory...</div>;

    return (
        <div>
            {/* Header Tabs */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Billing & Inventory</h1>
                    <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>Create consultation invoices, record payments, and track surgical inventory stock.</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        onClick={() => setShowInvModal(true)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#0369a1", color: "#fff", border: 0, padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                        <Plus size={16} /> Create Invoice
                    </button>
                    <button
                        onClick={() => setShowStockModal(true)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#087f78", color: "#fff", border: 0, padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                        <Box size={16} /> Record Inventory Usage
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: "flex", gap: 12, borderBottom: "2px solid #e2e8f0", marginBottom: 24 }}>
                <button
                    onClick={() => setActiveTab("invoices")}
                    style={{ padding: "10px 18px", border: 0, background: "transparent", fontSize: 15, fontWeight: 600, color: activeTab === "invoices" ? "#0369a1" : "#64748b", borderBottom: activeTab === "invoices" ? "3px solid #0369a1" : "3px solid transparent", cursor: "pointer" }}
                >
                    Consultation Invoices
                </button>
                <button
                    onClick={() => setActiveTab("inventory")}
                    style={{ padding: "10px 18px", border: 0, background: "transparent", fontSize: 15, fontWeight: 600, color: activeTab === "inventory" ? "#0369a1" : "#64748b", borderBottom: activeTab === "inventory" ? "3px solid #0369a1" : "3px solid transparent", cursor: "pointer" }}
                >
                    Clinic Inventory Stock
                </button>
            </div>

            {activeTab === "invoices" ? (
                <div>
                    {invoices.length === 0 ? (
                        <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                            No invoices generated yet.
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 14 }}>
                            {invoices.map((inv) => (
                                <div key={inv.id} style={{ background: "#fff", padding: 18, borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>{inv.invoiceNo}</span>
                                            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: inv.status === "Paid" ? "#dcfce7" : "#fef3c7", color: inv.status === "Paid" ? "#166534" : "#92400e" }}>
                                                {inv.status}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 14, color: "#475569", marginTop: 4 }}>{inv.items}</div>
                                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Patient Doc ID: <code>{inv.patientId}</code> | Date: {inv.date}</div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>₹{inv.amount.toLocaleString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Stock & Reorder Levels</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16, marginBottom: 28 }}>
                        {inventory.map((item) => {
                            const isLow = item.stockQty <= item.reorderLevel;
                            return (
                                <div key={item.id} style={{ background: "#fff", padding: 18, borderRadius: 12, border: isLow ? "2px solid #f87171" : "1px solid #e2e8f0" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{item.itemName}</span>
                                        {isLow && (
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fef2f2", color: "#dc2626", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                                                <AlertTriangle size={12} /> Low Stock
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: isLow ? "#dc2626" : "#087f78", marginTop: 8 }}>
                                        {item.stockQty} <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>{item.unit}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Reorder Threshold: {item.reorderLevel} {item.unit}</div>
                                </div>
                            );
                        })}
                    </div>

                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Recent Usage Log</h3>
                    <div style={{ display: "grid", gap: 10 }}>
                        {usageList.map((u) => (
                            <div key={u.id} style={{ background: "#fff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                <div>
                                    <strong>{u.itemName}</strong> ({u.qtyUsed} unit used)
                                    <div style={{ fontSize: 11, color: "#64748b" }}>Appointment ID: {u.appointmentId}</div>
                                </div>
                                <div style={{ color: "#64748b" }}>{u.date}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal for Create Invoice */}
            {showInvModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100 }}>
                    <div style={{ background: "#fff", padding: 28, borderRadius: 12, width: "100%", maxWidth: 480 }}>
                        <h2 style={{ margin: "0 0 16px", fontSize: 20, color: "#0f172a" }}>Generate Consultation Invoice</h2>
                        <form onSubmit={handleCreateInvoice} style={{ display: "grid", gap: 14 }}>
                            <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Select Patient</label>
                                <select required value={patientId} onChange={e => setPatientId(e.target.value)} style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }}>
                                    <option value="">-- Choose Patient --</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Items / Particulars</label>
                                <input type="text" required value={items} onChange={e => setItems(e.target.value)} placeholder="e.g. Crown Fitting + X-Ray" style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Amount (₹)</label>
                                    <input type="number" required value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Due Date</label>
                                    <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                                </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                                <button type="button" onClick={() => setShowInvModal(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f1f5f9", cursor: "pointer" }}>Cancel</button>
                                <button type="submit" disabled={submittingInv} style={{ padding: "8px 16px", borderRadius: 6, border: 0, background: "#0369a1", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{submittingInv ? "Generating..." : "Create Invoice"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for Inventory Usage */}
            {showStockModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 100 }}>
                    <div style={{ background: "#fff", padding: 28, borderRadius: 12, width: "100%", maxWidth: 450 }}>
                        <h2 style={{ margin: "0 0 16px", fontSize: 20, color: "#0f172a" }}>Record Inventory Usage</h2>
                        <form onSubmit={handleDeductStock} style={{ display: "grid", gap: 14 }}>
                            <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Select Item</label>
                                <select required value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }}>
                                    <option value="">-- Choose Inventory Item --</option>
                                    {inventory.map(item => (
                                        <option key={item.id} value={item.id}>{item.itemName} (Stock: {item.stockQty} {item.unit})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155" }}>Quantity Used</label>
                                <input type="number" required min={1} value={qtyUsed} onChange={e => setQtyUsed(Number(e.target.value))} style={{ width: "100%", height: 40, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                                <button type="button" onClick={() => setShowStockModal(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f1f5f9", cursor: "pointer" }}>Cancel</button>
                                <button type="submit" disabled={submittingStock} style={{ padding: "8px 16px", borderRadius: 6, border: 0, background: "#087f78", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{submittingStock ? "Deducting..." : "Record & Deduct Stock"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
