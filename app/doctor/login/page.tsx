"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function DoctorLoginPage() {
    const { signIn } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("dr.strange@clinic.com");
    const [password, setPassword] = useState("Doctor@123");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await signIn(email, password);
            router.replace("/doctor/dashboard");
        } catch (err: any) {
            setError(err.message || "Failed to sign in. Please verify credentials.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f0f9ff", padding: 20 }}>
            <div style={{ background: "#fff", padding: 36, borderRadius: 16, boxShadow: "0 10px 25px rgba(0,0,0,0.08)", width: "100%", maxWidth: 420 }}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🩺</div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0369a1" }}>Doctor Portal</h1>
                    <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 14 }}>Dr. Stephen Strange Login</p>
                </div>

                {error && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
                    <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                            Email Address
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                        />
                    </div>

                    <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                            Password
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        style={{
                            height: 44,
                            background: "#0369a1",
                            color: "#fff",
                            border: 0,
                            borderRadius: 8,
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: "pointer",
                            marginTop: 8
                        }}
                    >
                        {submitting ? "Signing in..." : "Sign In to Doctor Portal"}
                    </button>
                </form>

                <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0", fontSize: 13, color: "#64748b" }}>
                    <strong>Doctor Login Credentials:</strong>
                    <div style={{ marginTop: 4 }}>Email: <code>dr.strange@clinic.com</code></div>
                    <div>Password: <code>Doctor@123</code></div>
                </div>
            </div>
        </div>
    );
}
