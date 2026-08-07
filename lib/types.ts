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
    diagnosis: string;
    medicines: PrescriptionMedicine[];
    notes?: string;
    date: string;
    dispensed: boolean;
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

export type PurchaseOrderStatus = "Draft" | "Ordered" | "Received" | "Cancelled";

export type PurchaseOrderLine = {
    medicineId: string;
    name: string;
    qty: number;
    unitCost: number;
};

export type PurchaseOrder = {
    id: string;
    poNumber: string;
    supplierId: string;
    status: PurchaseOrderStatus;
    lines: PurchaseOrderLine[];
    orderedDate: string;
    receivedDate?: string;
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
