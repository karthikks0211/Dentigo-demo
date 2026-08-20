import {
    LayoutGrid, Stethoscope, Users, CalendarDays, Pill, Activity,
    Boxes, Layers, ArrowLeftRight, ClipboardList, Truck,
    CalendarClock, AlertTriangle, Barcode, Receipt, FilePlus2,
    History, Undo2, Wallet, BookOpen, BarChart3
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
    { label: "Appointments", href: "/appointments", icon: CalendarDays },
    { label: "Prescriptions", href: "/prescriptions", icon: Pill },
    { label: "Diagnosis", href: "/diagnosis", icon: Activity },

    {
        label: "Inventory",
        icon: Boxes,
        items: [
            { label: "Medicines", href: "/inventory/medicines", icon: Pill },
            { label: "Batches", href: "/inventory/batches", icon: Layers },
            { label: "Stock Transactions", href: "/inventory/stock-transactions", icon: ArrowLeftRight },
            { label: "Purchase Orders", href: "/inventory/purchase-orders", icon: ClipboardList },
            { label: "Suppliers", href: "/inventory/suppliers", icon: Truck },
            { label: "Expiry Report", href: "/inventory/expiry-report", icon: CalendarClock },
            { label: "Low Stock Report", href: "/inventory/low-stock-report", icon: AlertTriangle },
            { label: "Barcode Printing", href: "/inventory/barcode-printing", icon: Barcode }
        ]
    },
    {
        label: "Invoices",
        icon: Receipt,
        items: [
            { label: "Create Invoice", href: "/invoices/create", icon: FilePlus2 },
            { label: "Sales History", href: "/invoices/sales-history", icon: History },
            { label: "Returns", href: "/invoices/returns", icon: Undo2 },
            { label: "Payments", href: "/invoices/payments", icon: Wallet }
        ]
    },
    { label: "Ledger", href: "/ledger", icon: BookOpen },
    { label: "Reports", href: "/reports", icon: BarChart3 }
];
