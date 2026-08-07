"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppShell from "@/components/AppShell";
import PillLoader from "@/components/PillLoader";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.replace("/login");
        }
    }, [loading, user, router]);

    if (loading || !user) {
        return (
            <div className="loginScreen">
                <PillLoader label="Loading DentiGO…" />
            </div>
        );
    }

    return <AppShell>{children}</AppShell>;
}
