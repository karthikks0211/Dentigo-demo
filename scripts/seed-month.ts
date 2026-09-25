/**
 * Fills the CURRENT calendar month (1st → last day) with a realistic, fully
 * linked dataset on top of the base seed: appointments on every doctor's
 * working day, and for each completed visit the diagnosis reports,
 * prescriptions, consultation + pharmacy invoices, payments, FEFO stock
 * dispenses and audit trail the real app flows would have written. Also a
 * month of procurement (PR → PO → GRN → batches → supplier invoice/payment),
 * daily staff attendance and a few sales returns.
 *
 * Usage: `npm run seed` once (doctors, medicines, suppliers, employees…),
 * then `npm run seed:month`.
 *
 * Safe to re-run — every doc it owns is id-prefixed `m{YYYYMM}-` and is
 * deleted before being rewritten, and all randomness is seeded per doc id,
 * so the same month always produces the same data. Stock consumed this
 * month comes only from this month's own GRN batches, so base-seed stock
 * levels are left untouched.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
    getFirestore, collection, doc, getDoc, getDocs, query, where,
    documentId, writeBatch
} from "firebase/firestore";
import { getAvailableSlots } from "../lib/scheduling";
import type {
    Appointment, AttendanceStatus, Doctor, DiagnosisReportType, Employee, PaymentMethod
} from "../lib/types";

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

// ------------------------------------------------------------------ dates
// Local-time dates throughout (matches lib/scheduling's dayOfWeek).
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const NOW = new Date();
const YEAR = NOW.getFullYear();
const MONTH = NOW.getMonth(); // 0-based
const PERIOD = `${YEAR}${pad(MONTH + 1)}`; // "202609"
const LAST_DAY = new Date(YEAR, MONTH + 1, 0).getDate();
const TODAY_DAY = NOW.getDate();
const TODAY = isoOf(NOW);
const PREFIX = `m${PERIOD}-`;

/** ISO date for day-of-month n (n ≤ 0 rolls back into last month). */
const day = (n: number) => isoOf(new Date(YEAR, MONTH, n));
const addDays = (iso: string, n: number) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return isoOf(d);
};

/** Epoch ms for an ISO date plus a "09:30 AM" slot label (or HH:MM 24h), plus an offset. */
function atMs(iso: string, time = "10:00 AM", offsetMins = 0): number {
    const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)!;
    let h = Number(m[1]);
    if (m[3]) {
        if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
        if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
    }
    const d = new Date(`${iso}T00:00:00`);
    d.setHours(h, Number(m[2]) + offsetMins, 0, 0);
    return Math.min(d.getTime(), NOW.getTime()); // never write a timestamp in the future
}

// ------------------------------------------------------------------ randomness
// Seeded per key so a given doc always gets the same values on re-run.
function rngFor(key: string): () => number {
    let h = 1779033703 ^ key.length;
    for (let i = 0; i < key.length; i++) {
        h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ------------------------------------------------------------------ write buffer
type Write = { col: string; id: string; data: Record<string, any> };
const writes: Write[] = [];
const put = (col: string, id: string, data: Record<string, any>) => writes.push({ col, id, data });

const OWNED_COLLECTIONS = [
    "appointments", "appointmentAuditLog", "prescriptions", "diagnosisReports",
    "consultationInvoices", "pharmacyInvoices", "payments", "salesReturns",
    "purchaseRequests", "purchaseOrders", "goodsReceipts", "batches", "stockTransactions",
    "supplierInvoices", "supplierPayments"
];

async function deletePreviousRun() {
    let count = 0;
    for (const col of OWNED_COLLECTIONS) {
        const snap = await getDocs(query(
            collection(db, col),
            where(documentId(), ">=", PREFIX),
            where(documentId(), "<", PREFIX + "")
        ));
        for (let i = 0; i < snap.docs.length; i += 400) {
            const b = writeBatch(db);
            snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
            await b.commit();
        }
        count += snap.size;
    }
    if (count) console.log(`Removed ${count} docs from a previous ${PERIOD} run`);
}

async function flush() {
    for (let i = 0; i < writes.length; i += 400) {
        const b = writeBatch(db);
        writes.slice(i, i + 400).forEach((w) => b.set(doc(db, w.col, w.id), w.data));
        await b.commit();
    }
    const byCol: Record<string, number> = {};
    writes.forEach((w) => (byCol[w.col] = (byCol[w.col] || 0) + 1));
    Object.entries(byCol).forEach(([col, n]) => console.log(`  ${col.padEnd(22)} ${n}`));
}

// ------------------------------------------------------------------ reference data
const MEDS: Record<string, { name: string; code: string }> = {
    "med-amoxicillin": { name: "Amoxicillin 500mg", code: "AMX" },
    "med-ibuprofen": { name: "Ibuprofen 400mg", code: "IBU" },
    "med-chlorhexidine": { name: "Chlorhexidine Mouthwash", code: "CHX" },
    "med-metronidazole": { name: "Metronidazole 400mg", code: "MTZ" },
    "med-paracetamol": { name: "Paracetamol 650mg", code: "PCM" },
    "med-ketorolac": { name: "Ketorolac 10mg", code: "KTR" },
    "med-gloves": { name: "Nitrile Gloves (M)", code: "GLV" },
    "med-composite": { name: "Composite Resin A2", code: "CMP" },
    "med-lidocaine": { name: "Lidocaine 2% Injection", code: "LID" },
    "med-clindamycin": { name: "Clindamycin 300mg", code: "CLN" },
    "med-diclofenac": { name: "Diclofenac Gel", code: "DCF" },
    "med-povidone": { name: "Povidone Iodine Solution", code: "PVD" }
};

// Extra patients so a month of bookings doesn't cycle through the same 8
// people. Master data, not month-prefixed — upserted on every run.
const EXTRA_PATIENTS: Record<string, { name: string; email: string; phone: string; age: number; gender: string; address: string }> = {
    "pat-aditya": { name: "Aditya Rao", email: "aditya.rao@email.com", phone: "+91 98450 71234", age: 41, gender: "Male", address: "21 Jayanagar 4th Block, Bangalore" },
    "pat-kavitha": { name: "Kavitha Reddy", email: "kavitha.reddy@email.com", phone: "+91 99001 23456", age: 36, gender: "Female", address: "Plot 9, Banjara Hills, Hyderabad" },
    "pat-sameer": { name: "Sameer Khan", email: "sameer.khan@email.com", phone: "+91 98203 44567", age: 47, gender: "Male", address: "5 Bandra West, Mumbai" },
    "pat-divya": { name: "Divya Menon", email: "divya.menon@email.com", phone: "+91 94470 55678", age: 30, gender: "Female", address: "33 Panampilly Nagar, Kochi" },
    "pat-rahul": { name: "Rahul Joshi", email: "rahul.joshi@email.com", phone: "+91 98220 66789", age: 55, gender: "Male", address: "14 Kothrud, Pune" },
    "pat-pooja": { name: "Pooja Agarwal", email: "pooja.agarwal@email.com", phone: "+91 98310 77890", age: 27, gender: "Female", address: "72 Ballygunge, Kolkata" },
    "pat-manish": { name: "Manish Tiwari", email: "manish.tiwari@email.com", phone: "+91 97170 88901", age: 39, gender: "Male", address: "9 Gomti Nagar, Lucknow" },
    "pat-lakshmi": { name: "Lakshmi Pillai", email: "lakshmi.pillai@email.com", phone: "+91 94440 99012", age: 62, gender: "Female", address: "18 Adyar, Chennai" },
    "pat-nikhil": { name: "Nikhil Bansal", email: "nikhil.bansal@email.com", phone: "+91 98110 10123", age: 33, gender: "Male", address: "40 Sector 15, Gurugram" },
    "pat-shreya": { name: "Shreya Das", email: "shreya.das@email.com", phone: "+91 98300 21234", age: 24, gender: "Female", address: "6 New Town, Kolkata" },
    "pat-imran": { name: "Imran Qureshi", email: "imran.qureshi@email.com", phone: "+91 99250 32345", age: 44, gender: "Male", address: "11 Navrangpura, Ahmedabad" },
    "pat-meghna": { name: "Meghna Kulkarni", email: "meghna.kulkarni@email.com", phone: "+91 98230 43456", age: 52, gender: "Female", address: "3 Shivaji Nagar, Pune" },
    // Pediatric patients for Dr. Meera's Pedo clinic.
    "pat-aarav": { name: "Aarav Sharma", email: "aarav.parent@email.com", phone: "+91 98765 54567", age: 7, gender: "Male", address: "B-402, Green Glen Layout, Bangalore" },
    "pat-ishita": { name: "Ishita Nair", email: "ishita.parent@email.com", phone: "+91 99876 65678", age: 9, gender: "Female", address: "45 MG Road, Kochi" },
    "pat-vihaan": { name: "Vihaan Gupta", email: "vihaan.parent@email.com", phone: "+91 91234 76789", age: 5, gender: "Male", address: "7 Salt Lake, Kolkata" },
    "pat-anika": { name: "Anika Singh", email: "anika.parent@email.com", phone: "+91 90210 87890", age: 11, gender: "Female", address: "22 Civil Lines, Jaipur" },
    "pat-reyansh": { name: "Reyansh Iyer", email: "reyansh.parent@email.com", phone: "+91 98981 98901", age: 8, gender: "Male", address: "104 Anna Salai, Chennai" },
    "pat-myra": { name: "Myra Kapoor", email: "myra.parent@email.com", phone: "+91 97654 09012", age: 6, gender: "Female", address: "88 Vasant Kunj, New Delhi" }
};
const ADULT_PATIENTS = [
    "pat-ananya", "pat-rohan", "pat-priya", "pat-arjunk", "pat-sneha", "pat-vikram", "pat-neha", "pat-karan",
    ...Object.keys(EXTRA_PATIENTS).filter((id) => EXTRA_PATIENTS[id].age >= 18)
];
const CHILD_PATIENTS = Object.keys(EXTRA_PATIENTS).filter((id) => EXTRA_PATIENTS[id].age < 18);

type RxLine = { medicineId: string; dosage: string; frequency: string; durationDays: number; quantity: number };
type Treatment = {
    name: string;
    charge: number; // on top of the doctor's consultation fee
    diagnosis: string;
    scan?: { type: DiagnosisReportType; chance: number };
    rx?: { chance: number; lines: RxLine[] };
    notes?: string;
};

const RX = {
    amox: { medicineId: "med-amoxicillin", dosage: "1 capsule", frequency: "Three times daily", durationDays: 5, quantity: 15 },
    ibu: { medicineId: "med-ibuprofen", dosage: "1 tablet", frequency: "Twice daily after food", durationDays: 3, quantity: 6 },
    chx: { medicineId: "med-chlorhexidine", dosage: "10ml rinse", frequency: "Morning & night", durationDays: 7, quantity: 1 },
    metro: { medicineId: "med-metronidazole", dosage: "1 tablet", frequency: "Twice daily", durationDays: 5, quantity: 10 },
    pcm: { medicineId: "med-paracetamol", dosage: "1 tablet", frequency: "As needed for pain", durationDays: 3, quantity: 6 },
    pcmKid: { medicineId: "med-paracetamol", dosage: "½ tablet", frequency: "As needed for pain", durationDays: 2, quantity: 2 },
    keto: { medicineId: "med-ketorolac", dosage: "1 tablet", frequency: "Twice daily", durationDays: 3, quantity: 6 },
    clinda: { medicineId: "med-clindamycin", dosage: "1 capsule", frequency: "Three times daily", durationDays: 5, quantity: 15 },
    diclo: { medicineId: "med-diclofenac", dosage: "Apply thin layer", frequency: "Twice daily", durationDays: 5, quantity: 1 }
} satisfies Record<string, RxLine>;

const TREATMENTS: Record<string, Treatment[]> = {
    "doc-kavya": [
        { name: "Braces Adjustment", charge: 1500, diagnosis: "Fixed orthodontic appliance — routine activation", rx: { chance: 0.3, lines: [RX.diclo] }, notes: "Soft diet for 2 days." },
        { name: "Orthodontic Consultation", charge: 0, diagnosis: "Class II malocclusion with crowding", scan: { type: "Dental X-Ray (IOPA/OPG)", chance: 0.7 } },
        { name: "Clear Aligner Fitting", charge: 3500, diagnosis: "Mild anterior crowding — aligner therapy", rx: { chance: 0.2, lines: [RX.chx] } },
        { name: "Retainer Check", charge: 500, diagnosis: "Post-orthodontic retention review" },
        { name: "Teeth Cleaning", charge: 1200, diagnosis: "Generalised gingivitis", rx: { chance: 0.7, lines: [RX.chx, RX.metro] }, notes: "Rinse for 60 seconds after brushing." },
        { name: "Routine Checkup", charge: 0, diagnosis: "Routine oral examination — no active disease", scan: { type: "Dental X-Ray (IOPA/OPG)", chance: 0.2 } }
    ],
    "doc-arjun": [
        { name: "Root Canal", charge: 6500, diagnosis: "Irreversible pulpitis", scan: { type: "Dental X-Ray (IOPA/OPG)", chance: 0.9 }, rx: { chance: 0.9, lines: [RX.amox, RX.ibu] }, notes: "Avoid chewing on the treated side until crown placement." },
        { name: "Root Canal Follow-up", charge: 1500, diagnosis: "Post root canal review", scan: { type: "Dental X-Ray (IOPA/OPG)", chance: 0.5 }, rx: { chance: 0.4, lines: [RX.keto] } },
        { name: "Dental Crown Fitting", charge: 8000, diagnosis: "Endodontically treated tooth — full coverage crown", scan: { type: "Dental X-Ray (IOPA/OPG)", chance: 0.3 } },
        { name: "Composite Filling", charge: 1800, diagnosis: "Dental caries (dentin)", rx: { chance: 0.3, lines: [RX.ibu] } },
        { name: "Acute Toothache Consultation", charge: 0, diagnosis: "Acute apical periodontitis", scan: { type: "Dental X-Ray (IOPA/OPG)", chance: 0.8 }, rx: { chance: 0.9, lines: [RX.amox, RX.metro, RX.pcm] }, notes: "Avoid cold fluids." }
    ],
    "doc-meera": [
        { name: "Pediatric Checkup", charge: 0, diagnosis: "Routine pediatric dental examination" },
        { name: "Fluoride Treatment", charge: 900, diagnosis: "High caries risk — topical fluoride varnish", notes: "No eating or drinking for 30 minutes." },
        { name: "Pit & Fissure Sealants", charge: 1200, diagnosis: "Deep fissures on permanent molars" },
        { name: "Milk Tooth Extraction", charge: 1000, diagnosis: "Over-retained primary tooth", scan: { type: "Dental X-Ray (IOPA/OPG)", chance: 0.5 }, rx: { chance: 0.8, lines: [RX.pcmKid] } },
        { name: "Pulpotomy", charge: 2500, diagnosis: "Carious exposure of primary molar", scan: { type: "Dental X-Ray (IOPA/OPG)", chance: 0.8 }, rx: { chance: 0.6, lines: [RX.pcmKid] } }
    ],
    "doc-rohit": [
        { name: "Wisdom Tooth Extraction", charge: 5500, diagnosis: "Impacted mandibular third molar", scan: { type: "Dental X-Ray (IOPA/OPG)", chance: 0.8 }, rx: { chance: 1, lines: [RX.amox, RX.keto, RX.chx] }, notes: "Ice pack for 24 hours. Soft diet." },
        { name: "Implant Consultation", charge: 0, diagnosis: "Missing mandibular first molar — implant planning", scan: { type: "CBCT / CT Scan", chance: 0.9 } },
        { name: "Surgical Extraction", charge: 4000, diagnosis: "Grossly decayed, non-restorable tooth", scan: { type: "Blood Test", chance: 0.6 }, rx: { chance: 1, lines: [RX.clinda, RX.keto] }, notes: "No spitting or straws for 24 hours." },
        { name: "Wisdom Tooth Consultation", charge: 0, diagnosis: "Pericoronitis around partially erupted third molar", scan: { type: "Dental X-Ray (IOPA/OPG)", chance: 0.7 }, rx: { chance: 0.6, lines: [RX.metro, RX.pcm] } }
    ]
};

const SCAN_FEES: Partial<Record<DiagnosisReportType, number>> = {
    "Dental X-Ray (IOPA/OPG)": 350,
    "CBCT / CT Scan": 2500,
    "Blood Test": 600,
    "MRI": 4500
};

const SCAN_IMAGES = [
    "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=1200&q=80"
];
const BLOOD_IMAGE = "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1200&q=80";
const TEETH = ["11", "14", "16", "21", "26", "36", "37", "38", "46", "47", "48"];
const KID_TEETH = ["54", "55", "64", "65", "74", "75", "84", "85"];

// ------------------------------------------------------------------ inventory state
type BatchState = {
    id: string; medicineId: string; batchNo: string; expiryDate: string;
    quantityReceived: number; quantityRemaining: number; unitCost: number; mrp: number;
    supplierId: string; poId: string; receivedDate: string; createdAt: number;
};
const batches: Record<string, BatchState> = {};
let stSeq = 0;
function stockTx(medicineId: string, batchId: string, type: string, qty: number, refId: string, date: string, at: number) {
    put("stockTransactions", `${PREFIX}st-${pad(++stSeq).padStart(4, "0")}`, { medicineId, batchId, type, qty, refId, date, createdAt: at });
}

/** FEFO over this month's batches that had arrived by `date` — mirrors lib/pharmacy planDispense. */
function allocate(medicineId: string, qty: number, date: string) {
    const lines: { medicineId: string; name: string; batchId: string; batchNo: string; qty: number; unitPrice: number; total: number }[] = [];
    const candidates = Object.values(batches)
        .filter((b) => b.medicineId === medicineId && b.receivedDate <= date && b.quantityRemaining > 0)
        .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1));
    let remaining = qty;
    for (const b of candidates) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, b.quantityRemaining);
        b.quantityRemaining -= take;
        lines.push({ medicineId, name: MEDS[medicineId].name, batchId: b.id, batchNo: b.batchNo, qty: take, unitPrice: b.mrp, total: take * b.mrp });
        remaining -= take;
    }
    return lines;
}

// ------------------------------------------------------------------ procurement
type PoLine = { medicineId: string; qty: number; unitCost: number; mrp: number; receive?: number; expiryDays: number };
type PoDef = {
    key: string; supplierId: string; status: string; lines: PoLine[];
    ordered: number; approved?: number; sent?: number; received?: number; closed?: number; rejected?: number;
    rejectionReason?: string;
    invoice?: { refNo: string; dueInDays: number; paidOn?: number; method?: string };
};

const PO_DEFS: PoDef[] = [
    {
        key: "po-01", supplierId: "sup-careplus", status: "CLOSED", ordered: -4, approved: -3, sent: -3, received: 1, closed: 2,
        lines: [
            { medicineId: "med-amoxicillin", qty: 300, unitCost: 4.2, mrp: 8, expiryDays: 320 },
            { medicineId: "med-chlorhexidine", qty: 40, unitCost: 95, mrp: 160, expiryDays: 260 },
            { medicineId: "med-paracetamol", qty: 300, unitCost: 1.2, mrp: 3, expiryDays: 400 },
            { medicineId: "med-clindamycin", qty: 150, unitCost: 5.5, mrp: 11, expiryDays: 300 },
            { medicineId: "med-povidone", qty: 20, unitCost: 60, mrp: 110, expiryDays: 360 }
        ],
        invoice: { refNo: "CP-INV-9104", dueInDays: 21, paidOn: 15, method: "Bank Transfer" }
    },
    {
        key: "po-02", supplierId: "sup-medisupply", status: "CLOSED", ordered: 1, approved: 2, sent: 2, received: 5, closed: 8,
        lines: [
            { medicineId: "med-ibuprofen", qty: 300, unitCost: 1.8, mrp: 4, expiryDays: 340 },
            { medicineId: "med-metronidazole", qty: 200, unitCost: 2.5, mrp: 5, expiryDays: 280 },
            { medicineId: "med-ketorolac", qty: 100, unitCost: 6, mrp: 12, expiryDays: 200 },
            { medicineId: "med-lidocaine", qty: 50, unitCost: 38, mrp: 60, expiryDays: 240 },
            { medicineId: "med-gloves", qty: 30, unitCost: 320, mrp: 420, expiryDays: 700 }
        ],
        invoice: { refNo: "MS-9120", dueInDays: 15, paidOn: 20, method: "Cheque" }
    },
    {
        key: "po-03", supplierId: "sup-dentalpro", status: "PARTIALLY_RECEIVED", ordered: 10, approved: 11, sent: 11, received: 15,
        lines: [
            { medicineId: "med-diclofenac", qty: 30, unitCost: 45, mrp: 85, receive: 30, expiryDays: 180 },
            { medicineId: "med-composite", qty: 12, unitCost: 950, mrp: 1400, receive: 6, expiryDays: 420 }
        ]
    },
    {
        key: "po-04", supplierId: "sup-dentalpro", status: "REJECTED", ordered: 12, rejected: 13,
        rejectionReason: "Gloves already restocked on PO-" + PERIOD + "-2002 — not needed this month.",
        lines: [{ medicineId: "med-gloves", qty: 40, unitCost: 335, mrp: 420, expiryDays: 700 }]
    },
    {
        key: "po-05", supplierId: "sup-careplus", status: "FULLY_RECEIVED", ordered: 16, approved: 17, sent: 17, received: 19,
        lines: [
            { medicineId: "med-amoxicillin", qty: 250, unitCost: 4.1, mrp: 8, expiryDays: 360 },
            { medicineId: "med-chlorhexidine", qty: 30, unitCost: 95, mrp: 160, expiryDays: 300 }
        ],
        invoice: { refNo: "CP-INV-9187", dueInDays: 30 }
    },
    {
        key: "po-06", supplierId: "sup-medisupply", status: "SENT", ordered: 22, approved: 23, sent: 23,
        lines: [
            { medicineId: "med-ibuprofen", qty: 300, unitCost: 1.8, mrp: 4, expiryDays: 340 },
            { medicineId: "med-metronidazole", qty: 150, unitCost: 2.5, mrp: 5, expiryDays: 280 }
        ]
    },
    {
        key: "po-07", supplierId: "sup-careplus", status: "PENDING_APPROVAL", ordered: 24,
        lines: [{ medicineId: "med-ketorolac", qty: 120, unitCost: 6, mrp: 12, expiryDays: 200 }]
    },
    {
        key: "po-08", supplierId: "sup-dentalpro", status: "DRAFT", ordered: TODAY_DAY,
        lines: [{ medicineId: "med-povidone", qty: 25, unitCost: 60, mrp: 110, expiryDays: 360 }]
    }
];

function seedProcurement() {
    let grnSeq = 0;
    let sinvSeq = 0;
    PO_DEFS.forEach((p, idx) => {
        // Skip anything whose timeline hasn't happened yet this month.
        const lastEvent = Math.max(...[p.ordered, p.approved, p.sent, p.received, p.closed, p.rejected].filter((n): n is number => n !== undefined));
        if (lastEvent > TODAY_DAY) return;

        const poId = `${PREFIX}${p.key}`;
        const poNumber = `PO-${PERIOD}-${2001 + idx}`;
        const receivedQty = (l: PoLine) => (p.received ? l.receive ?? l.qty : 0);
        const history: { action: string; byEmail: string; at: number; note: string }[] = [];
        const h = (action: string, d: number, hhmm: string, note = "") => history.push({ action, byEmail: SEED_EMAIL, at: atMs(day(d), hhmm), note });

        h("Created as Draft", p.ordered, "10:00");
        if (p.status !== "DRAFT") h("Submitted for Approval", p.ordered, "10:05");
        if (p.approved) h("Approved", p.approved, "11:30");
        if (p.rejected) h("Rejected", p.rejected, "11:30", p.rejectionReason);
        if (p.sent) h("Sent to Supplier", p.sent, "15:00");

        let grnNo: string | undefined;
        if (p.received) {
            const grnId = `${PREFIX}grn-${pad(++grnSeq)}`;
            grnNo = `GRN-${PERIOD}-${3000 + grnSeq}`;
            const fully = p.lines.every((l) => receivedQty(l) === l.qty);
            h(fully ? "Goods Received — fully received" : "Goods Received — partial", p.received, "12:00", grnNo);
            const receivedDate = day(p.received);
            const receivedAt = atMs(receivedDate, "12:00");

            const grnLines = p.lines.map((l, li) => {
                const med = MEDS[l.medicineId];
                const batchId = `${PREFIX}batch-${med.code.toLowerCase()}-${p.key}`;
                const batchNo = `${med.code}-${PERIOD.slice(2)}${String.fromCharCode(65 + idx)}${li + 1}`;
                const expiryDate = addDays(receivedDate, l.expiryDays);
                const qty = receivedQty(l);
                batches[batchId] = {
                    id: batchId, medicineId: l.medicineId, batchNo, expiryDate, quantityReceived: qty, quantityRemaining: qty,
                    unitCost: l.unitCost, mrp: l.mrp, supplierId: p.supplierId, poId, receivedDate, createdAt: receivedAt
                };
                stockTx(l.medicineId, batchId, "Receipt", qty, poId, receivedDate, receivedAt);
                return {
                    medicineId: l.medicineId, name: med.name, orderedQty: l.qty, receivedQtyBefore: 0, receivedQtyNow: qty,
                    batchNo, expiryDate, unitCost: l.unitCost, mrp: l.mrp, batchId
                };
            });
            put("goodsReceipts", grnId, {
                grnNo, poId, poNumber, supplierId: p.supplierId, lines: grnLines, receivedBy: SEED_EMAIL,
                notes: fully ? "" : "Partial delivery — remainder on backorder.", date: receivedDate, createdAt: receivedAt
            });
        }
        if (p.closed) h("Closed", p.closed, "17:00");

        put("purchaseOrders", poId, {
            poNumber, supplierId: p.supplierId, status: p.status,
            lines: p.lines.map((l) => ({ medicineId: l.medicineId, name: MEDS[l.medicineId].name, qty: l.qty, unitCost: l.unitCost, receivedQty: receivedQty(l) })),
            orderedDate: day(p.ordered),
            ...(p.approved && { approvedDate: day(p.approved), approvedBy: SEED_EMAIL }),
            ...(p.sent && { sentDate: day(p.sent), sentBy: SEED_EMAIL }),
            ...(p.received && p.status !== "PARTIALLY_RECEIVED" && { receivedDate: day(p.received) }),
            ...(p.closed && { closedDate: day(p.closed), closedBy: SEED_EMAIL }),
            ...(p.rejected && { rejectedBy: SEED_EMAIL, rejectionReason: p.rejectionReason }),
            createdBy: SEED_EMAIL, history, createdAt: atMs(day(p.ordered), "10:00")
        });

        // Supplier invoice (payable) raised the day after goods arrive.
        if (p.invoice && p.received) {
            const sinvId = `${PREFIX}sinv-${pad(++sinvSeq)}`;
            const invoiceNo = `SINV-${PERIOD}-${4000 + sinvSeq}`;
            const date = day(p.received + 1);
            const dueDate = addDays(date, p.invoice.dueInDays);
            const amount = Math.round(p.lines.reduce((s, l) => s + receivedQty(l) * l.unitCost, 0) * 100) / 100;
            const paid = p.invoice.paidOn !== undefined && p.invoice.paidOn <= TODAY_DAY;
            put("supplierInvoices", sinvId, {
                invoiceNo, supplierRefNo: p.invoice.refNo, poId, poNumber, supplierId: p.supplierId, amount,
                status: paid ? "Paid" : dueDate < TODAY ? "Overdue" : "Pending", dueDate, date, createdAt: atMs(date, "11:00")
            });
            if (paid) {
                const payDate = day(p.invoice.paidOn!);
                put("supplierPayments", `${PREFIX}spay-${pad(sinvSeq)}`, {
                    invoiceId: sinvId, invoiceNo, supplierId: p.supplierId, amount, method: p.invoice.method, date: payDate, createdAt: atMs(payDate, "14:00")
                });
            }
        }
    });

    // Purchase requests — two bundled into POs above, one still open.
    const prs = [
        { key: "pr-01", d: 15, medicineId: "med-amoxicillin", qty: 250, stock: 38, reorder: 40, po: "po-05", poIdx: 4 },
        { key: "pr-02", d: 23, medicineId: "med-ketorolac", qty: 120, stock: 19, reorder: 20, po: "po-07", poIdx: 6 },
        { key: "pr-03", d: 24, medicineId: "med-lidocaine", qty: 40, stock: 14, reorder: 15 }
    ];
    prs.forEach((r, i) => {
        if (r.d > TODAY_DAY) return;
        const linked = r.po && PO_DEFS[r.poIdx!].ordered <= TODAY_DAY;
        put("purchaseRequests", `${PREFIX}${r.key}`, {
            requestNo: `PR-${PERIOD}-${1001 + i}`, medicineId: r.medicineId, name: MEDS[r.medicineId].name,
            requestedQty: r.qty, reason: `Stock (${r.stock}) at or below reorder level (${r.reorder}).`,
            currentStockAtRequest: r.stock, reorderLevelAtRequest: r.reorder,
            status: linked ? "LINKED" : "OPEN",
            ...(linked && { poId: `${PREFIX}${r.po}`, poNumber: `PO-${PERIOD}-${2001 + r.poIdx!}` }),
            requestedBy: SEED_EMAIL, createdAt: atMs(day(r.d), "09:30")
        });
    });
}

// ------------------------------------------------------------------ visits
let cnSeq = 0, phSeq = 0, paySeq = 0;
const paidPharmacyInvoices: { id: string; invoiceNo: string; date: string; lines: ReturnType<typeof allocate> }[] = [];
const stats = { appointments: 0, completed: 0, revenue: 0 };

function audit(apptId: string, n: number, action: string, detail: string, at: number) {
    put("appointmentAuditLog", `${PREFIX}aud-${apptId.slice(PREFIX.length)}-${n}`, { appointmentId: apptId, action, detail, byEmail: SEED_EMAIL, at });
}

function seedVisits(doctors: Doctor[], existing: Appointment[]) {
    // Every (date, doctor, slot) in chronological order, so stock is consumed in order.
    const bookings: { date: string; doctor: Doctor; time: string }[] = [];
    for (let d = 1; d <= LAST_DAY; d++) {
        const date = day(d);
        for (const doctor of doctors) {
            const slots = getAvailableSlots(doctor, date, existing);
            if (!slots.length) continue;
            const r = rngFor(`occ-${date}-${doctor.id}`);
            const fill = 0.35 + r() * 0.3; // 35–65% of the day booked
            slots.forEach((time) => { if (r() < fill) bookings.push({ date, doctor, time }); });
        }
    }
    bookings.sort((a, b) => atMs(a.date, a.time) - atMs(b.date, b.time) || a.doctor.id.localeCompare(b.doctor.id));

    // Keep the latest completed visit today open in POS as a live checkout demo.
    const nowMs = NOW.getTime();
    const todaysDone = bookings.filter((b) => b.date === TODAY && atMs(b.date, b.time, 45) < nowMs);
    const demoKey = todaysDone.length ? `${todaysDone[todaysDone.length - 1].date}-${todaysDone[todaysDone.length - 1].doctor.id}-${todaysDone[todaysDone.length - 1].time}` : "";

    const seenPatientDay = new Set<string>();
    for (const { date, doctor, time } of bookings) {
        const slotKey = `${date}-${doctor.id}-${time}`;
        const r = rngFor(`appt-${slotKey}`);
        const apptId = `${PREFIX}appt-${date.slice(8)}-${doctor.id.replace("doc-", "")}-${time.replace(/[: ]/g, "").toLowerCase()}`;

        const pool = doctor.id === "doc-meera" ? CHILD_PATIENTS : ADULT_PATIENTS;
        let patientId = pick(r, pool);
        for (let tries = 0; seenPatientDay.has(`${date}-${patientId}`) && tries < 10; tries++) patientId = pick(r, pool);
        seenPatientDay.add(`${date}-${patientId}`);

        const treatment = pick(r, TREATMENTS[doctor.id] || TREATMENTS["doc-kavya"]);
        const slotMs = atMs(date, time);
        const bookedAt = atMs(addDays(date, -(1 + Math.floor(r() * 10))), pick(r, ["09:15 AM", "11:40 AM", "03:20 PM", "06:05 PM"]));

        // --- status, relative to today
        const roll = r();
        let status: Appointment["status"];
        const isDemo = slotKey === demoKey;
        if (date < TODAY || (date === TODAY && atMs(date, time, 45) < nowMs)) {
            status = isDemo ? "Completed" : roll < 0.07 ? "No-show" : roll < 0.15 ? "Cancelled" : "Completed";
            if (date === TODAY && status !== "Completed") status = "Completed";
        } else {
            const daysOut = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${TODAY}T00:00:00`).getTime()) / 86400000);
            status = roll < 0.06 ? "Cancelled" : r() < (daysOut <= 3 ? 0.75 : 0.4) ? "Confirmed" : "Pending";
        }

        put("appointments", apptId, { patientId, doctorId: doctor.id, date, time, treatment: treatment.name, status, createdAt: bookedAt });
        stats.appointments++;

        let n = 0;
        const confirmedAt = Math.min(bookedAt + 3 * 3600000, slotMs - 3600000);
        if (status !== "Pending" && !(status === "Cancelled" && roll < 0.1)) audit(apptId, ++n, "StatusChanged", "Pending → Confirmed", confirmedAt);
        if (status === "Cancelled") {
            audit(apptId, ++n, "StatusChanged", `${n > 1 ? "Confirmed" : "Pending"} → Cancelled`, Math.max(confirmedAt + 3600000, slotMs - 20 * 3600000));
            continue;
        }
        if (status === "No-show") {
            audit(apptId, ++n, "StatusChanged", "Confirmed → No-show", atMs(date, time, 60));
            continue;
        }
        if (status !== "Completed") continue;
        stats.completed++;

        // --- decide billing path
        const billRoll = r();
        const openInPos = isDemo;
        const invoicedLater = !openInPos && date < TODAY && billRoll < 0.12; // manual invoice, not yet paid
        const method: PaymentMethod = pick(r, ["Cash", "Cash", "Card", "Card", "razorpay_sim"] as PaymentMethod[]);
        const methodLabel = method === "razorpay_sim" ? "Razorpay" : method;

        // --- diagnosis report
        let scanFee = 0;
        let scanType: DiagnosisReportType | undefined;
        if (treatment.scan && r() < treatment.scan.chance) {
            scanType = treatment.scan.type;
            scanFee = SCAN_FEES[scanType] || 0;
            const isKid = doctor.id === "doc-meera";
            const tooth = scanType === "Blood Test" ? "" : pick(r, isKid ? KID_TEETH : TEETH);
            const patientName = (EXTRA_PATIENTS[patientId]?.name || patientId.replace("pat-", "")).split(" ")[0];
            const meta = scanType === "CBCT / CT Scan"
                ? { title: `Pre-Implant Sectional CBCT Scan - Region ${tooth}`, notes: `Available bone height ${(9 + r() * 4).toFixed(1)}mm, width ${(6 + r() * 2).toFixed(1)}mm. Adequate clearance from the inferior alveolar canal.`, file: `CBCT_${patientName}_${tooth}.jpg`, size: 4200000 }
                : scanType === "Blood Test"
                    ? { title: "Pre-Surgical CBC & Coagulation Profile", notes: `Hb ${(12.5 + r() * 2.5).toFixed(1)} g/dL, Platelets ${Math.round(190 + r() * 120)},000 /mcL, PT/INR ${(0.95 + r() * 0.15).toFixed(2)}. Cleared for surgery.`, file: `CBC_PTINR_${patientName}.pdf`, size: 850000 }
                    : { title: `IOPA X-Ray - Tooth ${tooth}`, notes: `${treatment.diagnosis}. Periapical region of #${tooth} assessed; findings consistent with clinical diagnosis.`, file: `IOPA_${patientName}_Tooth${tooth}.jpg`, size: 1400000 + Math.round(r() * 600000) };
            const reportAt = atMs(date, time, 15);
            put("diagnosisReports", `${PREFIX}diag-${apptId.slice(PREFIX.length + 5)}`, {
                patientId, doctorId: doctor.id, appointmentId: apptId, reportType: scanType, title: meta.title, toothNumber: tooth,
                clinicalNotes: meta.notes, fileUrl: scanType === "Blood Test" ? BLOOD_IMAGE : pick(r, SCAN_IMAGES),
                fileName: meta.file, fileSizeBytes: meta.size, mimeType: meta.file.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
                reportDate: date, fee: scanFee, billed: !openInPos, createdAt: reportAt
            });
            audit(apptId, ++n, "DiagnosisReportAdded", `${meta.title} — ${inr(scanFee)}`, reportAt);
        }

        // --- prescription
        let rx: { id: string; lines: RxLine[] } | undefined;
        if (treatment.rx && r() < treatment.rx.chance) {
            rx = { id: `${PREFIX}rx-${apptId.slice(PREFIX.length + 5)}`, lines: treatment.rx.lines };
            const names = rx.lines.map((l) => MEDS[l.medicineId].name).join(", ");
            audit(apptId, ++n, "PrescriptionCreated", `${names} — for ${treatment.diagnosis}`, atMs(date, time, 25));
            if (!invoicedLater) audit(apptId, ++n, "PrescriptionSentToPos", "Sent to POS for dispensing", atMs(date, time, 26));
        }

        audit(apptId, ++n, "StatusChanged", "Confirmed → Completed", atMs(date, time, 30));

        // --- consultation invoice (+ payment)
        const items = ["Consultation", treatment.charge ? treatment.name : "", scanType || ""].filter(Boolean).join(" + ");
        const consultAmount = (doctor.consultationFee || 0) + treatment.charge + scanFee;
        let pharmacyTotal = 0;
        let dispensed = false;

        if (!openInPos) {
            const cinvId = `${PREFIX}cinv-${String(++cnSeq).padStart(4, "0")}`;
            const invoiceNo = `CN-${PERIOD}-${String(5000 + cnSeq)}`;
            const dueDate = invoicedLater ? addDays(date, 7) : date;
            put("consultationInvoices", cinvId, {
                invoiceNo, patientId, appointmentId: apptId, items, amount: consultAmount,
                status: invoicedLater ? (dueDate < TODAY ? "Overdue" : "Pending") : "Paid",
                dueDate, date, createdAt: atMs(date, time, 35)
            });
            audit(apptId, ++n, "ConsultationBilled", `${items} — ${inr(consultAmount)}`, atMs(date, time, 35));
            if (!invoicedLater) {
                put("payments", `${PREFIX}pay-${String(++paySeq).padStart(4, "0")}`, {
                    invoiceId: cinvId, invoiceType: "Consultation", invoiceNo, patientId, amount: consultAmount, method, date, createdAt: atMs(date, time, 36)
                });
                stats.revenue += consultAmount;
            }

            // --- pharmacy: dispensed only at POS payment, FEFO from this month's batches
            if (rx && !invoicedLater) {
                const lines = rx.lines.flatMap((l) => allocate(l.medicineId, l.quantity, date));
                if (lines.length) {
                    dispensed = true;
                    pharmacyTotal = lines.reduce((s, l) => s + l.total, 0);
                    const pinvId = `${PREFIX}pinv-${String(++phSeq).padStart(4, "0")}`;
                    const phNo = `PH-${PERIOD}-${String(7000 + phSeq)}`;
                    const at = atMs(date, time, 36);
                    lines.forEach((l) => stockTx(l.medicineId, l.batchId, "Dispense", -l.qty, rx!.id, date, at));
                    put("pharmacyInvoices", pinvId, { invoiceNo: phNo, patientId, prescriptionId: rx.id, appointmentId: apptId, lines, totalAmount: pharmacyTotal, date, createdAt: at });
                    put("payments", `${PREFIX}pay-${String(++paySeq).padStart(4, "0")}`, {
                        invoiceId: pinvId, invoiceType: "Pharmacy", invoiceNo: phNo, patientId, amount: pharmacyTotal, method, date, createdAt: at
                    });
                    audit(apptId, ++n, "PrescriptionDispensed", `${[...new Set(lines.map((l) => l.name))].join(", ")} — ${inr(pharmacyTotal)}`, at);
                    paidPharmacyInvoices.push({ id: pinvId, invoiceNo: phNo, date, lines });
                    stats.revenue += pharmacyTotal;
                }
            }
            if (!invoicedLater) audit(apptId, ++n, "PaymentCollected", `${inr(consultAmount + pharmacyTotal)} via ${methodLabel}`, atMs(date, time, 37));
        }

        if (rx) {
            put("prescriptions", rx.id, {
                patientId, doctorId: doctor.id, appointmentId: apptId, diagnosis: treatment.diagnosis,
                medicines: rx.lines.map((l) => ({ medicineId: l.medicineId, name: MEDS[l.medicineId].name, dosage: l.dosage, frequency: l.frequency, durationDays: l.durationDays, quantity: l.quantity })),
                notes: treatment.notes || "", date,
                readyForPos: !invoicedLater, dispensed,
                createdAt: atMs(date, time, 25)
            });
        }
    }
}

// ------------------------------------------------------------------ returns & consumption
function seedReturnsAndConsumption() {
    const reasons: [string, "Restock" | "Writeoff"][] = [
        ["Patient returned unopened bottle", "Restock"],
        ["Prescription changed by doctor — unopened strip", "Restock"],
        ["Blister pack damaged", "Writeoff"],
        ["Patient reported seal broken on purchase", "Writeoff"]
    ];
    const r = rngFor(`returns-${PERIOD}`);
    const candidates = paidPharmacyInvoices.filter((p) => addDays(p.date, 2) <= TODAY);
    const chosen = new Set<number>();
    while (chosen.size < Math.min(reasons.length, candidates.length)) chosen.add(Math.floor(r() * candidates.length));
    [...chosen].sort((a, b) => a - b).forEach((ci, i) => {
        const inv = candidates[ci];
        const line = inv.lines[0];
        const [reason, action] = reasons[i];
        const qty = Math.max(1, Math.min(line.qty, Math.ceil(line.qty / 3)));
        const date = addDays(inv.date, 1 + (i % 2));
        const at = atMs(date, "12:30");
        const retId = `${PREFIX}ret-${pad(i + 1)}`;
        put("salesReturns", retId, {
            pharmacyInvoiceId: inv.id, pharmacyInvoiceNo: inv.invoiceNo, medicineId: line.medicineId, name: line.name,
            batchId: line.batchId, qty, action, reason, date, createdAt: at
        });
        if (action === "Restock") batches[line.batchId].quantityRemaining += qty;
        stockTx(line.medicineId, line.batchId, action === "Restock" ? "Return" : "Writeoff", action === "Restock" ? qty : 0, inv.id, date, at);
    });

    // Chairside consumables used up each Saturday — gloves and local anaesthetic.
    for (let d = 1; d <= TODAY_DAY; d++) {
        const date = day(d);
        if (new Date(`${date}T00:00:00`).getDay() !== 6) continue;
        for (const [medicineId, qty] of [["med-gloves", 6], ["med-lidocaine", 9]] as const) {
            const lines = allocate(medicineId, qty, date);
            lines.forEach((l) => stockTx(medicineId, l.batchId, "Adjustment", -l.qty, "weekly-consumption", date, atMs(date, "18:00")));
        }
    }

    Object.values(batches).forEach(({ id, ...b }) => put("batches", id, b));
}

// ------------------------------------------------------------------ HR
function seedAttendance(employees: Employee[]) {
    let count = 0;
    for (let d = 1; d <= TODAY_DAY; d++) {
        const date = day(d);
        if (new Date(`${date}T00:00:00`).getDay() === 0) continue; // clinic closed Sundays
        for (const emp of employees) {
            if (!emp.active || emp.joinDate > date) continue;
            const x = rngFor(`att-${emp.id}-${date}`)();
            const status: AttendanceStatus = x < 0.86 ? "Present" : x < 0.92 ? "Half Day" : x < 0.96 ? "Leave" : "Absent";
            put("attendance", `${emp.id}_${date}`, { employeeId: emp.id, date, status, markedBy: SEED_EMAIL, createdAt: atMs(date, "09:10") });
            count++;
        }
    }
    return count;
}

// ------------------------------------------------------------------ main
async function main() {
    await signInWithEmailAndPassword(auth, SEED_EMAIL, SEED_PASSWORD);

    if (!(await getDoc(doc(db, "doctors", "doc-kavya"))).exists()) {
        console.error("Base data not found — run `npm run seed` first, then `npm run seed:month`.");
        process.exit(1);
    }

    const monthLabel = new Date(YEAR, MONTH, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    console.log(`Seeding ${monthLabel} (${day(1)} → ${day(LAST_DAY)}, today ${TODAY})`);

    await deletePreviousRun();

    const doctors = (await getDocs(collection(db, "doctors"))).docs.map((d) => ({ id: d.id, ...d.data() } as Doctor));
    const employees = (await getDocs(collection(db, "employees"))).docs.map((d) => ({ id: d.id, ...d.data() } as Employee));
    // Base-seed (non-month) appointments this month occupy their slots.
    const existing = (await getDocs(collection(db, "appointments"))).docs
        .map((d) => ({ id: d.id, ...d.data() } as Appointment))
        .filter((a) => !a.id.startsWith(PREFIX) && a.date.startsWith(`${YEAR}-${pad(MONTH + 1)}`));

    Object.entries(EXTRA_PATIENTS).forEach(([id, p], i) => put("patients", id, { ...p, createdAt: atMs(day(1 - 60 + i * 3), "10:00") }));

    seedProcurement();
    seedVisits(doctors.sort((a, b) => a.id.localeCompare(b.id)), existing);
    seedReturnsAndConsumption();
    const attendance = seedAttendance(employees);

    console.log(`Writing ${writes.length} docs…`);
    await flush();

    console.log(`\n${monthLabel} seeded: ${stats.appointments} appointments (${stats.completed} completed), ${attendance} attendance marks, ${inr(stats.revenue)} collected.`);
    process.exit(0);
}

main().catch((err) => {
    console.error("Month seed failed:", err);
    process.exit(1);
});
