"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useDoctorAuth } from "@/lib/hooks/useDoctorAuth";
import { useAuth } from "@/lib/auth-context";
import PillLoader from "@/components/PillLoader";
import { LayoutDashboard, Calendar, Users, FileText, Activity, CreditCard, LogOut } from "lucide-react";

export default function DoctorLayout({ children }: { children: ReactNode }) {
    const { user, claims, loading } = useDoctorAuth();
    const { signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const isLoginPage = pathname === "/doctor/login";

    useEffect(() => {
        if (!loading && !isLoginPage) {
            if (!user) {
                router.replace("/doctor/login");
            } else if (claims && claims.role !== "doctor") {
                if (claims.role === "patient") {
                    router.replace("/patient/dashboard");
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
                <PillLoader label="Loading Doctor Portal…" />
            </div>
        );
    }

    const navItems = [
        { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/doctor/appointments", label: "Appointments", icon: Calendar },
        { href: "/doctor/patients", label: "My Patients", icon: Users },
        { href: "/doctor/prescriptions", label: "Prescriptions", icon: FileText },
        { href: "/doctor/diagnosis", label: "Diagnosis & Clinical Notes", icon: Activity },
        { href: "/doctor/invoices", label: "Billing & Inventory", icon: CreditCard },
    ];

    return (
        <div className="app">
            <aside className="doctorSidebar" style={{ background: "#0369a1" }}>
                <div className="brand">
                    <div className="tooth" style={{ borderColor: "#bae6fd", color: "#e0f2fe" }}>🩺</div>
                    <div>
                        <strong>DentiGO</strong>
                        <small>Doctor Portal</small>
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
                        Dr. Stephen Strange<br />
                        <span style={{ fontSize: 11, opacity: 0.8 }}>{user.email}</span>
                    </div>
                    <button
                        onClick={async () => {
                            await signOut();
                            router.replace("/doctor/login");
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
