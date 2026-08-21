import { db } from "../firebase";
import {
    collection,
    query,
    where,
    orderBy,
    addDoc,
    doc,
    getDoc,
    getDocs,
    QueryConstraint
} from "firebase/firestore";
import { Appointment, Prescription, ConsultationInvoice, DiagnosisReport, Doctor } from "../types";

export function getPatientAppointmentsQuery(patientId: string): QueryConstraint[] {
    return [where("patientId", "==", patientId), orderBy("createdAt", "desc")];
}

export function getPatientPrescriptionsQuery(patientId: string): QueryConstraint[] {
    return [where("patientId", "==", patientId), orderBy("createdAt", "desc")];
}

export function getPatientDiagnosisQuery(patientId: string): QueryConstraint[] {
    return [where("patientId", "==", patientId), orderBy("createdAt", "desc")];
}

export function getPatientInvoicesQuery(patientId: string): QueryConstraint[] {
    return [where("patientId", "==", patientId), orderBy("createdAt", "desc")];
}

export async function bookPatientAppointment(data: {
    patientId: string;
    doctorId: string;
    date: string;
    time: string;
    treatment: string;
}) {
    const apptsRef = collection(db, "appointments");
    const newDoc = await addDoc(apptsRef, {
        ...data,
        status: "Pending",
        createdAt: Date.now()
    });
    return newDoc.id;
}

export async function getVisitedDoctors(patientId: string): Promise<Doctor[]> {
    const apptsRef = collection(db, "appointments");
    const q = query(apptsRef, where("patientId", "==", patientId));
    const snap = await getDocs(q);
    const doctorIds = Array.from(new Set(snap.docs.map(d => d.data().doctorId)));
    
    if (doctorIds.length === 0) return [];

    const doctors: Doctor[] = [];
    for (const docId of doctorIds) {
        if (!docId) continue;
        const dSnap = await getDoc(doc(db, "doctors", docId));
        if (dSnap.exists()) {
            doctors.push({ id: dSnap.id, ...dSnap.data() } as Doctor);
        }
    }
    return doctors;
}
