import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import type { DiagnosisReport, DiagnosisReportType } from "./types";

export const DIAGNOSIS_REPORT_TYPES: DiagnosisReportType[] = [
    "Dental X-Ray (IOPA/OPG)",
    "CBCT / CT Scan",
    "Blood Test",
    "MRI",
    "Biopsy / Pathology",
    "ECG",
    "Endoscopy",
    "Other"
];

/**
 * Reads a File object into a base64 Data URL.
 * Used as a zero-config fallback if Cloudinary credentials are not set in .env.local.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

/**
 * Uploads a document/scan directly to Cloudinary using their REST API.
 * Uses NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET if present.
 */
export async function uploadToCloudinary(
    file: File,
    folder = "dentigo/diagnosis"
): Promise<{ secure_url: string; public_id: string; format: string } | null> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
        return null;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", folder);

    // Determine resource type: 'image' or 'raw' (for non-image documents / PDFs)
    const isImage = file.type.startsWith("image/");
    const resourceType = isImage ? "image" : "auto";

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        {
            method: "POST",
            body: formData
        }
    );

    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Cloudinary upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return {
        secure_url: data.secure_url || data.url,
        public_id: data.public_id,
        format: data.format || ""
    };
}

export type UploadReportParams = {
    patientId: string;
    doctorId: string;
    appointmentId: string;
    reportType: DiagnosisReportType;
    title: string;
    toothNumber?: string;
    clinicalNotes: string;
    reportDate: string;
    fee?: number;
    file: File;
};

/**
 * Uploads diagnostic file to Cloudinary (with fallback to data URL) and records
 * metadata in Firestore under `diagnosisReports`.
 */
export async function createDiagnosisReport(params: UploadReportParams): Promise<string> {
    const {
        patientId,
        doctorId,
        appointmentId,
        reportType,
        title,
        toothNumber,
        clinicalNotes,
        reportDate,
        fee,
        file
    } = params;

    let fileUrl = "";
    let publicId: string | undefined = undefined;
    let storageProvider: "cloudinary" | "local" = "local";

    try {
        const cloudinaryResult = await uploadToCloudinary(file, `dentigo/diagnosis/${patientId}`);
        if (cloudinaryResult) {
            fileUrl = cloudinaryResult.secure_url;
            publicId = cloudinaryResult.public_id;
            storageProvider = "cloudinary";
        }
    } catch (err) {
        console.warn("Cloudinary upload encountered an issue, using fallback storage:", err);
    }

    // If Cloudinary isn't configured or was skipped, use fallback Data URL
    if (!fileUrl) {
        fileUrl = await readFileAsDataUrl(file);
        storageProvider = "local";
    }

    const docRef = await addDoc(collection(db, "diagnosisReports"), {
        patientId,
        doctorId,
        appointmentId,
        reportType,
        title,
        toothNumber: toothNumber || "",
        clinicalNotes: clinicalNotes || "",
        fileUrl,
        publicId: publicId || "",
        storageProvider,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type || "application/octet-stream",
        reportDate: reportDate || new Date().toISOString().slice(0, 10),
        fee: fee || 0,
        billed: false,
        createdAt: Date.now()
    });

    return docRef.id;
}

export type UpdateReportParams = {
    id: string;
    patientId: string;
    doctorId: string;
    appointmentId: string;
    reportType: DiagnosisReportType;
    title: string;
    toothNumber?: string;
    clinicalNotes: string;
    reportDate: string;
    fee?: number;
    file?: File | null;
    existingFileUrl: string;
    existingFileName: string;
    existingFileSizeBytes: number;
    existingMimeType: string;
    existingPublicId?: string;
    existingStorageProvider?: "cloudinary" | "local" | "firebase";
};

/**
 * Updates an existing diagnostic report's metadata (and optional replacement file)
 */
export async function updateDiagnosisReport(params: UpdateReportParams): Promise<void> {
    const {
        id,
        patientId,
        doctorId,
        appointmentId,
        reportType,
        title,
        toothNumber,
        clinicalNotes,
        reportDate,
        fee,
        file,
        existingFileUrl,
        existingFileName,
        existingFileSizeBytes,
        existingMimeType,
        existingPublicId,
        existingStorageProvider
    } = params;

    let fileUrl = existingFileUrl;
    let fileName = existingFileName;
    let fileSizeBytes = existingFileSizeBytes;
    let mimeType = existingMimeType;
    let publicId = existingPublicId || "";
    let storageProvider = existingStorageProvider || "local";

    if (file) {
        fileName = file.name;
        fileSizeBytes = file.size;
        mimeType = file.type || "application/octet-stream";

        try {
            const cloudinaryResult = await uploadToCloudinary(file, `dentigo/diagnosis/${patientId}`);
            if (cloudinaryResult) {
                fileUrl = cloudinaryResult.secure_url;
                publicId = cloudinaryResult.public_id;
                storageProvider = "cloudinary";
            }
        } catch (err) {
            console.warn("Cloudinary update upload issue, fallback to Data URL:", err);
        }

        if (!cloudinaryResultMatches(fileUrl, existingFileUrl)) {
            fileUrl = await readFileAsDataUrl(file);
            storageProvider = "local";
        }
    }

    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "diagnosisReports", id), {
        patientId,
        doctorId,
        appointmentId,
        reportType,
        title,
        toothNumber: toothNumber || "",
        clinicalNotes: clinicalNotes || "",
        fileUrl,
        publicId,
        storageProvider,
        fileName,
        fileSizeBytes,
        mimeType,
        reportDate: reportDate || new Date().toISOString().slice(0, 10),
        fee: fee || 0,
        updatedAt: Date.now()
    });
}

function cloudinaryResultMatches(url: string, oldUrl: string) {
    return url && url !== oldUrl && url.startsWith("http");
}

/**
 * Deletes report document from Firestore.
 */
export async function deleteDiagnosisReport(report: DiagnosisReport): Promise<void> {
    await deleteDoc(doc(db, "diagnosisReports", report.id));
}


/**
 * Format bytes to human readable format (e.g., 2.4 MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
