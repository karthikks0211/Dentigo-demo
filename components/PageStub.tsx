import { ComponentType } from "react";
import { Hammer } from "lucide-react";

export default function PageStub({
    title,
    description,
    icon: Icon = Hammer
}: {
    title: string;
    description: string;
    icon?: ComponentType<{ size?: number }>;
}) {
    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>{title}</h1>
                    <p>{description}</p>
                </div>
            </div>
            <div className="card" style={{ padding: "56px 24px", textAlign: "center" }}>
                <div style={{ display: "grid", placeItems: "center", gap: 12 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: "50%",
                        background: "var(--dg-teal-50)", color: "var(--dg-teal-700)",
                        display: "grid", placeItems: "center"
                    }}>
                        <Icon size={22} />
                    </div>
                    <strong style={{ fontSize: 15 }}>Coming up in the next build pass</strong>
                    <p style={{ margin: 0, color: "var(--dg-muted)", fontSize: 13, maxWidth: 340 }}>
                        This section is scaffolded and next in line to be built out.
                    </p>
                </div>
            </div>
        </>
    );
}
