"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { usePatientAuth } from "@/lib/hooks/usePatientAuth";
import { useAuth } from "@/lib/auth-context";
import PillLoader from "@/components/PillLoader";
import { Calendar, User, FileText, Activity, CreditCard, LogOut, LayoutDashboard } from "lucide-react";

export default function PatientLayout({ children }: { children: ReactNode }) {
    const { user, claims, loading } = usePatientAuth();
    const { signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const isLoginPage = pathname === "/patient/login";

    useEffect(() => {
        if (!loading && !isLoginPage) {
            if (!user) {
                router.replace("/patient/login");
            } else if (claims && claims.role !== "patient") {
                // If logged in as non-patient, deny access or redirect
                if (claims.role === "doctor") {
                    router.replace("/doctor/dashboard");
                } else {
                    router.replace("/login");
                }
            }
        }
    }, [user, claims, loading, isLoginPage, router]);

    if (isLoginPage) {
        return <>{children}</>;
    }

    if (loading || !user) {
        return (
            <div className="loginScreen">
                <PillLoader label="Loading Patient Portal…" />
            </div>
        );
    }

    const navItems = [
        { href: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/patient/appointments/book", label: "Book Appointment", icon: Calendar },
        { href: "/patient/doctors-visited", label: "Doctors Visited", icon: User },
        { href: "/patient/prescriptions", label: "Prescriptions", icon: FileText },
        { href: "/patient/diagnosis", label: "Diagnosis Reports", icon: Activity },
        { href: "/patient/invoices", label: "Invoices", icon: CreditCard },
    ];

    return (
        <div className="app">
            <aside className="patientSidebar">
                <div className="brand">
                    <div className="tooth">🦷</div>
                    <div>
                        <strong>DentiGO</strong>
                        <small>Patient Portal</small>
                    </div>
                </div>

                <nav>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={active ? "activeNav" : ""}
                            >
                                <Icon size={18} style={{ marginRight: 10 }} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="sideBottom" style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.15)" }}>
                    <div style={{ fontSize: 13, color: "#e0f2fe", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis" }}>
                        Logged in as: <strong style={{ display: "block" }}>{user.email}</strong>
                    </div>
                    <button
                        onClick={async () => {
                            await signOut();
                            router.replace("/patient/login");
                        }}
                        style={{ width: "100%", justifyContent: "flex-start" }}
                    >
                        <LogOut size={18} style={{ marginRight: 10 }} />
                        Sign Out
                    </button>
                </div>
            </aside>

            <main style={{ marginLeft: 250, flex: 1, padding: 32, background: "#f7fafa", minHeight: "100vh" }}>
                {children}
            </main>
        </div>
    );
}
