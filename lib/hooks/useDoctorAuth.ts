"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase";

export type DoctorClaims = {
    role?: "patient" | "doctor" | "admin";
    doctorId?: string;
};

export function useDoctorAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [claims, setClaims] = useState<DoctorClaims | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u);
                try {
                    const tokenResult = await u.getIdTokenResult(true);
                    setClaims({
                        role: tokenResult.claims.role as any,
                        doctorId: tokenResult.claims.doctorId as string
                    });
                } catch (e) {
                    console.error("Error fetching doctor custom claims", e);
                    setClaims(null);
                }
            } else {
                setUser(null);
                setClaims(null);
            }
            setLoading(false);
        });

        return unsub;
    }, []);

    return { user, claims, loading };
}
