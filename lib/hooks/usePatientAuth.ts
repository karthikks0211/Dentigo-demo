"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase";

export type PatientClaims = {
    role?: "patient" | "doctor" | "admin";
    patientId?: string;
};

export function usePatientAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [claims, setClaims] = useState<PatientClaims | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u);
                try {
                    const tokenResult = await u.getIdTokenResult(true);
                    setClaims({
                        role: tokenResult.claims.role as any,
                        patientId: tokenResult.claims.patientId as string
                    });
                } catch (e) {
                    console.error("Error fetching patient custom claims", e);
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
