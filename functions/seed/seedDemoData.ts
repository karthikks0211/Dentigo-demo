import { config } from "dotenv";
config({ path: ".env" });

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEMO_MARKER = "demo-dr-strange-john";

export async function seedDemoData() {
    console.log("=== SEEDING DEMO DATA (Dr. Strange ⟷ John) ===");

    const doctorId = "doc-strange";
    const patientId = "pat-john";

    // 1. Ensure Doctor Dr. Strange
    const docRef = doc(db, "doctors", doctorId);
    if (!(await getDoc(docRef)).exists()) {
        await setDoc(docRef, {
            name: "Dr. Stephen Strange",
            specialty: "Maxillofacial & Cosmetic Dentistry",
            phone: "+91 98765 11111",
            email: "dr.strange@clinic.com",
            photoColor: "#0369a1",
            weeklyAvailability: [
                { day: "Mon", startTime: "09:00", endTime: "17:00", slotDurationMins: 30 },
                { day: "Wed", startTime: "09:00", endTime: "17:00", slotDurationMins: 30 },
                { day: "Fri", startTime: "09:00", endTime: "17:00", slotDurationMins: 30 }
            ],
            blockedDates: [],
            seedSource: DEMO_MARKER,
            createdAt: Date.now()
        });
        console.log("Created doctor: Dr. Stephen Strange (doc-strange)");
    } else {
        console.log("Doctor doc-strange already exists. Skipped insertion.");
    }

    // 2. Ensure Patient John
    const patRef = doc(db, "patients", patientId);
    if (!(await getDoc(patRef)).exists()) {
        await setDoc(patRef, {
            name: "John",
            email: "john@patient.com",
            phone: "+91 98765 22222",
            age: 35,
            gender: "Male",
            address: "742 Evergreen Terrace, Springfield",
            seedSource: DEMO_MARKER,
            createdAt: Date.now()
        });
        console.log("Created patient: John (pat-john)");
    } else {
        console.log("Patient pat-john already exists. Skipped insertion.");
    }

    // 3. Appointments
    const appointments: Record<string, any> = {
        "appt-strange-john-1": {
            patientId, doctorId, date: "2026-08-15", time: "10:00 AM", treatment: "Root Canal Treatment", status: "Completed", seedSource: DEMO_MARKER, createdAt: Date.now() - 600000
        },
        "appt-strange-john-2": {
            patientId, doctorId, date: "2026-08-18", time: "02:30 PM", treatment: "Crown Fitting (Zirconia)", status: "Completed", seedSource: DEMO_MARKER, createdAt: Date.now() - 300000
        },
        "appt-strange-john-3": {
            patientId, doctorId, date: "2026-08-22", time: "11:15 AM", treatment: "Post-Op Checkup", status: "Pending", seedSource: DEMO_MARKER, createdAt: Date.now()
        }
    };

    for (const [id, data] of Object.entries(appointments)) {
        const ref = doc(db, "appointments", id);
        if (!(await getDoc(ref)).exists()) {
            await setDoc(ref, data);
            console.log(`Seeded appointment ${id}`);
        }
    }

    // 4. Prescriptions
    const rxRef = doc(db, "prescriptions", "rx-strange-john-1");
    if (!(await getDoc(rxRef)).exists()) {
        await setDoc(rxRef, {
            patientId,
            doctorId,
            diagnosis: "Acute Periapical Periodontitis",
            medicines: [
                { medicineId: "med-amoxicillin", name: "Amoxicillin 500mg", dosage: "1 capsule", frequency: "Three times daily", durationDays: 5, quantity: 15 },
                { medicineId: "med-ibuprofen", name: "Ibuprofen 400mg", dosage: "1 tablet", frequency: "As needed for pain", durationDays: 3, quantity: 6 }
            ],
            notes: "Take medicines strictly after meals. Avoid cold drinks.",
            date: "2026-08-15",
            dispensed: true,
            seedSource: DEMO_MARKER,
            createdAt: Date.now() - 500000
        });
        console.log("Seeded prescription rx-strange-john-1");
    }

    // 5. Diagnosis Reports
    const diagRef = doc(db, "diagnosisReports", "diag-strange-john-1");
    if (!(await getDoc(diagRef)).exists()) {
        await setDoc(diagRef, {
            patientId,
            doctorId,
            appointmentId: "appt-strange-john-1",
            reportType: "Dental X-Ray (IOPA/OPG)",
            title: "Pre-RCT IOPA X-Ray Tooth #21",
            toothNumber: "21",
            clinicalNotes: "Deep carious involvement approaching pulp chamber. Apical radiolucency observed.",
            fileUrl: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80",
            fileName: "IOPA_John_Tooth21.jpg",
            fileSizeBytes: 1250000,
            mimeType: "image/jpeg",
            reportDate: "2026-08-15",
            seedSource: DEMO_MARKER,
            createdAt: Date.now() - 500000
        });
        console.log("Seeded diagnosis report diag-strange-john-1");
    }

    // 6. Invoices & Payments
    const inv1Ref = doc(db, "consultationInvoices", "cinv-strange-john-1");
    if (!(await getDoc(inv1Ref)).exists()) {
        await setDoc(inv1Ref, {
            invoiceNo: "CN-STRANGE-001",
            patientId,
            appointmentId: "appt-strange-john-1",
            items: "Root Canal Treatment + IOPA X-Ray",
            amount: 6500,
            status: "Paid",
            dueDate: "2026-08-20",
            date: "2026-08-15",
            seedSource: DEMO_MARKER,
            createdAt: Date.now() - 500000
        });
        console.log("Seeded invoice cinv-strange-john-1");
    }

    const inv2Ref = doc(db, "consultationInvoices", "cinv-strange-john-2");
    if (!(await getDoc(inv2Ref)).exists()) {
        await setDoc(inv2Ref, {
            invoiceNo: "CN-STRANGE-002",
            patientId,
            appointmentId: "appt-strange-john-2",
            items: "Crown Fitting (Zirconia)",
            amount: 9000,
            status: "Pending",
            dueDate: "2026-08-25",
            date: "2026-08-18",
            seedSource: DEMO_MARKER,
            createdAt: Date.now() - 200000
        });
        console.log("Seeded invoice cinv-strange-john-2");
    }

    const payRef = doc(db, "payments", "pay-strange-john-1");
    if (!(await getDoc(payRef)).exists()) {
        await setDoc(payRef, {
            invoiceId: "cinv-strange-john-1",
            invoiceType: "Consultation",
            invoiceNo: "CN-STRANGE-001",
            patientId,
            amount: 6500,
            method: "Card",
            date: "2026-08-15",
            seedSource: DEMO_MARKER,
            createdAt: Date.now() - 400000
        });
        console.log("Seeded payment pay-strange-john-1");
    }

    // 7. Inventory & Usage
    const invItem1 = doc(db, "inventory", "inv-paracetamol-500");
    if (!(await getDoc(invItem1)).exists()) {
        await setDoc(invItem1, {
            itemName: "Paracetamol 500mg",
            stockQty: 120,
            unit: "tablets",
            reorderLevel: 25,
            seedSource: DEMO_MARKER,
            createdAt: Date.now()
        });
    }

    const invItem2 = doc(db, "inventory", "inv-surgical-gloves");
    if (!(await getDoc(invItem2)).exists()) {
        await setDoc(invItem2, {
            itemName: "Surgical Gloves (M)",
            stockQty: 8, // Low stock indicator test!
            unit: "pairs",
            reorderLevel: 15,
            seedSource: DEMO_MARKER,
            createdAt: Date.now()
        });
    }

    const usageRef = doc(db, "inventoryUsage", "usage-strange-john-1");
    if (!(await getDoc(usageRef)).exists()) {
        await setDoc(usageRef, {
            appointmentId: "appt-strange-john-1",
            invoiceId: "cinv-strange-john-1",
            itemId: "inv-surgical-gloves",
            itemName: "Surgical Gloves (M)",
            qtyUsed: 2,
            date: "2026-08-15",
            seedSource: DEMO_MARKER,
            createdAt: Date.now() - 450000
        });
        console.log("Seeded inventory usage entry");
    }

    console.log("=== DEMO SEEDING COMPLETE ===");
}
