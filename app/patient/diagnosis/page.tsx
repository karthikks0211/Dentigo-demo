"use client";

import { usePatientAuth } from "@/lib/hooks/usePatientAuth";
import { useCollection } from "@/lib/firestore-hooks";
import { getPatientDiagnosisQuery } from "@/lib/firestore/patientPortal";
import { DiagnosisReport } from "@/lib/types";
import { Activity, FileText, ExternalLink } from "lucide-react";

export default function PatientDiagnosisPage() {
    const { claims } = usePatientAuth();
    const patientId = claims?.patientId || "";

    const { data: reports, loading } = useCollection<DiagnosisReport>(
        "diagnosisReports",
        patientId ? getPatientDiagnosisQuery(patientId) : [],
        [patientId]
    );

    if (loading) return <div style={{ padding: 20 }}>Loading diagnosis reports...</div>;

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Diagnosis & Clinical Reports</h1>
            <p style={{ color: "#64748b", margin: "0 0 24px", fontSize: 14 }}>X-rays, scans, and diagnostic notes recorded for your visits.</p>

            {reports.length === 0 ? (
                <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
                    No diagnosis reports found.
                </div>
            ) : (
                <div style={{ display: "grid", gap: 20 }}>
                    {reports.map((report) => (
                        <div key={report.id} style={{ background: "#fff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                <div>
                                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", background: "#e0f2fe", color: "#0369a1", padding: "3px 8px", borderRadius: 4 }}>
                                        {report.reportType}
                                    </span>
                                    <h3 style={{ margin: "8px 0 0", fontSize: 18, color: "#0f172a" }}>{report.title}</h3>
                                </div>
                                <div style={{ fontSize: 13, color: "#64748b" }}>
                                    Date: {report.reportDate}
                                </div>
                            </div>

                            {report.toothNumber && (
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#087f78", marginBottom: 8 }}>
                                    Tooth Target: #{report.toothNumber}
                                </div>
                            )}

                            <div style={{ fontSize: 14, color: "#334155", background: "#f8fafc", padding: 14, borderRadius: 8, marginBottom: 16 }}>
                                <strong>Clinical Notes:</strong>
                                <p style={{ margin: "4px 0 0", color: "#475569" }}>{report.clinicalNotes}</p>
                            </div>

                            {report.fileUrl && (
                                <a
                                    href={report.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#087f78", textDecoration: "none" }}
                                >
                                    <FileText size={16} /> View Diagnostic Document / Image ({report.fileName}) <ExternalLink size={14} />
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
