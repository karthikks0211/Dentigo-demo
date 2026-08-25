"use client";

import { useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { markAttendance } from "@/lib/hr";
import type { AttendanceEntry, AttendanceStatus, Employee } from "@/lib/types";
import PillLoader from "@/components/PillLoader";

const STATUSES: AttendanceStatus[] = ["Present", "Half Day", "Absent", "Leave"];

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
    const { data: employees, loading: l1 } = useCollection<Employee>("employees");
    const { data: attendance, loading: l2 } = useCollection<AttendanceEntry>("attendance");
    const { user } = useAuth();
    const showToast = useToast();

    const [date, setDate] = useState(todayIso());
    const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
    const [saving, setSaving] = useState(false);

    const activeEmployees = useMemo(
        () => [...employees].filter((e) => e.active).sort((a, b) => a.name.localeCompare(b.name)),
        [employees]
    );

    const existingForDate = useMemo(() => {
        const map: Record<string, AttendanceStatus> = {};
        attendance.filter((a) => a.date === date).forEach((a) => { map[a.employeeId] = a.status; });
        return map;
    }, [attendance, date]);

    function statusFor(employeeId: string): AttendanceStatus {
        return draft[employeeId] ?? existingForDate[employeeId] ?? "Present";
    }

    function setStatus(employeeId: string, status: AttendanceStatus) {
        setDraft((prev) => ({ ...prev, [employeeId]: status }));
    }

    async function handleSave() {
        if (activeEmployees.length === 0) return;
        setSaving(true);
        try {
            await markAttendance({
                date,
                entries: activeEmployees.map((e) => ({ employeeId: e.id, status: statusFor(e.id) })),
                markedBy: user?.email || "unknown"
            });
            showToast(`Attendance saved for ${date}`);
            setDraft({});
        } catch {
            showToast("Couldn't save attendance", "error");
        } finally {
            setSaving(false);
        }
    }

    const presentCount = activeEmployees.filter((e) => statusFor(e.id) === "Present").length;

    if (l1 || l2) return <PillLoader label="Loading attendance…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Attendance</h1>
                    <p>Mark the daily register — feeds straight into Payroll.</p>
                </div>
            </div>

            <div className="card tableCard">
                <div className="tableTools">
                    <label style={{ margin: 0 }}>
                        <input type="date" value={date} max={todayIso()} onChange={(e) => { setDate(e.target.value); setDraft({}); }} />
                    </label>
                    <button className="primary" onClick={handleSave} disabled={saving || activeEmployees.length === 0}>
                        <CalendarCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                        {saving ? "Saving…" : `Save Attendance (${presentCount}/${activeEmployees.length} present)`}
                    </button>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Role</th>
                                {STATUSES.map((s) => <th key={s} style={{ textAlign: "center" }}>{s}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {activeEmployees.length === 0 ? (
                                <tr><td colSpan={2 + STATUSES.length}><div className="empty"><strong>No active employees</strong><br />Add one from Employees.</div></td></tr>
                            ) : (
                                activeEmployees.map((e) => (
                                    <tr key={e.id}>
                                        <td><b>{e.name}</b></td>
                                        <td>{e.role}</td>
                                        {STATUSES.map((s) => (
                                            <td key={s} style={{ textAlign: "center" }}>
                                                <input
                                                    type="radio"
                                                    name={`status-${e.id}`}
                                                    checked={statusFor(e.id) === s}
                                                    onChange={() => setStatus(e.id, s)}
                                                    style={{ width: "auto" }}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
