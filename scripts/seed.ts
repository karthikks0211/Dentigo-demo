/**
 * Seeds Firebase Auth (the one demo login) and Firestore with a rich sample
 * dataset so every DentiGO screen has real content on first login.
 *
 * Usage: fill in .env.local from .env.example, then `npm run seed`.
 * Safe to re-run — it overwrites the same deterministic doc IDs each time.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { initializeApp } from "firebase/app";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

if (!firebaseConfig.apiKey) {
    console.error("Missing Firebase config. Copy .env.example to .env.local and fill it in first.");
    process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SEED_EMAIL = process.env.SEED_EMAIL || "admin@dentigo.dev";
const SEED_PASSWORD = process.env.SEED_PASSWORD || "Dentigo@123";

// One shared demo password for every seeded patient — lets the mobile app's
// patient login be demoed against any of them without hunting for per-patient
// credentials. Real self-registered patients pick their own password.
const SEED_PATIENT_PASSWORD = process.env.SEED_PATIENT_PASSWORD || "Patient@123";

function daysFromNow(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

const today = daysFromNow(0);

async function ensureDemoUser() {
    try {
        await createUserWithEmailAndPassword(auth, SEED_EMAIL, SEED_PASSWORD);
        console.log(`Created auth user ${SEED_EMAIL}`);
    } catch (err: any) {
        if (err.code === "auth/email-already-in-use") {
            await signInWithEmailAndPassword(auth, SEED_EMAIL, SEED_PASSWORD);
            console.log(`Auth user ${SEED_EMAIL} already exists — signed in.`);
        } else {
            throw err;
        }
    }
}

/**
 * Creates (or signs into) a Firebase Auth account per seeded patient and
 * links it via patientLinks/{uid} so the mobile app can resolve "which
 * patient record does this login own" — see firestore.rules. Must run LAST:
 * creating each account signs the script in AS that patient, which is fine
 * for writing its own patientLinks doc (self-linking is patient-writable by
 * rule) but would break any subsequent staff-only write.
 */
async function seedPatientAccounts(patients: Record<string, { email: string }>) {
    for (const [patientId, data] of Object.entries(patients)) {
        let uid: string;
        try {
            const cred = await createUserWithEmailAndPassword(auth, data.email, SEED_PATIENT_PASSWORD);
            uid = cred.user.uid;
        } catch (err: any) {
            if (err.code === "auth/email-already-in-use") {
                const cred = await signInWithEmailAndPassword(auth, data.email, SEED_PATIENT_PASSWORD);
                uid = cred.user.uid;
            } else {
                throw err;
            }
        }

        const linkRef = doc(db, "patientLinks", uid);
        if (!(await getDoc(linkRef)).exists()) {
            await setDoc(linkRef, { patientId });
        }
    }
    console.log(`Linked ${Object.keys(patients).length} patient logins (password: ${SEED_PATIENT_PASSWORD})`);
}

async function seedCollection(name: string, docs: Record<string, any>) {
    for (const [id, data] of Object.entries(docs)) {
        await setDoc(doc(db, name, id), { ...data, createdAt: Timestamp.now().toMillis() });
    }
    console.log(`Seeded ${Object.keys(docs).length} ${name}`);
}

async function main() {
    await ensureDemoUser();

    // ---------------------------------------------------------------- doctors
    await seedCollection("doctors", {
        "doc-kavya": {
            name: "Dr. Kavya Rao", specialty: "Orthodontics", phone: "+91 98450 11223",
            email: "kavya.rao@dentigo.dev", photoColor: "#087f78",
            weeklyAvailability: [
                { day: "Mon", startTime: "09:00", endTime: "17:00", slotDurationMins: 30 },
                { day: "Wed", startTime: "09:00", endTime: "17:00", slotDurationMins: 30 },
                { day: "Fri", startTime: "09:00", endTime: "13:00", slotDurationMins: 30 }
            ],
            blockedDates: []
        },
        "doc-arjun": {
            name: "Dr. Arjun Shah", specialty: "Endodontics (Root Canal)", phone: "+91 98201 55321",
            email: "arjun.shah@dentigo.dev", photoColor: "#0369a1",
            weeklyAvailability: [
                { day: "Tue", startTime: "10:00", endTime: "18:00", slotDurationMins: 45 },
                { day: "Thu", startTime: "10:00", endTime: "18:00", slotDurationMins: 45 }
            ],
            blockedDates: []
        },
        "doc-meera": {
            name: "Dr. Meera Iyer", specialty: "Pediatric Dentistry", phone: "+91 99876 44210",
            email: "meera.iyer@dentigo.dev", photoColor: "#c026d3",
            weeklyAvailability: [
                { day: "Mon", startTime: "10:00", endTime: "16:00", slotDurationMins: 30 },
                { day: "Wed", startTime: "10:00", endTime: "16:00", slotDurationMins: 30 },
                { day: "Fri", startTime: "10:00", endTime: "16:00", slotDurationMins: 30 }
            ],
            blockedDates: []
        },
        "doc-rohit": {
            name: "Dr. Rohit Verma", specialty: "Oral & Maxillofacial Surgery", phone: "+91 97654 88012",
            email: "rohit.verma@dentigo.dev", photoColor: "#b45309",
            weeklyAvailability: [
                { day: "Tue", startTime: "09:00", endTime: "14:00", slotDurationMins: 60 },
                { day: "Sat", startTime: "09:00", endTime: "13:00", slotDurationMins: 60 }
            ],
            blockedDates: []
        }
    });

    // --------------------------------------------------------------- patients
    const patients = {
        "pat-ananya": { name: "Ananya Sharma", email: "ananya.sharma@email.com", phone: "+91 98765 43210", age: 32, gender: "Female", address: "B-402, Green Glen Layout, Bangalore" },
        "pat-rohan": { name: "Rohan Mehta", email: "rohan.mehta@email.com", phone: "+91 98201 76432", age: 45, gender: "Male", address: "12/A Park Street, Mumbai" },
        "pat-priya": { name: "Priya Nair", email: "priya.nair@email.com", phone: "+91 99876 14208", age: 28, gender: "Female", address: "45 MG Road, Kochi" },
        "pat-arjunk": { name: "Arjun Kapoor", email: "arjun.kapoor@email.com", phone: "+91 97654 33001", age: 38, gender: "Male", address: "88 Vasant Kunj, New Delhi" },
        "pat-sneha": { name: "Sneha Iyer", email: "sneha.iyer@email.com", phone: "+91 98981 22334", age: 26, gender: "Female", address: "104 Anna Salai, Chennai" },
        "pat-vikram": { name: "Vikram Singh", email: "vikram.singh@email.com", phone: "+91 90210 44556", age: 51, gender: "Male", address: "22 Civil Lines, Jaipur" },
        "pat-neha": { name: "Neha Gupta", email: "neha.gupta@email.com", phone: "+91 91234 87654", age: 34, gender: "Female", address: "7 Salt Lake, Kolkata" },
        "pat-karan": { name: "Karan Malhotra", email: "karan.malhotra@email.com", phone: "+91 96543 21098", age: 29, gender: "Male", address: "15 Koramangala, Bangalore" }
    };
    await seedCollection("patients", patients);

    // ----------------------------------------------------------- appointments
    await seedCollection("appointments", {
        "appt-1": { patientId: "pat-ananya", doctorId: "doc-kavya", date: today, time: "09:30 AM", treatment: "Routine Checkup", status: "Confirmed" },
        "appt-2": { patientId: "pat-rohan", doctorId: "doc-kavya", date: today, time: "10:15 AM", treatment: "Teeth Cleaning", status: "Pending" },
        "appt-3": { patientId: "pat-priya", doctorId: "doc-arjun", date: today, time: "11:30 AM", treatment: "Root Canal Follow-up", status: "Confirmed" },
        "appt-4": { patientId: "pat-arjunk", doctorId: "doc-arjun", date: today, time: "02:00 PM", treatment: "Dental Crown Fitting", status: "Completed" },
        "appt-5": { patientId: "pat-sneha", doctorId: "doc-meera", date: daysFromNow(-1), time: "11:00 AM", treatment: "Pediatric Checkup", status: "Completed" },
        "appt-6": { patientId: "pat-vikram", doctorId: "doc-rohit", date: daysFromNow(-2), time: "09:00 AM", treatment: "Wisdom Tooth Consultation", status: "No-show" },
        "appt-7": { patientId: "pat-neha", doctorId: "doc-kavya", date: daysFromNow(3), time: "01:00 PM", treatment: "Braces Adjustment", status: "Pending" },
        "appt-8": { patientId: "pat-karan", doctorId: "doc-arjun", date: daysFromNow(-5), time: "03:30 PM", treatment: "Root Canal", status: "Cancelled" },
        "appt-9": { patientId: "pat-priya", doctorId: "doc-meera", date: daysFromNow(5), time: "10:30 AM", treatment: "Consultation", status: "Confirmed" }
    });

    // ---------------------------------------------------------- medicine catalog
    await seedCollection("medicines", {
        "med-amoxicillin": { name: "Amoxicillin 500mg", genericName: "Amoxicillin", category: "Antibiotic", unit: "capsule", reorderLevel: 40, barcode: "8901030876541" },
        "med-ibuprofen": { name: "Ibuprofen 400mg", genericName: "Ibuprofen", category: "Analgesic", unit: "tablet", reorderLevel: 50, barcode: "8901030876558" },
        "med-chlorhexidine": { name: "Chlorhexidine Mouthwash", genericName: "Chlorhexidine Gluconate", category: "Antiseptic", unit: "bottle", reorderLevel: 10, barcode: "8901030876565" },
        "med-metronidazole": { name: "Metronidazole 400mg", genericName: "Metronidazole", category: "Antibiotic", unit: "tablet", reorderLevel: 30, barcode: "8901030876572" },
        "med-paracetamol": { name: "Paracetamol 650mg", genericName: "Paracetamol", category: "Analgesic", unit: "tablet", reorderLevel: 60, barcode: "8901030876589" },
        "med-ketorolac": { name: "Ketorolac 10mg", genericName: "Ketorolac Tromethamine", category: "Anti-inflammatory", unit: "tablet", reorderLevel: 20, barcode: "8901030876596" },
        "med-gloves": { name: "Nitrile Gloves (M)", category: "Consumable", unit: "box", reorderLevel: 15, barcode: "8901030876602" },
        "med-composite": { name: "Composite Resin A2", category: "Material", unit: "syringe", reorderLevel: 5, barcode: "8901030876619" },
        "med-lidocaine": { name: "Lidocaine 2% Injection", genericName: "Lidocaine HCl", category: "Analgesic", unit: "vial", reorderLevel: 15, barcode: "8901030876626" },
        "med-clindamycin": { name: "Clindamycin 300mg", genericName: "Clindamycin", category: "Antibiotic", unit: "capsule", reorderLevel: 25, barcode: "8901030876633" },
        "med-diclofenac": { name: "Diclofenac Gel", genericName: "Diclofenac Diethylamine", category: "Anti-inflammatory", unit: "tube", reorderLevel: 10, barcode: "8901030876640" },
        "med-povidone": { name: "Povidone Iodine Solution", genericName: "Povidone-Iodine", category: "Antiseptic", unit: "bottle", reorderLevel: 8, barcode: "8901030876657" }
    });

    // -------------------------------------------------------------- suppliers
    await seedCollection("suppliers", {
        "sup-careplus": { name: "CarePlus Pharma", contactPerson: "Sunil Rathi", phone: "+91 98200 12345", email: "orders@careplus.example", address: "Plot 14, Andheri MIDC, Mumbai", gstin: "27AACCC1234F1Z5" },
        "sup-medisupply": { name: "MediSupply India", contactPerson: "Anjali Deshpande", phone: "+91 99001 65432", email: "sales@medisupply.example", address: "6th Cross, Peenya Industrial Area, Bangalore", gstin: "29AAECM5678G1Z2" },
        "sup-dentalpro": { name: "DentalPro Supplies", contactPerson: "Farhan Sheikh", phone: "+91 90040 87654", email: "support@dentalpro.example", address: "22 Industrial Estate, Ahmedabad", gstin: "24AADCD9012H1Z8" }
    });

    // --------------------------------------------------------- purchase orders
    await seedCollection("purchaseOrders", {
        "po-1001": {
            poNumber: "PO-1001", supplierId: "sup-careplus", status: "Received",
            lines: [
                { medicineId: "med-amoxicillin", name: "Amoxicillin 500mg", qty: 200, unitCost: 4.2 },
                { medicineId: "med-chlorhexidine", name: "Chlorhexidine Mouthwash", qty: 30, unitCost: 95 }
            ],
            orderedDate: daysFromNow(-40), receivedDate: daysFromNow(-35)
        },
        "po-1002": {
            poNumber: "PO-1002", supplierId: "sup-medisupply", status: "Received",
            lines: [
                { medicineId: "med-ibuprofen", name: "Ibuprofen 400mg", qty: 300, unitCost: 1.8 },
                { medicineId: "med-metronidazole", name: "Metronidazole 400mg", qty: 150, unitCost: 2.5 },
                { medicineId: "med-gloves", name: "Nitrile Gloves (M)", qty: 60, unitCost: 320 }
            ],
            orderedDate: daysFromNow(-20), receivedDate: daysFromNow(-15)
        },
        "po-1003": {
            poNumber: "PO-1003", supplierId: "sup-dentalpro", status: "Received",
            lines: [{ medicineId: "med-composite", name: "Composite Resin A2", qty: 10, unitCost: 950 }],
            orderedDate: daysFromNow(-10), receivedDate: daysFromNow(-6)
        },
        "po-1004": {
            poNumber: "PO-1004", supplierId: "sup-careplus", status: "Ordered",
            lines: [{ medicineId: "med-metronidazole", name: "Metronidazole 400mg", qty: 200, unitCost: 2.5 }],
            orderedDate: daysFromNow(-2)
        },
        "po-1005": {
            poNumber: "PO-1005", supplierId: "sup-medisupply", status: "Draft",
            lines: [{ medicineId: "med-lidocaine", name: "Lidocaine 2% Injection", qty: 40, unitCost: 38 }],
            orderedDate: today
        }
    });

    // ------------------------------------------------------------------ batches
    // Deliberate spread: healthy stock, one near-expiry, one low-stock, one out-of-stock.
    await seedCollection("batches", {
        "batch-amox-1": { medicineId: "med-amoxicillin", batchNo: "AMX-24A", expiryDate: daysFromNow(280), quantityReceived: 200, quantityRemaining: 148, unitCost: 4.2, mrp: 8, supplierId: "sup-careplus", poId: "po-1001", receivedDate: daysFromNow(-35) },
        "batch-chlor-1": { medicineId: "med-chlorhexidine", batchNo: "CHX-24B", expiryDate: daysFromNow(12), quantityReceived: 30, quantityRemaining: 22, unitCost: 95, mrp: 160, supplierId: "sup-careplus", poId: "po-1001", receivedDate: daysFromNow(-35) },
        "batch-ibu-1": { medicineId: "med-ibuprofen", batchNo: "IBU-24C", expiryDate: daysFromNow(300), quantityReceived: 300, quantityRemaining: 260, unitCost: 1.8, mrp: 4, supplierId: "sup-medisupply", poId: "po-1002", receivedDate: daysFromNow(-15) },
        "batch-metro-1": { medicineId: "med-metronidazole", batchNo: "MTZ-24D", expiryDate: daysFromNow(20), quantityReceived: 150, quantityRemaining: 18, unitCost: 2.5, mrp: 5, supplierId: "sup-medisupply", poId: "po-1002", receivedDate: daysFromNow(-15) },
        "batch-gloves-1": { medicineId: "med-gloves", batchNo: "GLV-24E", expiryDate: daysFromNow(500), quantityReceived: 60, quantityRemaining: 44, unitCost: 320, mrp: 420, supplierId: "sup-medisupply", poId: "po-1002", receivedDate: daysFromNow(-15) },
        "batch-composite-1": { medicineId: "med-composite", batchNo: "CMP-24F", expiryDate: daysFromNow(400), quantityReceived: 10, quantityRemaining: 4, unitCost: 950, mrp: 1400, supplierId: "sup-dentalpro", poId: "po-1003", receivedDate: daysFromNow(-6) },
        "batch-paracetamol-1": { medicineId: "med-paracetamol", batchNo: "PCM-24G", expiryDate: daysFromNow(150), quantityReceived: 200, quantityRemaining: 175, unitCost: 1.2, mrp: 3, supplierId: "sup-careplus", receivedDate: daysFromNow(-50) },
        "batch-ketorolac-1": { medicineId: "med-ketorolac", batchNo: "KTR-24H", expiryDate: daysFromNow(25), quantityReceived: 60, quantityRemaining: 21, unitCost: 6, mrp: 12, supplierId: "sup-medisupply", receivedDate: daysFromNow(-45) },
        "batch-lidocaine-1": { medicineId: "med-lidocaine", batchNo: "LID-24I", expiryDate: daysFromNow(180), quantityReceived: 40, quantityRemaining: 0, unitCost: 38, mrp: 60, supplierId: "sup-medisupply", receivedDate: daysFromNow(-60) },
        "batch-clindamycin-1": { medicineId: "med-clindamycin", batchNo: "CLN-24J", expiryDate: daysFromNow(220), quantityReceived: 80, quantityRemaining: 66, unitCost: 5.5, mrp: 11, supplierId: "sup-careplus", receivedDate: daysFromNow(-30) },
        "batch-diclofenac-1": { medicineId: "med-diclofenac", batchNo: "DCF-24K", expiryDate: daysFromNow(8), quantityReceived: 25, quantityRemaining: 9, unitCost: 45, mrp: 85, supplierId: "sup-dentalpro", receivedDate: daysFromNow(-70) },
        "batch-povidone-1": { medicineId: "med-povidone", batchNo: "PVD-24L", expiryDate: daysFromNow(240), quantityReceived: 20, quantityRemaining: 13, unitCost: 60, mrp: 110, supplierId: "sup-careplus", receivedDate: daysFromNow(-25) }
    });

    // ------------------------------------------------------------ stock transactions
    await seedCollection("stockTransactions", {
        "st-1": { medicineId: "med-amoxicillin", batchId: "batch-amox-1", type: "Receipt", qty: 200, refId: "po-1001", date: daysFromNow(-35) },
        "st-2": { medicineId: "med-chlorhexidine", batchId: "batch-chlor-1", type: "Receipt", qty: 30, refId: "po-1001", date: daysFromNow(-35) },
        "st-3": { medicineId: "med-ibuprofen", batchId: "batch-ibu-1", type: "Receipt", qty: 300, refId: "po-1002", date: daysFromNow(-15) },
        "st-4": { medicineId: "med-metronidazole", batchId: "batch-metro-1", type: "Receipt", qty: 150, refId: "po-1002", date: daysFromNow(-15) },
        "st-5": { medicineId: "med-gloves", batchId: "batch-gloves-1", type: "Receipt", qty: 60, refId: "po-1002", date: daysFromNow(-15) },
        "st-6": { medicineId: "med-composite", batchId: "batch-composite-1", type: "Receipt", qty: 10, refId: "po-1003", date: daysFromNow(-6) },
        "st-7": { medicineId: "med-amoxicillin", batchId: "batch-amox-1", type: "Dispense", qty: -52, refId: "rx-1", date: daysFromNow(-3) },
        "st-8": { medicineId: "med-metronidazole", batchId: "batch-metro-1", type: "Dispense", qty: -132, refId: "rx-2", date: daysFromNow(-4) },
        "st-9": { medicineId: "med-lidocaine", batchId: "batch-lidocaine-1", type: "Dispense", qty: -40, refId: "rx-3", date: daysFromNow(-10) }
    });

    // ------------------------------------------------------------------ prescriptions
    await seedCollection("prescriptions", {
        "rx-1": {
            patientId: "pat-ananya", doctorId: "doc-kavya", diagnosis: "Gingivitis",
            medicines: [
                { medicineId: "med-amoxicillin", name: "Amoxicillin 500mg", dosage: "1 capsule", frequency: "Twice daily", durationDays: 7, quantity: 14 },
                { medicineId: "med-chlorhexidine", name: "Chlorhexidine Mouthwash", dosage: "10ml rinse", frequency: "Morning & night", durationDays: 7, quantity: 1 }
            ],
            notes: "Rinse for 60 seconds after brushing.", date: daysFromNow(-3), dispensed: true
        },
        "rx-2": {
            patientId: "pat-rohan", doctorId: "doc-kavya", diagnosis: "Acute toothache & inflammation",
            medicines: [{ medicineId: "med-metronidazole", name: "Metronidazole 400mg", dosage: "1 tablet", frequency: "Twice daily", durationDays: 5, quantity: 10 }],
            notes: "Avoid cold fluids.", date: daysFromNow(-4), dispensed: true
        },
        "rx-3": {
            patientId: "pat-vikram", doctorId: "doc-rohit", diagnosis: "Post-extraction pain management",
            medicines: [{ medicineId: "med-lidocaine", name: "Lidocaine 2% Injection", dosage: "1 vial", frequency: "As directed", durationDays: 1, quantity: 1 }],
            date: daysFromNow(-10), dispensed: true
        },
        "rx-4": {
            patientId: "pat-priya", doctorId: "doc-arjun", diagnosis: "Post root canal maintenance",
            medicines: [{ medicineId: "med-ketorolac", name: "Ketorolac 10mg", dosage: "1 tablet", frequency: "As needed for pain", durationDays: 3, quantity: 6 }],
            notes: "Follow-up in 10 days.", date: today, dispensed: false
        }
    });

    // -------------------------------------------------------------- pharmacy invoices
    await seedCollection("pharmacyInvoices", {
        "pinv-1": {
            invoiceNo: "PH-202608-0001", patientId: "pat-ananya", prescriptionId: "rx-1",
            lines: [
                { medicineId: "med-amoxicillin", name: "Amoxicillin 500mg", batchId: "batch-amox-1", batchNo: "AMX-24A", qty: 14, unitPrice: 8, total: 112 },
                { medicineId: "med-chlorhexidine", name: "Chlorhexidine Mouthwash", batchId: "batch-chlor-1", batchNo: "CHX-24B", qty: 1, unitPrice: 160, total: 160 }
            ],
            totalAmount: 272, date: daysFromNow(-3)
        },
        "pinv-2": {
            invoiceNo: "PH-202608-0002", patientId: "pat-rohan", prescriptionId: "rx-2",
            lines: [{ medicineId: "med-metronidazole", name: "Metronidazole 400mg", batchId: "batch-metro-1", batchNo: "MTZ-24D", qty: 10, unitPrice: 5, total: 50 }],
            totalAmount: 50, date: daysFromNow(-4)
        }
    });

    // ----------------------------------------------------------- consultation invoices
    await seedCollection("consultationInvoices", {
        "cinv-1": { invoiceNo: "CN-202608-0128", patientId: "pat-ananya", appointmentId: "appt-1", items: "Routine Checkup + Teeth Scaling", amount: 4500, status: "Paid", dueDate: daysFromNow(6), date: daysFromNow(-1) },
        "cinv-2": { invoiceNo: "CN-202608-0127", patientId: "pat-priya", appointmentId: "appt-3", items: "Root Canal Follow-up", amount: 12800, status: "Pending", dueDate: daysFromNow(9), date: today },
        "cinv-3": { invoiceNo: "CN-202608-0126", patientId: "pat-sneha", appointmentId: "appt-5", items: "Pediatric Checkup", amount: 1500, status: "Overdue", dueDate: daysFromNow(-5), date: daysFromNow(-12) },
        "cinv-4": { invoiceNo: "CN-202608-0125", patientId: "pat-arjunk", appointmentId: "appt-4", items: "Dental Crown Fitting", amount: 9800, status: "Paid", dueDate: daysFromNow(-2), date: daysFromNow(-8) }
    });

    // -------------------------------------------------------------------------- payments (ledger)
    await seedCollection("payments", {
        "pay-1": { invoiceId: "cinv-1", invoiceType: "Consultation", invoiceNo: "CN-202608-0128", patientId: "pat-ananya", amount: 4500, method: "Card", date: daysFromNow(-1) },
        "pay-2": { invoiceId: "cinv-4", invoiceType: "Consultation", invoiceNo: "CN-202608-0125", patientId: "pat-arjunk", amount: 9800, method: "razorpay_sim", date: daysFromNow(-7) },
        "pay-3": { invoiceId: "pinv-1", invoiceType: "Pharmacy", invoiceNo: "PH-202608-0001", patientId: "pat-ananya", amount: 272, method: "Cash", date: daysFromNow(-3) },
        "pay-4": { invoiceId: "pinv-2", invoiceType: "Pharmacy", invoiceNo: "PH-202608-0002", patientId: "pat-rohan", amount: 50, method: "Cash", date: daysFromNow(-4) }
    });

    // ---------------------------------------------------------------------------- sales returns
    await seedCollection("salesReturns", {
        "ret-1": { pharmacyInvoiceId: "pinv-1", pharmacyInvoiceNo: "PH-202608-0001", medicineId: "med-chlorhexidine", name: "Chlorhexidine Mouthwash", batchId: "batch-chlor-1", qty: 1, action: "Restock", reason: "Patient returned unopened bottle", date: daysFromNow(-2) },
        "ret-2": { pharmacyInvoiceId: "pinv-2", pharmacyInvoiceNo: "PH-202608-0002", medicineId: "med-metronidazole", name: "Metronidazole 400mg", batchId: "batch-metro-1", qty: 2, action: "Writeoff", reason: "Blister pack damaged", date: daysFromNow(-3) }
    });

    // Must run after every staff-authenticated write above — see the doc
    // comment on seedPatientAccounts for why.
    await seedPatientAccounts(patients);

    console.log("\nSeed complete.");
    console.log("Staff login:", SEED_EMAIL, "/", SEED_PASSWORD);
    console.log(`Patient logins: any seeded patient email above / ${SEED_PATIENT_PASSWORD} (e.g. ${patients["pat-ananya"].email})`);
    process.exit(0);
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
