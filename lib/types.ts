export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export type AvailabilitySlot = {
    day: DayOfWeek;
    startTime: string; // "09:00"
    endTime: string; // "17:00"
    slotDurationMins: number;
};

export type Doctor = {
    id: string;
    name: string;
    specialty: string;
    phone: string;
    email: string;
    photoColor: string;
    weeklyAvailability: AvailabilitySlot[];
    blockedDates: string[]; // ISO dates fully unavailable
    consultationFee?: number; // default fee POS/Create Invoice pre-fill; staff can still override per visit
    createdAt: number;
};

export type Patient = {
    id: string;
    name: string;
    email: string;
    phone: string;
    age: number;
    gender: "Male" | "Female" | "Other";
    address?: string;
    createdAt: number;
};

export type AppointmentStatus = "Pending" | "Confirmed" | "Completed" | "No-show" | "Cancelled";

export type Appointment = {
    id: string;
    patientId: string;
    doctorId: string;
    date: string; // ISO date "2026-08-10"
    time: string; // "09:30 AM"
    treatment: string;
    status: AppointmentStatus;
    createdAt: number;
};

export type PrescriptionMedicine = {
    medicineId: string;
    name: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    quantity: number;
};

export type Prescription = {
    id: string;
    patientId: string;
    doctorId: string;
    appointmentId: string; // the visit this was written during — lets POS find "the" prescription for a token
    diagnosis: string;
    medicines: PrescriptionMedicine[];
    notes?: string;
    date: string;
    readyForPos: boolean; // staff clicked "Dispense" — stock not yet deducted, but this now shows as a pending line on the token in POS
    dispensed: boolean; // stock actually deducted — only flips true once POS payment for it is confirmed
    createdAt: number;
};

export type MedicineCategory = "Antibiotic" | "Analgesic" | "Antiseptic" | "Anti-inflammatory" | "Consumable" | "Material" | "Other";

export type Medicine = {
    id: string;
    name: string;
    genericName?: string;
    category: MedicineCategory;
    unit: string; // "tablet", "bottle", "box"
    reorderLevel: number;
    barcode: string;
    createdAt: number;
};

export type Supplier = {
    id: string;
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    gstin?: string;
    createdAt: number;
};

// Full procurement lifecycle. Creating/approving/sending a PO must NEVER
// touch inventory — only a confirmed Goods Receipt (see GoodsReceipt below)
// is allowed to increase stock. See lib/procurement.ts for the state machine.
export type PurchaseOrderStatus =
    | "DRAFT"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "SENT"
    | "PARTIALLY_RECEIVED"
    | "FULLY_RECEIVED"
    | "CLOSED"
    | "REJECTED"
    | "CANCELLED";

export type PurchaseOrderLine = {
    medicineId: string;
    name: string;
    qty: number; // ordered quantity
    unitCost: number;
    receivedQty: number; // cumulative quantity received across all GRNs so far
};

export type POHistoryEntry = {
    action: string;
    byEmail: string;
    at: number;
    note?: string;
};

export type PurchaseOrder = {
    id: string;
    poNumber: string;
    supplierId: string;
    status: PurchaseOrderStatus;
    lines: PurchaseOrderLine[];
    requestIds?: string[]; // PurchaseRequest ids this PO was raised from, if any
    orderedDate: string; // date the PO was drafted
    approvedDate?: string;
    sentDate?: string;
    receivedDate?: string; // date it reached FULLY_RECEIVED
    closedDate?: string;
    createdBy: string; // acting user's email
    approvedBy?: string;
    rejectedBy?: string;
    rejectionReason?: string;
    sentBy?: string;
    cancelledBy?: string;
    cancellationReason?: string;
    closedBy?: string;
    history: POHistoryEntry[];
    createdAt: number;
};

export type PurchaseRequestStatus = "OPEN" | "LINKED" | "CANCELLED";

// Raised when inventory drops to/below reorder level (or manually). A
// request carries no supplier — that's decided when it's bundled into a PO.
export type PurchaseRequest = {
    id: string;
    requestNo: string;
    medicineId: string;
    name: string;
    requestedQty: number;
    reason: string;
    currentStockAtRequest: number;
    reorderLevelAtRequest: number;
    status: PurchaseRequestStatus;
    poId?: string;
    poNumber?: string;
    requestedBy: string;
    cancelledBy?: string;
    createdAt: number;
};

export type GrnLine = {
    medicineId: string;
    name: string;
    orderedQty: number;
    receivedQtyBefore: number;
    receivedQtyNow: number;
    batchNo: string;
    expiryDate: string;
    unitCost: number;
    mrp: number;
    batchId: string;
};

// A Goods Receipt Note — the ONLY event that creates/tops-up batches and
// stock transactions in the procurement flow. One PO can have many GRNs
// (partial deliveries).
export type GoodsReceipt = {
    id: string;
    grnNo: string;
    poId: string;
    poNumber: string;
    supplierId: string;
    lines: GrnLine[];
    receivedBy: string;
    notes?: string;
    date: string;
    createdAt: number;
};

export type SupplierInvoiceStatus = "Pending" | "Paid" | "Overdue" | "Cancelled";

export type SupplierInvoice = {
    id: string;
    invoiceNo: string; // internally generated (SINV-...)
    supplierRefNo?: string; // supplier's own bill/invoice number
    poId: string;
    poNumber: string;
    supplierId: string;
    amount: number;
    status: SupplierInvoiceStatus;
    dueDate: string;
    date: string;
    createdAt: number;
};

export type SupplierPaymentMethod = "Bank Transfer" | "Cheque" | "Cash" | "UPI";

export type SupplierPayment = {
    id: string;
    invoiceId: string;
    invoiceNo: string;
    supplierId: string;
    amount: number;
    method: SupplierPaymentMethod;
    date: string;
    createdAt: number;
};

export type Batch = {
    id: string;
    medicineId: string;
    batchNo: string;
    expiryDate: string; // ISO date
    quantityReceived: number;
    quantityRemaining: number;
    unitCost: number;
    mrp: number;
    supplierId: string;
    poId?: string;
    receivedDate: string;
    createdAt: number;
};

export type StockTransactionType = "Receipt" | "Dispense" | "Return" | "Writeoff" | "Adjustment";

export type StockTransaction = {
    id: string;
    medicineId: string;
    batchId: string;
    type: StockTransactionType;
    qty: number; // positive for in, negative for out
    refId?: string;
    date: string;
    createdAt: number;
};

export type PharmacyInvoiceLine = {
    medicineId: string;
    name: string;
    batchId: string;
    batchNo: string;
    qty: number;
    unitPrice: number;
    total: number;
};

export type PharmacyInvoice = {
    id: string;
    invoiceNo: string;
    patientId: string;
    prescriptionId: string;
    appointmentId: string; // denormalized from the prescription — lets POS find a token's pharmacy bill directly
    lines: PharmacyInvoiceLine[];
    totalAmount: number;
    date: string;
    createdAt: number;
};

export type InvoiceStatus = "Pending" | "Paid" | "Overdue" | "Cancelled";

export type ConsultationInvoice = {
    id: string;
    invoiceNo: string;
    patientId: string;
    appointmentId: string;
    items: string;
    amount: number;
    status: InvoiceStatus;
    dueDate: string;
    date: string;
    createdAt: number;
};

export type PaymentMethod = "Cash" | "Card" | "razorpay_sim";
export type PaymentInvoiceType = "Consultation" | "Pharmacy";

export type Payment = {
    id: string;
    invoiceId: string;
    invoiceType: PaymentInvoiceType;
    invoiceNo: string;
    patientId: string;
    amount: number;
    method: PaymentMethod;
    date: string;
    createdAt: number;
};

export type SalesReturnAction = "Restock" | "Writeoff";

export type SalesReturn = {
    id: string;
    pharmacyInvoiceId: string;
    pharmacyInvoiceNo: string;
    medicineId: string;
    name: string;
    batchId: string;
    qty: number;
    action: SalesReturnAction;
    reason: string;
    date: string;
    createdAt: number;
};

export type DiagnosisReportType =
    | "Dental X-Ray (IOPA/OPG)"
    | "CBCT / CT Scan"
    | "Blood Test"
    | "MRI"
    | "Biopsy / Pathology"
    | "ECG"
    | "Endoscopy"
    | "Other";

export type DiagnosisReport = {
    id: string;
    patientId: string;
    doctorId: string;
    appointmentId: string;
    reportType: DiagnosisReportType;
    title: string;
    toothNumber?: string;
    clinicalNotes: string;
    fileUrl: string;
    publicId?: string; // Cloudinary public_id for asset management/deletion
    storageProvider?: "cloudinary" | "local" | "firebase";
    storagePath?: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    reportDate: string; // ISO date YYYY-MM-DD
    fee?: number; // snapshotted from ScanFeeMaster at creation time; billed via POS
    billed: boolean; // flips true once its fee is included in a POS payment — keeps a reopened token from being recharged
    createdAt: number;
};

// ---------------------------------------------------------------------------
// Point of Sale — settles a whole patient visit (token/appointment) in one
// shot: doctor fee + scan/diagnostic fees + any prescribed medicines, paid
// immediately, unlike the clinic's invoice-then-pay-later flow above. It
// writes the same ConsultationInvoice/PharmacyInvoice/Payment records that
// flow feeds — POS is a friendlier front door onto that data, not a separate
// ledger. See lib/pos.ts.

// A curated, admin-editable price list for the handful of scan/lab types the
// front desk actually charges for. Looked up by reportType when a diagnostic
// report is created, so its fee can be snapshotted onto the report (see
// DiagnosisReport.fee below) and pulled into a POS bill automatically.
export type ScanFeeMaster = {
    id: string;
    reportType: DiagnosisReportType;
    fee: number;
    createdAt: number;
};

// ---------------------------------------------------------------------------
// HR — staff directory, daily attendance, and a simple payroll run computed
// from attendance. Scoped for a live demo, not a full payroll engine: one
// flat monthly salary per employee, no tax/deduction slabs. See lib/hr.ts.

export type EmployeeRole = "Manager" | "Cashier" | "Dental Assistant" | "Front Desk" | "Cleaner" | "Other";

export type Employee = {
    id: string;
    name: string;
    role: EmployeeRole;
    phone: string;
    email?: string;
    monthlySalary: number;
    joinDate: string; // ISO date
    active: boolean;
    createdAt: number;
};

export type AttendanceStatus = "Present" | "Half Day" | "Absent" | "Leave";

// One doc per employee per day, id'd as `${employeeId}_${date}` so marking
// attendance twice for the same day overwrites instead of duplicating.
export type AttendanceEntry = {
    id: string;
    employeeId: string;
    date: string; // ISO date
    status: AttendanceStatus;
    markedBy: string;
    createdAt: number;
};

export type PayrollLine = {
    employeeId: string;
    name: string;
    role: EmployeeRole;
    daysPresent: number;
    daysHalf: number;
    daysAbsent: number;
    daysLeave: number;
    payableDays: number; // Present = 1 day, Half Day = 0.5, Absent/Leave = 0
    perDayRate: number; // monthlySalary / 30, flat
    grossPay: number;
};

export type PayrollStatus = "Finalized";

// Generated fresh from attendance each time and only persisted once
// finalized — there is no Draft state stored in Firestore, only in local
// component state while the preview is open (see lib/hr.ts).
export type PayrollRun = {
    id: string;
    period: string; // "2026-08"
    periodLabel: string; // "August 2026"
    lines: PayrollLine[];
    totalPayout: number;
    status: PayrollStatus;
    generatedBy: string;
    createdAt: number;
};

export type PayrollPayment = {
    id: string;
    payrollRunId: string;
    period: string;
    periodLabel: string;
    amount: number;
    method: SupplierPaymentMethod;
    date: string;
    createdAt: number;
};

// ---------------------------------------------------------------------------
// Appointment audit trail — every status change and every clinical/billing
// event tied to one appointment (prescription written/sent to POS/dispensed,
// diagnosis report added/billed, consultation billed, payment collected),
// newest first. See lib/audit.ts. The medicine/inventory equivalent needs no
// dedicated collection — it's a read-only join over stockTransactions,
// purchaseRequests, and purchaseOrders (see the Inventory Audit Log page).

export type AppointmentAuditAction =
    | "StatusChanged"
    | "PrescriptionCreated"
    | "PrescriptionSentToPos"
    | "PrescriptionDispensed"
    | "DiagnosisReportAdded"
    | "DiagnosisReportBilled"
    | "ConsultationBilled"
    | "PaymentCollected";

export type AppointmentAuditEntry = {
    id: string;
    appointmentId: string;
    action: AppointmentAuditAction;
    detail: string; // human-readable, e.g. "Confirmed → Completed" or "₹500 paid via Cash"
    byEmail: string;
    at: number;
};


