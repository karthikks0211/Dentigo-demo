"use client";

import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";

type Stage = "form" | "processing" | "success";

export default function PaymentSimModal({
    amount,
    invoiceNo,
    onSuccess,
    onClose
}: {
    amount: number;
    invoiceNo: string;
    onSuccess: () => void;
    onClose: () => void;
}) {
    const [stage, setStage] = useState<Stage>("form");

    function pay() {
        setStage("processing");
        setTimeout(() => {
            setStage("success");
            setTimeout(onSuccess, 900);
        }, 1300);
    }

    return (
        <div className="modalOverlay" onMouseDown={(e) => { if (e.target === e.currentTarget && stage === "form") onClose(); }}>
            <div className="modalCard razorpaySim">
                <div className="razorpayHead">
                    <span className="razorpayBrand"><ShieldCheck size={16} />DentiGO Pay</span>
                    {stage === "form" && <button className="closeBtn" onClick={onClose} aria-label="Close"><X size={18} /></button>}
                </div>
                <div className="modalBody" style={{ alignItems: "center", textAlign: "center" }}>
                    {stage === "form" && (
                        <>
                            <p style={{ margin: 0, color: "var(--dg-muted)", fontSize: 12 }}>Paying invoice {invoiceNo}</p>
                            <h2 style={{ margin: "2px 0 18px", fontSize: 28 }}>₹{amount.toLocaleString()}</h2>
                            <div style={{ width: "100%", display: "grid", gap: 12, textAlign: "left" }}>
                                <label>Card Number
                                    <input defaultValue="4111 1111 1111 1111" inputMode="numeric" />
                                </label>
                                <div className="two">
                                    <label>Expiry
                                        <input defaultValue="12/29" />
                                    </label>
                                    <label>CVV
                                        <input defaultValue="123" type="password" />
                                    </label>
                                </div>
                            </div>
                            <button className="primary" style={{ width: "100%", marginTop: 18, height: 46 }} onClick={pay}>
                                Pay ₹{amount.toLocaleString()}
                            </button>
                            <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--dg-muted)" }}>Simulated checkout for demo purposes — no real charge occurs.</p>
                        </>
                    )}
                    {stage === "processing" && (
                        <div style={{ padding: "30px 0" }}>
                            <div className="pillLoaderCapsule" style={{ margin: "0 auto 16px" }}><i /><i /></div>
                            <p style={{ margin: 0, fontWeight: 600 }}>Processing payment…</p>
                        </div>
                    )}
                    {stage === "success" && (
                        <div style={{ padding: "30px 0" }} className="razorpaySuccess">
                            <svg className="successCheckmark" viewBox="0 0 52 52" style={{ margin: "0 auto" }}>
                                <circle className="successCheckmarkCircle" cx="26" cy="26" r="24" />
                                <path className="successCheckmarkTick" d="M14 27l7 7 16-16" />
                            </svg>
                            <p style={{ margin: "12px 0 0", fontWeight: 700, fontSize: 16 }}>Payment successful</p>
                            <p style={{ margin: "4px 0 0", color: "var(--dg-muted)", fontSize: 13 }}>₹{amount.toLocaleString()} received</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
