import { db } from "../firebase";
import {
    collection,
    query,
    where,
    orderBy,
    addDoc,
    updateDoc,
    doc,
    getDoc,
    getDocs,
    runTransaction,
    QueryConstraint
} from "firebase/firestore";
import {
    Appointment,
    Prescription,
    ConsultationInvoice,
    DiagnosisReport,
    Patient,
    InventoryItem,
    InventoryUsage,
    Payment
} from "../types";

export function getDoctorAppointmentsQuery(doctorId: string): QueryConstraint[] {
    return [where("doctorId", "==", doctorId), orderBy("createdAt", "desc")];
}

export function getDoctorPrescriptionsQuery(doctorId: string): QueryConstraint[] {
    return [where("doctorId", "==", doctorId), orderBy("createdAt", "desc")];
}

export function getDoctorDiagnosisQuery(doctorId: string): QueryConstraint[] {
    return [where("doctorId", "==", doctorId), orderBy("createdAt", "desc")];
}

export function getDoctorInvoicesQuery(doctorId: string): QueryConstraint[] {
    // Consultation invoices tied to appointments with doctorId or matching patient list
    return [orderBy("createdAt", "desc")];
}

export async function updateAppointmentStatus(appointmentId: string, status: Appointment["status"]) {
    const ref = doc(db, "appointments", appointmentId);
    await updateDoc(ref, { status });
}

export async function getDoctorPatients(doctorId: string): Promise<Patient[]> {
    const apptsRef = collection(db, "appointments");
    const q = query(apptsRef, where("doctorId", "==", doctorId));
    const snap = await getDocs(q);
    const patientIds = Array.from(new Set(snap.docs.map(d => d.data().patientId)));

    if (patientIds.length === 0) return [];

    const patients: Patient[] = [];
    for (const pid of patientIds) {
        if (!pid) continue;
        const pSnap = await getDoc(doc(db, "patients", pid));
        if (pSnap.exists()) {
            patients.push({ id: pSnap.id, ...pSnap.data() } as Patient);
        }
    }
    return patients;
}

export async function createPrescription(data: Omit<Prescription, "id" | "createdAt" | "dispensed">) {
    const ref = collection(db, "prescriptions");
    const docRef = await addDoc(ref, {
        ...data,
        dispensed: false,
        createdAt: Date.now()
    });
    return docRef.id;
}

export async function createDiagnosisReport(data: Omit<DiagnosisReport, "id" | "createdAt">) {
    const ref = collection(db, "diagnosisReports");
    const docRef = await addDoc(ref, {
        ...data,
        createdAt: Date.now()
    });
    return docRef.id;
}

export async function createDoctorInvoice(data: Omit<ConsultationInvoice, "id" | "createdAt">) {
    const ref = collection(db, "consultationInvoices");
    const docRef = await addDoc(ref, {
        ...data,
        createdAt: Date.now()
    });
    return docRef.id;
}

export async function recordPayment(data: Omit<Payment, "id" | "createdAt">) {
    const payRef = collection(db, "payments");
    const payDoc = await addDoc(payRef, {
        ...data,
        createdAt: Date.now()
    });

    // Update invoice status if fully paid
    const invRef = doc(db, "consultationInvoices", data.invoiceId);
    await updateDoc(invRef, { status: "Paid" });
    return payDoc.id;
}

export async function recordInventoryUsageAndDeduct(data: {
    appointmentId: string;
    invoiceId?: string;
    itemId: string;
    qtyUsed: number;
    date: string;
}) {
    await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, "inventory", data.itemId);
        const itemSnap = await transaction.get(itemRef);

        if (!itemSnap.exists()) {
            throw new Error("Inventory item does not exist!");
        }

        const currentQty = itemSnap.data().stockQty || 0;
        const itemName = itemSnap.data().itemName || "";
        if (currentQty < data.qtyUsed) {
            throw new Error(`Insufficient stock for ${itemName}. Remaining: ${currentQty}`);
        }

        // Deduct stock
        transaction.update(itemRef, { stockQty: currentQty - data.qtyUsed });

        // Record usage
        const usageRef = doc(collection(db, "inventoryUsage"));
        transaction.set(usageRef, {
            appointmentId: data.appointmentId,
            invoiceId: data.invoiceId || "",
            itemId: data.itemId,
            itemName,
            qtyUsed: data.qtyUsed,
            date: data.date,
            createdAt: Date.now()
        });
    });
}
