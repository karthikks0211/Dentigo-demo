import * as functions from "firebase-functions";
import admin from "firebase-admin";

if (!admin.apps.length) {
    admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();

/**
 * Callable Cloud Function: linkPatientAccount
 * Finds John's record in `patients` collection (or matching patientId),
 * creates a Firebase Auth user (john@patient.com + temp password), and
 * sets custom claim { role: "patient", patientId: "<John's real doc ID>" }.
 * Does NOT create a new patient record.
 */
export const linkPatientAccount = functions.https.onCall(async (data: any, context: any) => {
    const targetPatientId = data?.patientId || "pat-john";
    const patientDocRef = db.collection("patients").doc(targetPatientId);
    const patientSnap = await patientDocRef.get();

    if (!patientSnap.exists) {
        throw new functions.https.HttpsError(
            "not-found",
            `Patient document ${targetPatientId} does not exist in patients collection.`
        );
    }

    const patientData = patientSnap.data() || {};
    const email = data?.email || patientData.email || "john@patient.com";
    const tempPassword = data?.password || "Patient@123";

    let user: admin.auth.UserRecord;
    try {
        user = await auth.getUserByEmail(email);
    } catch (e: any) {
        if (e.code === "auth/user-not-found") {
            user = await auth.createUser({
                email,
                password: tempPassword,
                displayName: patientData.name || "John"
            });
        } else {
            throw new functions.https.HttpsError("internal", e.message);
        }
    }

    // Set custom claims: role='patient', patientId
    await auth.setCustomUserClaims(user.uid, {
        role: "patient",
        patientId: targetPatientId
    });

    return {
        success: true,
        uid: user.uid,
        email: user.email,
        role: "patient",
        patientId: targetPatientId
    };
});

/**
 * Callable Cloud Function: createDoctorLogin
 * Finds Dr. Strange's record in `doctors` collection (or matching doctorId),
 * creates a Firebase Auth user (dr.strange@clinic.com + temp password), and
 * sets custom claim { role: "doctor", doctorId: "<Dr. Strange's real doc ID>" }.
 * Admin-only check.
 */
export const createDoctorLogin = functions.https.onCall(async (data: any, context: any) => {
    // Admin check: ensure caller has admin claim or staff email
    const callerEmail = context?.auth?.token?.email;
    const isCallerAdmin = context?.auth?.token?.role === "admin" || callerEmail === "admin@dentigo.dev";

    if (!isCallerAdmin) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Only administrators can create doctor logins."
        );
    }

    const targetDoctorId = data?.doctorId || "doc-strange";
    const doctorDocRef = db.collection("doctors").doc(targetDoctorId);
    const doctorSnap = await doctorDocRef.get();

    if (!doctorSnap.exists) {
        throw new functions.https.HttpsError(
            "not-found",
            `Doctor document ${targetDoctorId} does not exist in doctors collection.`
        );
    }

    const doctorData = doctorSnap.data() || {};
    const email = data?.email || doctorData.email || "dr.strange@clinic.com";
    const tempPassword = data?.password || "Doctor@123";

    let user: admin.auth.UserRecord;
    try {
        user = await auth.getUserByEmail(email);
    } catch (e: any) {
        if (e.code === "auth/user-not-found") {
            user = await auth.createUser({
                email,
                password: tempPassword,
                displayName: doctorData.name || "Dr. Stephen Strange"
            });
        } else {
            throw new functions.https.HttpsError("internal", e.message);
        }
    }

    // Set custom claims: role='doctor', doctorId
    await auth.setCustomUserClaims(user.uid, {
        role: "doctor",
        doctorId: targetDoctorId
    });

    return {
        success: true,
        uid: user.uid,
        email: user.email,
        role: "doctor",
        doctorId: targetDoctorId
    };
});



