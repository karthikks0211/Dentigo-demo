"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import PillLoader from "@/components/PillLoader";

export default function RootPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        router.replace(user ? "/dashboard" : "/login");
    }, [loading, user, router]);

    return (
        <div className="loginScreen">
            <PillLoader label="Loading DentiGO…" />
        </div>
    );
}
