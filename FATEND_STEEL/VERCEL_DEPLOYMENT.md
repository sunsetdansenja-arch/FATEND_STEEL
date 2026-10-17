# Deploy CV FATEND STEEL frontend to Vercel using the client's existing backend

## Target architecture

- **Vercel** hosts the frontend build from Vite.
- **The client's existing Google Cloud Run service** continues to provide the API, including `/api/scan-receipt`, Gemini calls, and the Tesseract OCR fallback:
  `https://ais-pre-inb2ttctfdazzr5xwoejf6-571568638799.asia-southeast1.run.app`
- **Firebase Cloud Firestore** remains the single primary database. Do not create a new Firebase project/database or migrate data.
- Google AI Studio / the existing Cloud Run app remains in place; this deployment only adds a Vercel frontend.

## 1. Configure Vercel

The actual app is inside `FATEND_STEEL/`. Set Vercel's **Root Directory** to `FATEND_STEEL`.

- Framework preset: Vite
- Build command: `npm run build:frontend`
- Output directory: `dist`
- Install command: `npm install` (or leave Vercel's automatic setting)

The `vercel.json` rewrites requests under `/api/*` to the existing Cloud Run service. Keep `VITE_API_BASE_URL` **unset** so the browser calls the same-origin Vercel path and Vercel proxies the request to Cloud Run. This avoids needing to redeploy the client's backend just to configure browser CORS.

Do not put API keys or other secrets in Vercel frontend environment variables. The existing backend is responsible for Gemini calls and its server-side API key.

## 2. Existing API and receipt scanning

The existing Cloud Run URL responds successfully, and `GET /api/health` reports status `ok` and that a Gemini key is configured. That confirms the API service is alive, but it does not by itself prove receipt scanning and OCR fallback work end to end.

After Vercel deployment:
1. Open the Vercel URL and verify `/api/health` returns the existing API health response through the rewrite.
2. Test scanning a disposable sample receipt.
3. Confirm the Gemini path and OCR fallback work if Gemini is unavailable.

No new Cloud Run service or backend deployment should be needed unless these tests reveal that the existing service does not support the required API route.

## 3. Database consistency — do not migrate

The browser app reads `firebase-applet-config.json` and uses the configured Firebase project and named Firestore database. The primary state is stored at:
- Collection: `workshop_data`
- Document: `main_state`

Keep the existing Firebase configuration unchanged. Do not initialize a new Firebase project or change `firestoreDatabaseId`. If Firebase Authentication reports an authorized-domain error, the client may need to add the Vercel domain to the existing Firebase project's authorized domains; this is a Firebase console task, not a code change.

The Google Drive backup feature is separate and does not replace Firestore as the primary database.

## 4. Production security blocker

The current `firestore.rules` grants public read and write access to every document. Workshop projects, inventory, cashflow, worker/loan information, and receipt data may therefore be exposed or modified by anyone who can reach the database.

Do **not** treat this setup as production-safe until Firestore rules are restricted to the actual authorized owner(s). The app currently signs in anonymously for database sync, and an in-app PIN is not a substitute for Firestore authorization. Tightening these rules safely requires the client to decide the actual authorization model; do not change them blindly because that can lock the app out.

## 5. Verification still required

Repository configuration is not the same as a verified deployment. Before handing it to the client:
1. Confirm a clean Vercel frontend build.
2. Confirm the Vercel `/api/health` rewrite reaches the existing Cloud Run API.
3. Scan a test receipt.
4. Verify data syncs across the AI Studio app and Vercel app from the same Firestore database.
5. Secure Firestore rules before using real business data.
