import {
    LayoutGrid, Stethoscope, Users, CalendarDays, Pill, Activity,
    Boxes, Layers, ArrowLeftRight,
    CalendarClock, AlertTriangle, Barcode, Receipt,
    History, Undo2, BookOpen, BarChart3, ScrollText,
    ShoppingCart, ClipboardCheck, ClipboardList, PackageCheck, Truck, FileSpreadsheet, HandCoins,
    Store, UserCog, IdCard, CalendarCheck, Banknote
} from "lucide-react";
import type { ComponentType } from "react";

export type NavLeaf = {
    label: string;
    href: string;
    icon: ComponentType<{ size?: number; className?: string }>;
};

export type NavGroup = {
    label: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    items: NavLeaf[];
};

export type NavEntry = NavLeaf | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
    return "items" in entry;
}

export const navConfig: NavEntry[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { label: "Doctors", href: "/doctors", icon: Stethoscope },
    { label: "Patients", href: "/patients", icon: Users },
    {
        label: "Appointments",
        icon: CalendarDays,
        items: [
            { label: "Appointments", href: "/appointments", icon: CalendarDays },
            { label: "Audit Log", href: "/appointments/audit-log", icon: ScrollText }
        ]
    },
    { label: "Prescriptions", href: "/prescriptions", icon: Pill },
    { label: "Diagnosis", href: "/diagnosis", icon: Activity },

    {
        label: "Inventory",
        icon: Boxes,
        items: [
            { label: "Medicines", href: "/inventory/medicines", icon: Pill },
            { label: "Batches", href: "/inventory/batches", icon: Layers },
            { label: "Stock Transactions", href: "/inventory/stock-transactions", icon: ArrowLeftRight },
            { label: "Expiry Report", href: "/inventory/expiry-report", icon: CalendarClock },
            { label: "Low Stock Report", href: "/inventory/low-stock-report", icon: AlertTriangle },
            { label: "Barcode Printing", href: "/inventory/barcode-printing", icon: Barcode },
            { label: "Audit Log", href: "/inventory/audit-log", icon: ScrollText }
        ]
    },
    {
        label: "Procurement",
        icon: ShoppingCart,
        items: [
            { label: "Purchase Requests", href: "/procurement/purchase-requests", icon: ClipboardCheck },
            { label: "Purchase Orders", href: "/procurement/purchase-orders", icon: ClipboardList },
            { label: "Goods Receipts", href: "/procurement/goods-receipts", icon: PackageCheck },
            { label: "Suppliers", href: "/procurement/suppliers", icon: Truck },
            { label: "Supplier Invoices", href: "/procurement/supplier-invoices", icon: FileSpreadsheet },
            { label: "Supplier Payments", href: "/procurement/supplier-payments", icon: HandCoins }
        ]
    },
    { label: "POS", href: "/pos", icon: Store },
    {
        label: "Invoices",
        icon: Receipt,
        items: [
            { label: "Sales History", href: "/invoices/sales-history", icon: History },
            { label: "Returns", href: "/invoices/returns", icon: Undo2 }
        ]
    },
    {
        label: "HR",
        icon: UserCog,
        items: [
            { label: "Employees", href: "/hr/employees", icon: IdCard },
            { label: "Attendance", href: "/hr/attendance", icon: CalendarCheck },
            { label: "Payroll", href: "/hr/payroll", icon: Banknote }
        ]
    },
    { label: "Ledger", href: "/ledger", icon: BookOpen },
    { label: "Reports", href: "/reports", icon: BarChart3 }
];
