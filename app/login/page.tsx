"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import PillLoader from "@/components/PillLoader";

const DEMO_EMAIL = "admin@dentigo.dev";
const DEMO_PASSWORD = "Dentigo@123";

export default function LoginPage() {
    const { user, loading, signIn } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            router.replace("/dashboard");
        }
    }, [loading, user, router]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await signIn(email, password);
            router.replace("/dashboard");
        } catch (err: any) {
            setError(
                err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password" || err?.code === "auth/user-not-found"
                    ? "Incorrect email or password."
                    : "Couldn't sign in. Check your Firebase setup and try again."
            );
        } finally {
            setSubmitting(false);
        }
    }

    if (loading || (!loading && user)) {
        return (
            <div className="loginScreen">
                <PillLoader label="Signing you in…" />
            </div>
        );
    }

    return (
        <div className="loginScreen">
            <div className="loginCard">
                <div className="loginLogo">
                    <span className="tooth"><Stethoscope size={20} /></span>
                    <strong>DentiGO</strong>
                </div>
                <h2>Welcome back</h2>
                <p>Sign in to access the DentiGO demo workspace.</p>
                <form className="loginForm" onSubmit={handleSubmit}>
                    <label>
                        Email Address
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@dentigo.dev"
                            required
                            autoFocus
                        />
                    </label>
                    <label>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            required
                        />
                    </label>
                    {error && <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{error}</p>}
                    <button type="submit" className="primary" disabled={submitting}>
                        {submitting ? "Signing in…" : "Sign In"}
                    </button>
                </form>
                <button
                    type="button"
                    className="quickDemoBtn"
                    onClick={() => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); }}
                >
                    ⚡ Fill demo credentials
                </button>
            </div>
        </div>
    );
}
