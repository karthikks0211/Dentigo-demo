import type { Appointment, Doctor, DayOfWeek } from "./types";

const DAY_NAMES: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayOfWeek(dateIso: string): DayOfWeek {
    return DAY_NAMES[new Date(dateIso + "T00:00:00").getDay()];
}

function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
}

function formatTime(totalMinutes: number): string {
    let h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Generates every bookable time slot for a doctor on a given date, minus already-taken slots. */
export function getAvailableSlots(doctor: Doctor, dateIso: string, existingAppointments: Appointment[]): string[] {
    if (doctor.blockedDates.includes(dateIso)) return [];

    const day = dayOfWeek(dateIso);
    const daySlots = doctor.weeklyAvailability.filter((s) => s.day === day);
    if (daySlots.length === 0) return [];

    const taken = new Set(
        existingAppointments
            .filter((a) => a.doctorId === doctor.id && a.date === dateIso && a.status !== "Cancelled")
            .map((a) => a.time)
    );

    const slots: string[] = [];
    for (const range of daySlots) {
        const start = toMinutes(range.startTime);
        const end = toMinutes(range.endTime);
        for (let t = start; t + range.slotDurationMins <= end; t += range.slotDurationMins) {
            const label = formatTime(t);
            if (!taken.has(label)) slots.push(label);
        }
    }
    return slots;
}

export function nextNDates(n: number): string[] {
    const dates: string[] = [];
    for (let i = 0; i < n; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
}
