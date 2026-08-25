"use client";

import { useEffect } from "react";

export default function PaymentSuccessOverlay({
    amount,
    label,
    onDone,
    duration = 1400
}: {
    amount?: number;
    label?: string;
    onDone: () => void;
    duration?: number;
}) {
    useEffect(() => {
        const t = setTimeout(onDone, duration);
        return () => clearTimeout(t);
    }, [onDone, duration]);

    return (
        <div className="paymentSuccessOverlay">
            <div className="paymentSuccessCard">
                <svg className="successCheckmark" viewBox="0 0 52 52">
                    <circle className="successCheckmarkCircle" cx="26" cy="26" r="24" />
                    <path className="successCheckmarkTick" d="M14 27l7 7 16-16" />
                </svg>
                <p className="successCheckmarkTitle">Payment Successful</p>
                {typeof amount === "number" && <p className="successCheckmarkAmount">₹{amount.toLocaleString()}</p>}
                {label && <p className="successCheckmarkLabel">{label}</p>}
            </div>
        </div>
    );
}
