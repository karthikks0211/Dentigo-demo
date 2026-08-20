"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
    Plus, Search, FileText, Trash2, Eye, Download, Calendar,
    UploadCloud, User, Stethoscope, Filter, Activity, Layers,
    FileSpreadsheet, Sparkles, MoreVertical, Pencil
} from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import {
    createDiagnosisReport,
    updateDiagnosisReport,
    deleteDiagnosisReport,
    formatBytes,
    DIAGNOSIS_REPORT_TYPES
} from "@/lib/diagnosis";
import type { DiagnosisReport, DiagnosisReportType, Patient, Doctor, Appointment } from "@/lib/types";
import Drawer from "@/components/ui/Drawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PillLoader from "@/components/PillLoader";

function getReportBadgeColor(type: DiagnosisReportType) {
    switch (type) {
        case "Dental X-Ray (IOPA/OPG)":
            return { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" };
        case "CBCT / CT Scan":
            return { bg: "#ede9fe", text: "#6d28d9", border: "#ddd6fe" };
        case "Blood Test":
            return { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" };
        case "Biopsy / Pathology":
            return { bg: "#fef3c7", text: "#b45309", border: "#fde68a" };
        case "MRI":
            return { bg: "#f3e8ff", text: "#7e22ce", border: "#e9d5ff" };
        case "ECG":
            return { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" };
        default:
            return { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" };
    }
}

export default function DiagnosisPage() {
    const { data: reports, loading: loadingReports } = useCollection<DiagnosisReport>("diagnosisReports");
    const { data: patients, loading: loadingPatients } = useCollection<Patient>("patients");
    const { data: doctors } = useCollection<Doctor>("doctors");
    const showToast = useToast();

    // Filters and search
    const [query, setQuery] = useState("");
    const [selectedPatientId, setSelectedPatientId] = useState<string>("all");
    const [selectedType, setSelectedType] = useState<string>("all");

    // Modal / Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingReport, setEditingReport] = useState<DiagnosisReport | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewModalReport, setPreviewModalReport] = useState<DiagnosisReport | null>(null);
    const [deletingReport, setDeletingReport] = useState<DiagnosisReport | null>(null);

    // Active dropdown action menu state
    const [activeMenuReportId, setActiveMenuReportId] = useState<string | null>(null);
    const actionMenuRef = useRef<HTMLDivElement | null>(null);

    // Close action dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
                setActiveMenuReportId(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Form inputs state
    const [formPatientId, setFormPatientId] = useState<string>("");
    const [formDoctorId, setFormDoctorId] = useState<string>("");
    const [formReportType, setFormReportType] = useState<DiagnosisReportType>("Dental X-Ray (IOPA/OPG)");

    const loading = loadingReports || loadingPatients;

    const patientMap = useMemo(() => {
        const map = new Map<string, Patient>();
        patients.forEach((p) => map.set(p.id, p));
        return map;
    }, [patients]);

    const doctorMap = useMemo(() => {
        const map = new Map<string, Doctor>();
        doctors.forEach((d) => map.set(d.id, d));
        return map;
    }, [doctors]);

    const patientFor = (id: string) => patientMap.get(id)?.name || "Unknown Patient";
    const doctorFor = (id: string) => doctorMap.get(id)?.name || "Attending Specialist";

    // Computed metrics
    const metrics = useMemo(() => {
        const total = reports.length;
        const xrays = reports.filter((r) => r.reportType.includes("X-Ray") || r.reportType.includes("CBCT") || r.reportType.includes("CT")).length;
        const labs = reports.filter((r) => r.reportType.includes("Blood") || r.reportType.includes("Biopsy")).length;
        
        const thisMonthIso = new Date().toISOString().slice(0, 7);
        const thisMonthCount = reports.filter((r) => (r.reportDate || "").startsWith(thisMonthIso)).length;

        return { total, xrays, labs, thisMonthCount };
    }, [reports]);

    // Filtered reports list
    const filteredReports = useMemo(() => {
        const q = query.toLowerCase().trim();
        return [...reports]
            .sort((a, b) => (b.reportDate || "").localeCompare(a.reportDate || "") || b.createdAt - a.createdAt)
            .filter((r) => {
                const matchesQuery =
                    !q ||
                    r.title.toLowerCase().includes(q) ||
                    patientFor(r.patientId).toLowerCase().includes(q) ||
                    doctorFor(r.doctorId).toLowerCase().includes(q) ||
                    (r.toothNumber && r.toothNumber.includes(q)) ||
                    r.clinicalNotes.toLowerCase().includes(q);

                const matchesPatient = selectedPatientId === "all" || r.patientId === selectedPatientId;
                const matchesType = selectedType === "all" || r.reportType === selectedType;

                return matchesQuery && matchesPatient && matchesType;
            });
    }, [reports, query, selectedPatientId, selectedType, patientMap, doctorMap]);

    function openCreateDrawer(prefilledPatientId?: string) {
        setEditingReport(null);
        setFormPatientId(prefilledPatientId || patients[0]?.id || "");
        setFormDoctorId(doctors[0]?.id || "");
        setFormReportType("Dental X-Ray (IOPA/OPG)");
        setSelectedFile(null);
        setDrawerOpen(true);
    }

    function openEditDrawer(report: DiagnosisReport) {
        setActiveMenuReportId(null);
        setEditingReport(report);
        setFormPatientId(report.patientId);
        setFormDoctorId(report.doctorId);
        setFormReportType(report.reportType);
        setSelectedFile(null);
        setDrawerOpen(true);
    }

    async function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const patientId = String(f.get("patient") || formPatientId);
        const doctorId = String(f.get("doctor") || formDoctorId);
        const reportType = String(f.get("reportType") || formReportType) as DiagnosisReportType;
        const title = String(f.get("title") || "").trim();
        const toothNumber = String(f.get("toothNumber") || "").trim();
        const reportDate = String(f.get("reportDate") || new Date().toISOString().slice(0, 10));
        const clinicalNotes = String(f.get("clinicalNotes") || "").trim();

        if (!patientId) {
            showToast("Please select a patient", "error");
            return;
        }
        if (!doctorId) {
            showToast("Please select a doctor", "error");
            return;
        }
        if (!title) {
            showToast("Please provide a title or test name", "error");
            return;
        }

        if (!editingReport && !selectedFile) {
            showToast("Please select a diagnostic file/scan to upload", "error");
            return;
        }

        if (selectedFile && selectedFile.size > 25 * 1024 * 1024) {
            showToast("File is too large. Please select a file under 25MB.", "error");
            return;
        }

        setSubmitting(true);
        try {
            if (editingReport) {
                await updateDiagnosisReport({
                    id: editingReport.id,
                    patientId,
                    doctorId,
                    reportType,
                    title,
                    toothNumber,
                    clinicalNotes,
                    reportDate,
                    file: selectedFile,
                    existingFileUrl: editingReport.fileUrl,
                    existingFileName: editingReport.fileName,
                    existingFileSizeBytes: editingReport.fileSizeBytes,
                    existingMimeType: editingReport.mimeType,
                    existingPublicId: editingReport.publicId,
                    existingStorageProvider: editingReport.storageProvider
                });
                showToast("Diagnostic report updated successfully");
            } else {
                await createDiagnosisReport({
                    patientId,
                    doctorId,
                    reportType,
                    title,
                    toothNumber,
                    clinicalNotes,
                    reportDate,
                    file: selectedFile!
                });
                showToast("Diagnosis report uploaded and saved to patient record");
            }

            setDrawerOpen(false);
            setEditingReport(null);
            setSelectedFile(null);
        } catch (err: any) {
            console.error("Save error:", err);
            showToast(err?.message || "Failed to save diagnosis report", "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function confirmDelete() {
        if (!deletingReport) return;
        setSubmitting(true);
        try {
            await deleteDiagnosisReport(deletingReport);
            showToast("Report deleted successfully");
            setDeletingReport(null);
        } catch (err: any) {
            showToast("Could not delete report", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return <PillLoader label="Loading diagnostic records and scans…" />;
    }

    return (
        <>
            {/* Page Header */}
            <div className="pageHead">
                <div>
                    <h1>Diagnosis &amp; Diagnostic Reports</h1>
                    <p>Centralized digital hub for patient X-rays, CT/CBCT scans, lab tests, and clinical findings.</p>
                </div>
                <button className="primary" onClick={() => openCreateDrawer()}>
                    <Plus size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
                    Upload Diagnostic Report
                </button>
            </div>

            {/* Quick Metrics */}
            <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 24 }}>
                <div className="stat">
                    <div className="statTop"><p>Total Records</p><FileText size={18} color="#087f78" /></div>
                    <b>{metrics.total}</b>
                    <small>Indexed across all patients</small>
                </div>
                <div className="stat">
                    <div className="statTop"><p>Imaging &amp; Scans</p><Layers size={18} color="#0284c7" /></div>
                    <b>{metrics.xrays}</b>
                    <small>X-Rays, CBCT, CT &amp; MRI</small>
                </div>
                <div className="stat">
                    <div className="statTop"><p>Laboratory Tests</p><Activity size={18} color="#dc2626" /></div>
                    <b>{metrics.labs}</b>
                    <small>Blood, Biopsies &amp; Pathology</small>
                </div>
                <div className="stat">
                    <div className="statTop"><p>Uploaded This Month</p><Calendar size={18} color="#059669" /></div>
                    <b>{metrics.thisMonthCount}</b>
                    <small>Recent clinical records</small>
                </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="card tableCard">
                <div className="tableTools" style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
                    <div className="search" style={{ minWidth: 260, flex: "1 1 260px" }}>
                        <Search size={15} className="searchIcon" />
                        <input
                            placeholder="Search by patient, title, doctor, tooth #, notes…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {/* Patient Filter */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <User size={14} color="#64748b" />
                            <select
                                value={selectedPatientId}
                                onChange={(e) => setSelectedPatientId(e.target.value)}
                                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}
                            >
                                <option value="all">All Patients ({patients.length})</option>
                                {patients.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Report Type Filter */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Filter size={14} color="#64748b" />
                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}
                            >
                                <option value="all">All Categories</option>
                                {DIAGNOSIS_REPORT_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Reports Table with Centered Alignments */}
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ textAlign: "center" }}>Report &amp; Category</th>
                                <th style={{ textAlign: "center" }}>Patient Name</th>
                                <th style={{ textAlign: "center" }}>Attending Doctor</th>
                                <th style={{ textAlign: "center" }}>Tooth # / Area</th>
                                <th style={{ textAlign: "center" }}>Test Date</th>
                                <th style={{ textAlign: "center" }}>File Size</th>
                                <th style={{ textAlign: "center" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReports.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: "center" }}>
                                        <div className="empty" style={{ padding: "48px 20px" }}>
                                            <Activity size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
                                            <br />
                                            <strong>No diagnostic reports found</strong>
                                            <p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                                                {query || selectedPatientId !== "all" || selectedType !== "all"
                                                    ? "Try clearing your filters or search query."
                                                    : "Upload your first X-ray, scan, or blood test report above."}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredReports.map((report) => {
                                    const badgeStyle = getReportBadgeColor(report.reportType);
                                    const isImage = report.mimeType?.startsWith("image/") || (report.fileName && /\.(jpg|jpeg|png|webp)$/i.test(report.fileName));
                                    const isMenuOpen = activeMenuReportId === report.id;

                                    return (
                                        <tr key={report.id}>
                                            {/* Report & Category */}
                                            <td style={{ textAlign: "center" }}>
                                                <div style={{ display: "inline-flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                                                    <div
                                                        onClick={() => setPreviewModalReport(report)}
                                                        style={{
                                                            width: 44,
                                                            height: 44,
                                                            borderRadius: 8,
                                                            overflow: "hidden",
                                                            background: "#f1f5f9",
                                                            border: "1px solid #e2e8f0",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            cursor: "pointer",
                                                            flexShrink: 0
                                                        }}
                                                        title="Click to preview scan"
                                                    >
                                                        {isImage && report.fileUrl ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={report.fileUrl}
                                                                alt={report.title}
                                                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                            />
                                                        ) : (
                                                            <FileSpreadsheet size={20} color="#087f78" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div
                                                            style={{ fontWeight: 600, color: "#0f172a", fontSize: 14, cursor: "pointer" }}
                                                            onClick={() => setPreviewModalReport(report)}
                                                        >
                                                            {report.title}
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                                                            <span
                                                                style={{
                                                                    display: "inline-block",
                                                                    padding: "2px 8px",
                                                                    borderRadius: 12,
                                                                    fontSize: 11,
                                                                    fontWeight: 600,
                                                                    background: badgeStyle.bg,
                                                                    color: badgeStyle.text,
                                                                    border: `1px solid ${badgeStyle.border}`
                                                                }}
                                                            >
                                                                {report.reportType}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Patient Name */}
                                            <td style={{ textAlign: "center" }}>
                                                <span style={{ fontWeight: 600, color: "#1e293b" }}>{patientFor(report.patientId)}</span>
                                            </td>

                                            {/* Attending Doctor */}
                                            <td style={{ textAlign: "center" }}>
                                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#475569" }}>
                                                    <Stethoscope size={13} color="#087f78" />
                                                    <span>{doctorFor(report.doctorId)}</span>
                                                </div>
                                            </td>

                                            {/* Tooth # */}
                                            <td style={{ textAlign: "center" }}>
                                                {report.toothNumber ? (
                                                    <span style={{ background: "#f8fafc", border: "1px solid #cbd5e1", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                                                        Tooth #{report.toothNumber}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "#94a3b8", fontSize: 13 }}>General</span>
                                                )}
                                            </td>

                                            {/* Test Date */}
                                            <td style={{ textAlign: "center", fontSize: 13, color: "#475569" }}>
                                                {report.reportDate || new Date(report.createdAt).toISOString().slice(0, 10)}
                                            </td>

                                            {/* File Size */}
                                            <td style={{ textAlign: "center", fontSize: 12, color: "#64748b" }}>
                                                {formatBytes(report.fileSizeBytes)}
                                            </td>

                                            {/* Actions with Three-Dot Popup Menu */}
                                            <td style={{ textAlign: "center", position: "relative" }}>
                                                <div style={{ display: "inline-block", position: "relative" }}>
                                                    <button
                                                        className="more"
                                                        title="Options"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveMenuReportId(isMenuOpen ? null : report.id);
                                                        }}
                                                        style={{
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: 6,
                                                            background: isMenuOpen ? "#e6f4f3" : "transparent",
                                                            color: isMenuOpen ? "#087f78" : "#64748b",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            border: isMenuOpen ? "1px solid #087f7833" : "none"
                                                        }}
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>

                                                    {/* Dropdown Action Menu */}
                                                    {isMenuOpen && (
                                                        <div
                                                            ref={actionMenuRef}
                                                            style={{
                                                                position: "absolute",
                                                                right: 0,
                                                                top: "100%",
                                                                marginTop: 4,
                                                                background: "#ffffff",
                                                                border: "1px solid #e2e8f0",
                                                                borderRadius: 8,
                                                                boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                                                                zIndex: 40,
                                                                minWidth: 160,
                                                                padding: "6px 0",
                                                                textAlign: "left"
                                                            }}
                                                        >
                                                            <button
                                                                onClick={() => {
                                                                    setActiveMenuReportId(null);
                                                                    setPreviewModalReport(report);
                                                                }}
                                                                style={{
                                                                    width: "100%",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 8,
                                                                    padding: "8px 14px",
                                                                    border: "none",
                                                                    background: "transparent",
                                                                    color: "#0f172a",
                                                                    fontSize: 13,
                                                                    cursor: "pointer"
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                                            >
                                                                <Eye size={14} color="#087f78" /> View Report
                                                            </button>

                                                            <button
                                                                onClick={() => openEditDrawer(report)}
                                                                style={{
                                                                    width: "100%",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 8,
                                                                    padding: "8px 14px",
                                                                    border: "none",
                                                                    background: "transparent",
                                                                    color: "#0f172a",
                                                                    fontSize: 13,
                                                                    cursor: "pointer"
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                                            >
                                                                <Pencil size={14} color="#0284c7" /> Edit Details
                                                            </button>

                                                            {report.fileUrl && (
                                                                <a
                                                                    href={report.fileUrl}
                                                                    download={report.fileName || "diagnosis_report"}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={() => setActiveMenuReportId(null)}
                                                                    style={{
                                                                        width: "100%",
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: 8,
                                                                        padding: "8px 14px",
                                                                        color: "#0f172a",
                                                                        fontSize: 13,
                                                                        textDecoration: "none",
                                                                        boxSizing: "border-box"
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                                                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                                                >
                                                                    <Download size={14} color="#059669" /> Download File
                                                                </a>
                                                            )}

                                                            <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0" }} />

                                                            <button
                                                                onClick={() => {
                                                                    setActiveMenuReportId(null);
                                                                    setDeletingReport(report);
                                                                }}
                                                                style={{
                                                                    width: "100%",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 8,
                                                                    padding: "8px 14px",
                                                                    border: "none",
                                                                    background: "transparent",
                                                                    color: "#dc2626",
                                                                    fontSize: 13,
                                                                    cursor: "pointer"
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = "#fee2e2"}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                                            >
                                                                <Trash2 size={14} color="#dc2626" /> Delete Report
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Upload & Edit Report Drawer */}
            {drawerOpen && (
                <Drawer
                    title={editingReport ? "Edit Diagnostic Report" : "Upload Diagnostic Report"}
                    subtitle={
                        editingReport
                            ? `Updating "${editingReport.title}" for ${patientFor(editingReport.patientId)}`
                            : "Attach X-rays, lab scans, or biopsy findings to a patient profile."
                    }
                    onClose={() => { setDrawerOpen(false); setEditingReport(null); setSelectedFile(null); }}
                    footer={
                        <>
                            <button type="button" onClick={() => { setDrawerOpen(false); setEditingReport(null); setSelectedFile(null); }}>
                                Cancel
                            </button>
                            <button type="submit" form="diagnosis-upload-form" className="primary" disabled={submitting}>
                                {submitting ? "Saving…" : editingReport ? "Update Report" : "Save Diagnostic Record"}
                            </button>
                        </>
                    }
                >
                    <form id="diagnosis-upload-form" onSubmit={handleFormSubmit} style={{ display: "grid", gap: 16 }}>
                        {/* Patient Selection */}
                        <label>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                Select Patient <span style={{ color: "#dc2626", fontWeight: 700 }}>*</span>
                            </span>
                            <select
                                name="patient"
                                value={formPatientId}
                                onChange={(e) => setFormPatientId(e.target.value)}
                                required
                            >
                                {patients.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.phone || p.email})
                                    </option>
                                ))}
                            </select>
                        </label>

                        {/* Doctor Selection */}
                        <label>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                Treating / Requesting Doctor <span style={{ color: "#dc2626", fontWeight: 700 }}>*</span>
                            </span>
                            <select
                                name="doctor"
                                value={formDoctorId}
                                onChange={(e) => setFormDoctorId(e.target.value)}
                                required
                            >
                                {doctors.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name} ({d.specialty})
                                    </option>
                                ))}
                            </select>
                        </label>

                        {/* Report Category */}
                        <div className="two">
                            <label>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    Report Category <span style={{ color: "#dc2626", fontWeight: 700 }}>*</span>
                                </span>
                                <select
                                    name="reportType"
                                    value={formReportType}
                                    onChange={(e) => setFormReportType(e.target.value as DiagnosisReportType)}
                                    required
                                >
                                    {DIAGNOSIS_REPORT_TYPES.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                <span>Tooth # / Region (Optional)</span>
                                <input
                                    name="toothNumber"
                                    defaultValue={editingReport?.toothNumber || ""}
                                    placeholder="e.g. 14, 38, Upper Arch"
                                />
                            </label>
                        </div>

                        {/* Title & Date */}
                        <div className="two">
                            <label>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    Report / Test Title <span style={{ color: "#dc2626", fontWeight: 700 }}>*</span>
                                </span>
                                <input
                                    name="title"
                                    defaultValue={editingReport?.title || ""}
                                    placeholder="e.g. Pre-Op IOPA X-Ray"
                                    required
                                />
                            </label>

                            <label>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    Test Date <span style={{ color: "#dc2626", fontWeight: 700 }}>*</span>
                                </span>
                                <input
                                    name="reportDate"
                                    type="date"
                                    defaultValue={editingReport?.reportDate || new Date().toISOString().slice(0, 10)}
                                    required
                                />
                            </label>
                        </div>

                        {/* File Upload Drop Area */}
                        <div>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#4a5f63", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                                Attach Diagnostic File / Scan {!editingReport && <span style={{ color: "#dc2626", fontWeight: 700 }}>*</span>}
                            </span>
                            <div
                                style={{
                                    border: "2px dashed #cbd5e1",
                                    borderRadius: 10,
                                    padding: "20px 16px",
                                    textAlign: "center",
                                    background: selectedFile ? "#f0fdfa" : "#f8fafc",
                                    borderColor: selectedFile ? "#087f78" : "#cbd5e1",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease"
                                }}
                                onClick={() => document.getElementById("diagnostic-file-input")?.click()}
                            >
                                <input
                                    id="diagnostic-file-input"
                                    type="file"
                                    accept="image/*,application/pdf"
                                    style={{ display: "none" }}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setSelectedFile(e.target.files[0]);
                                        }
                                    }}
                                />
                                <UploadCloud size={28} color={selectedFile ? "#087f78" : "#94a3b8"} style={{ margin: "0 auto 8px" }} />
                                {selectedFile ? (
                                    <div>
                                        <strong style={{ color: "#087f78", display: "block", fontSize: 14 }}>
                                            {selectedFile.name}
                                        </strong>
                                        <small style={{ color: "#64748b" }}>
                                            {formatBytes(selectedFile.size)} • Click to change file
                                        </small>
                                    </div>
                                ) : editingReport ? (
                                    <div>
                                        <strong style={{ color: "#334155", display: "block", fontSize: 13 }}>
                                            Current File: {editingReport.fileName} ({formatBytes(editingReport.fileSizeBytes)})
                                        </strong>
                                        <small style={{ color: "#087f78", fontWeight: 600, display: "block", marginTop: 4 }}>
                                            Click to replace with new file (optional)
                                        </small>
                                    </div>
                                ) : (
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 500, color: "#334155", fontSize: 14 }}>
                                            Click to browse or drop diagnostic scan
                                        </p>
                                        <small style={{ color: "#94a3b8", display: "block", marginTop: 4 }}>
                                            Supports X-rays (JPG, PNG), CBCT slices, Lab PDFs up to 25MB
                                        </small>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Clinical Findings and Notes */}
                        <label>
                            <span>Clinical Findings / Doctor Interpretation</span>
                            <textarea
                                name="clinicalNotes"
                                defaultValue={editingReport?.clinicalNotes || ""}
                                rows={3}
                                placeholder="Enter diagnostic observations, periapical pathology, bone levels, or lab abnormalities…"
                                style={{ resize: "vertical", width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
                            />
                        </label>
                    </form>
                </Drawer>
            )}

            {/* Diagnostic Report Preview & High-Res Viewer Modal */}
            {previewModalReport && (
                <div
                    className="modalOverlay"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) setPreviewModalReport(null); }}
                >
                    <div className="modalCard" style={{ maxWidth: 840, width: "95%" }}>
                        <div className="modalHead" style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <div>
                                <h3 style={{ margin: 0 }}>{previewModalReport.title}</h3>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                                    <span style={{ fontSize: 12, color: "#64748b" }}>
                                        Patient: <strong>{patientFor(previewModalReport.patientId)}</strong>
                                    </span>
                                    <span style={{ color: "#cbd5e1" }}>•</span>
                                    <span style={{ fontSize: 12, color: "#64748b" }}>
                                        Doctor: <strong>{doctorFor(previewModalReport.doctorId)}</strong>
                                    </span>
                                    {previewModalReport.toothNumber && (
                                        <>
                                            <span style={{ color: "#cbd5e1" }}>•</span>
                                            <span style={{ fontSize: 12, color: "#087f78", fontWeight: 600 }}>
                                                Tooth #{previewModalReport.toothNumber}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button className="closeBtn" onClick={() => setPreviewModalReport(null)}>&times;</button>
                        </div>

                        <div className="modalBody" style={{ maxHeight: "70vh", overflowY: "auto", padding: "20px" }}>
                            {/* File Display Box */}
                            <div
                                style={{
                                    background: "#0f172a",
                                    borderRadius: 8,
                                    overflow: "hidden",
                                    textAlign: "center",
                                    minHeight: 280,
                                    maxHeight: 480,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: 16
                                }}
                            >
                                {previewModalReport.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(previewModalReport.fileName) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={previewModalReport.fileUrl}
                                        alt={previewModalReport.title}
                                        style={{
                                            maxWidth: "100%",
                                            maxHeight: 480,
                                            objectFit: "contain"
                                        }}
                                    />
                                ) : previewModalReport.mimeType === "application/pdf" ? (
                                    <iframe
                                        src={previewModalReport.fileUrl}
                                        title={previewModalReport.title}
                                        style={{ width: "100%", height: 420, border: "none" }}
                                    />
                                ) : (
                                    <div style={{ padding: 40, color: "#fff" }}>
                                        <FileSpreadsheet size={48} color="#38bdf8" style={{ marginBottom: 12 }} />
                                        <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{previewModalReport.fileName}</p>
                                        <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                                            {formatBytes(previewModalReport.fileSizeBytes)}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Clinical Findings Section */}
                            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 18px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                    <Sparkles size={15} color="#087f78" />
                                    <strong style={{ fontSize: 13, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                        Doctor&rsquo;s Clinical Findings &amp; Notes
                                    </strong>
                                </div>
                                <p style={{ margin: 0, fontSize: 14, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                    {previewModalReport.clinicalNotes || "No clinical interpretation recorded for this test."}
                                </p>
                            </div>
                        </div>

                        <div className="modalFoot" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 12, color: "#64748b" }}>
                                Recorded on {previewModalReport.reportDate || new Date(previewModalReport.createdAt).toLocaleDateString()}
                            </div>
                            <div style={{ display: "flex", gap: 10 }}>
                                {previewModalReport.fileUrl && (
                                    <a
                                        href={previewModalReport.fileUrl}
                                        download={previewModalReport.fileName || "scan"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="primary"
                                        style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", padding: "8px 14px" }}
                                    >
                                        <Download size={14} /> Download Original Scan
                                    </a>
                                )}
                                <button onClick={() => setPreviewModalReport(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {deletingReport && (
                <ConfirmModal
                    title="Delete Diagnostic Report"
                    message={`Are you sure you want to permanently delete "${deletingReport.title}" for ${patientFor(deletingReport.patientId)}? This action cannot be undone.`}
                    confirmLabel="Delete Report"
                    danger
                    loading={submitting}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeletingReport(null)}
                />
            )}
        </>
    );
}
