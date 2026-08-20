# DentiGO

A dental clinic operations platform — appointments, prescriptions, a real FEFO pharmacy inventory system, and billing — built as a single-login demo product. One account (`admin@dentigo.dev`) has full access to every part of the app.

**Stack:** Next.js 16 (App Router) + React 19, Firebase (Auth + Firestore, client SDK only — nothing to host or run yourself), deployed on Vercel.

## 1. Local setup

```bash
nvm use            # pins to Node 20 via .nvmrc
npm install
```

### Firebase project

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Build → Authentication → Get started** → enable the **Email/Password** sign-in method.
3. **Build → Firestore Database → Create database** → start in test mode (see [Security rules](#4-security-rules) below before going further than a demo).
5. Copy `.env.example` to `.env.local` and fill in the six `NEXT_PUBLIC_FIREBASE_*` values.
6. *(Optional)* For cloud-hosted document & diagnostic scan uploads, create a free account at [cloudinary.com](https://cloudinary.com), create an unsigned upload preset (Settings → Upload → Add upload preset), and fill in `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`. (If omitted, a zero-config base64 local fallback is used automatically).


### Seed data

```bash
npm run seed
```

Creates the one demo login (`admin@dentigo.dev` / `Dentigo@123`) plus a full sample dataset — doctors with weekly availability, patients, appointments in every status, prescriptions, 12 medicines with batches spanning healthy/near-expiry/low-stock/out-of-stock, suppliers, purchase orders, stock transactions, invoices, payments, and returns — so every page has real content immediately.

This script is safe to re-run any time; it overwrites the same deterministic set of documents rather than duplicating data. Anything you create by hand while exploring the app (new doctors, appointments, invoices, etc.) is untouched by re-seeding — Firebase console → Firestore Database is the place to delete those manually if you want a fully clean slate again.

```bash
npm run dev         # http://localhost:3000
```

## 2. The demo script

Log in once as `admin@dentigo.dev`, then click straight through:

1. **Doctors** → set a doctor's weekly availability (this generates their bookable slots).
2. **Book Appointment** → 3-step wizard: doctor → time slot → confirm.
3. **Invoices → Create Invoice** → generate a consultation invoice from that appointment.
4. **Invoices → Payments** → record a cash/card payment, or try **Pay via Razorpay** for the simulated checkout.
5. **Prescriptions** → write a prescription for the patient.
6. **Prescriptions → Dispense** → this is the FEFO moment: the preview shows exactly which batch (soonest-expiring first) will be deducted, and confirming it atomically updates stock, logs the transaction, and generates a pharmacy invoice.
7. **Ledger** and **Reports** → confirm both payments show up, with revenue correctly attributed by doctor.

The floating **DentiGO Assistant** button (bottom-right) surfaces rule-based alerts — near-expiry batches and low/out-of-stock medicines — computed live from Firestore, no external AI API involved.

## 3. Deploying to Vercel

Two ways in — pick whichever you're more comfortable with.

### Option A: GitHub → Vercel (recommended — auto-deploys on every push)

1. Push this repo to GitHub if it isn't already:
   ```bash
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) → sign in (GitHub login is easiest) → **Add New → Project**.
3. Import the repo. Vercel auto-detects Next.js — leave the build settings as default.
4. Before clicking Deploy, expand **Environment Variables** and add all six from `.env.local`:
   `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
5. Click **Deploy**. Takes about a minute.

### Option B: Vercel CLI (no GitHub needed)

```bash
npm install -g vercel
vercel login
vercel                 # deploys a preview URL, prompts to link/create the project
vercel --prod          # promotes to your production URL
```

The CLI asks for env vars on first run, or set them after with `vercel env add` (once per variable) — same six keys as above.

### Critical last step: authorize the domain in Firebase

Firebase Auth blocks sign-in from any domain not on its allowlist — your deployed Vercel URL will fail to log in until you add it:

**Firebase console → Authentication → Settings → Authorized domains → Add domain** → paste your Vercel URL (e.g. `dentigo.vercel.app`). Do this for both the `*.vercel.app` preview domain and your production domain if you add a custom one later.

That's the whole deployment — this is a fully static/client-rendered app, so there's nothing server-side to provision beyond those env vars and the Firebase domain allowlist.

## 4. Security rules

The Firestore rules in `firestore.rules` require `request.auth != null` for every read/write (no anonymous access) — appropriate for a single-login demo. Deploy them once you have the [Firebase CLI](https://firebase.google.com/docs/cli):

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # pick your project
firebase deploy --only firestore:rules
```

Until you do this, a freshly created Firestore database in "test mode" allows open read/write to anyone with your project ID — fine while building, not fine to leave in place indefinitely.

## 5. What's next

Mobile app support (Expo/React Native against this same Firebase backend) is a separate phase, scoped once the web app above is stable.
