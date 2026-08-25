import { collection, doc, runTransaction, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { AttendanceEntry, AttendanceStatus, Employee, PayrollLine, SupplierPaymentMethod } from "./types";

/**
 * Marks/overwrites attendance for a set of employees on one date. Doc id is
 * `${employeeId}_${date}` on purpose — re-marking the same day upserts
 * instead of piling up duplicate entries, with no query needed first.
 */
export async function markAttendance(params: {
    date: string;
    entries: { employeeId: string; status: AttendanceStatus }[];
    markedBy: string;
}): Promise<void> {
    await Promise.all(
        params.entries.map((e) =>
            setDoc(doc(db, "attendance", `${e.employeeId}_${params.date}`), {
                employeeId: e.employeeId,
                date: params.date,
                status: e.status,
                markedBy: params.markedBy,
                createdAt: Timestamp.now().toMillis()
            })
        )
    );
}

// Present pays a full day, Half Day pays half, Absent/Leave are unpaid — a
// flat policy that keeps this a demo-scoped payroll, not a full HR engine.
const PAYABLE_DAYS: Record<AttendanceStatus, number> = {
    Present: 1,
    "Half Day": 0.5,
    Absent: 0,
    Leave: 0
};

/**
 * Pure computation, no I/O — walks one month ("2026-08") of attendance per
 * active employee and prices it at a flat monthlySalary / 30 per-day rate.
 * Nothing is persisted until finalizePayrollRun() is called on the result.
 */
export function computePayrollPreview(
    period: string,
    employees: Employee[],
    attendance: AttendanceEntry[]
): { lines: PayrollLine[]; totalPayout: number } {
    const lines: PayrollLine[] = employees
        .filter((e) => e.active)
        .map((emp) => {
            const forEmployee = attendance.filter((a) => a.employeeId === emp.id && a.date.startsWith(period));
            const count = (status: AttendanceStatus) => forEmployee.filter((a) => a.status === status).length;
            const daysPresent = count("Present");
            const daysHalf = count("Half Day");
            const daysAbsent = count("Absent");
            const daysLeave = count("Leave");
            const payableDays = daysPresent * PAYABLE_DAYS.Present + daysHalf * PAYABLE_DAYS["Half Day"];
            const perDayRate = Math.round((emp.monthlySalary / 30) * 100) / 100;
            const grossPay = Math.round(payableDays * perDayRate);

            return { employeeId: emp.id, name: emp.name, role: emp.role, daysPresent, daysHalf, daysAbsent, daysLeave, payableDays, perDayRate, grossPay };
        });

    return { lines, totalPayout: lines.reduce((sum, l) => sum + l.grossPay, 0) };
}

/**
 * Persists a computed payroll run and its disbursement together — mirrors
 * the invoice+payment pairing in lib/invoices.ts, just with no separate
 * pending stage: finalizing a run pays it immediately.
 */
export async function finalizePayrollRun(params: {
    period: string;
    periodLabel: string;
    lines: PayrollLine[];
    totalPayout: number;
    generatedBy: string;
    method: SupplierPaymentMethod;
}): Promise<string> {
    const runRef = doc(collection(db, "payrollRuns"));
    const paymentRef = doc(collection(db, "payrollPayments"));
    const date = new Date().toISOString().slice(0, 10);

    await runTransaction(db, async (tx) => {
        tx.set(runRef, {
            period: params.period,
            periodLabel: params.periodLabel,
            lines: params.lines,
            totalPayout: params.totalPayout,
            status: "Finalized",
            generatedBy: params.generatedBy,
            createdAt: Timestamp.now().toMillis()
        });

        tx.set(paymentRef, {
            payrollRunId: runRef.id,
            period: params.period,
            periodLabel: params.periodLabel,
            amount: params.totalPayout,
            method: params.method,
            date,
            createdAt: Timestamp.now().toMillis()
        });
    });

    return runRef.id;
}
