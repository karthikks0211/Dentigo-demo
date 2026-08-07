"use client";

import { useMemo } from "react";
import { useCollection } from "./firestore-hooks";
import type { Medicine, Batch } from "./types";

export type AlertKind = "expiry" | "low-stock" | "out-of-stock";

export type AlertItem = {
    id: string;
    kind: AlertKind;
    message: string;
    medicineId: string;
    priority: number; // lower = more urgent
};

const EXPIRY_WINDOW_DAYS = 30;

function daysUntil(dateStr: string): number {
    const ms = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * Rule-based "AI assistant" alerts — no LLM involved. Scans live medicine/batch
 * data for near-expiry and low/out-of-stock conditions and turns them into
 * templated, assistant-styled messages.
 */
export function useAlerts(): AlertItem[] {
    const { data: medicines } = useCollection<Medicine>("medicines");
    const { data: batches } = useCollection<Batch>("batches");

    return useMemo(() => {
        const alerts: AlertItem[] = [];
        const remainingByMedicine = new Map<string, number>();

        for (const batch of batches) {
            remainingByMedicine.set(
                batch.medicineId,
                (remainingByMedicine.get(batch.medicineId) || 0) + batch.quantityRemaining
            );

            if (batch.quantityRemaining > 0) {
                const days = daysUntil(batch.expiryDate);
                if (days <= EXPIRY_WINDOW_DAYS) {
                    const medicine = medicines.find((m) => m.id === batch.medicineId);
                    const name = medicine?.name || "A medicine";
                    alerts.push({
                        id: `expiry-${batch.id}`,
                        kind: "expiry",
                        medicineId: batch.medicineId,
                        priority: Math.max(days, 0),
                        message:
                            days <= 0
                                ? `⚠️ ${name} batch ${batch.batchNo} has expired — ${batch.quantityRemaining} units remaining.`
                                : `⚠️ ${name} batch ${batch.batchNo} expires in ${days} day${days === 1 ? "" : "s"} — ${batch.quantityRemaining} units remaining.`
                    });
                }
            }
        }

        for (const medicine of medicines) {
            const remaining = remainingByMedicine.get(medicine.id) || 0;
            if (remaining === 0) {
                alerts.push({
                    id: `out-${medicine.id}`,
                    kind: "out-of-stock",
                    medicineId: medicine.id,
                    priority: -1,
                    message: `🚫 ${medicine.name} is out of stock.`
                });
            } else if (remaining <= medicine.reorderLevel) {
                alerts.push({
                    id: `low-${medicine.id}`,
                    kind: "low-stock",
                    medicineId: medicine.id,
                    priority: 100 + remaining,
                    message: `📉 ${medicine.name} is low — ${remaining} left, reorder level is ${medicine.reorderLevel}.`
                });
            }
        }

        return alerts.sort((a, b) => a.priority - b.priority);
    }, [medicines, batches]);
}
