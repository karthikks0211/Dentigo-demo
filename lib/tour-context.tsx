"use client";

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import {
    Sparkles, LayoutGrid, Stethoscope, Users, CalendarDays,
    Pill, Boxes, Receipt, BookOpen, BarChart3, PartyPopper
} from "lucide-react";
import type { ComponentType } from "react";

export type TourStep = {
    title: string;
    description: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    href?: string;
    linkLabel?: string;
};

export const tourSteps: TourStep[] = [
    {
        title: "Welcome to DentiGO",
        description: "This quick walkthrough covers everything you need to run your clinic — from booking appointments to tracking pharmacy stock and revenue. It takes about a minute.",
        icon: Sparkles
    },
    {
        title: "Dashboard",
        description: "Your home base. See today's appointments, pending confirmations, revenue collected, and total patients at a glance every time you log in.",
        icon: LayoutGrid,
        href: "/dashboard",
        linkLabel: "Go to Dashboard"
    },
    {
        title: "Doctors",
        description: "Add doctor profiles and set their weekly availability. This is the first step before you can book any appointment.",
        icon: Stethoscope,
        href: "/doctors",
        linkLabel: "Go to Doctors"
    },
    {
        title: "Patients",
        description: "Keep patient records — contact details, history, and treatments — all in one searchable place.",
        icon: Users,
        href: "/patients",
        linkLabel: "Go to Patients"
    },
    {
        title: "Appointments & Booking",
        description: "Book a visit for a patient with a doctor, then track it on the Appointments board as it moves from Pending to Completed.",
        icon: CalendarDays,
        href: "/appointments",
        linkLabel: "Go to Appointments"
    },
    {
        title: "Prescriptions",
        description: "Write prescriptions for a patient and dispense them straight from stock. DentiGO automatically pulls from the earliest-expiring batch first (FEFO).",
        icon: Pill,
        href: "/prescriptions",
        linkLabel: "Go to Prescriptions"
    },
    {
        title: "Inventory",
        description: "Manage medicines, batches, stock transactions, purchase orders and suppliers. Keep an eye on the Expiry and Low Stock reports, and print barcodes for new stock.",
        icon: Boxes,
        href: "/inventory/medicines",
        linkLabel: "Go to Inventory"
    },
    {
        title: "Invoices & Payments",
        description: "Generate an invoice from a completed appointment, record cash or card payments against it, and handle returns from Sales History.",
        icon: Receipt,
        href: "/invoices/create",
        linkLabel: "Go to Invoices"
    },
    {
        title: "Ledger & Reports",
        description: "The Ledger tracks every payment in and out. Reports roll everything up into clinic-wide revenue and performance numbers.",
        icon: BookOpen,
        href: "/ledger",
        linkLabel: "Go to Ledger"
    },
    {
        title: "AI Assistant",
        description: "The floating sparkle button in the bottom-right corner surfaces smart alerts — expiring batches, low stock, and out-of-stock items — wherever you are in the app.",
        icon: BarChart3
    },
    {
        title: "You're all set",
        description: "That's the full tour. You can replay it anytime from the help icon at the top of the screen.",
        icon: PartyPopper
    }
];

const STORAGE_KEY = "dentigo_tour_completed";

type TourContextValue = {
    isOpen: boolean;
    stepIndex: number;
    steps: TourStep[];
    startTour: () => void;
    closeTour: () => void;
    nextStep: () => void;
    prevStep: () => void;
    goToStep: (index: number) => void;
    hasCompletedTour: () => boolean;
};

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    const hasCompletedTour = useCallback(() => {
        if (typeof window === "undefined") return true;
        return window.localStorage.getItem(STORAGE_KEY) === "1";
    }, []);

    const startTour = useCallback(() => {
        setStepIndex(0);
        setIsOpen(true);
    }, []);

    const closeTour = useCallback(() => {
        setIsOpen(false);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, "1");
        }
    }, []);

    const nextStep = useCallback(() => {
        setStepIndex((i) => {
            if (i >= tourSteps.length - 1) {
                closeTour();
                return i;
            }
            return i + 1;
        });
    }, [closeTour]);

    const prevStep = useCallback(() => {
        setStepIndex((i) => Math.max(0, i - 1));
    }, []);

    const goToStep = useCallback((index: number) => {
        setStepIndex(Math.max(0, Math.min(tourSteps.length - 1, index)));
    }, []);

    const value = useMemo(
        () => ({ isOpen, stepIndex, steps: tourSteps, startTour, closeTour, nextStep, prevStep, goToStep, hasCompletedTour }),
        [isOpen, stepIndex, startTour, closeTour, nextStep, prevStep, goToStep, hasCompletedTour]
    );

    return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
    const ctx = useContext(TourContext);
    if (!ctx) throw new Error("useTour must be used within TourProvider");
    return ctx;
}
