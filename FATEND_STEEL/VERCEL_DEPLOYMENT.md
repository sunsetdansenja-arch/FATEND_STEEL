# Deploy CV FATEND STEEL: Vercel frontend + Google Cloud Run API

## Target architecture

- **Vercel** hosts the frontend build from Vite.
- **Google Cloud Run** runs the existing Express API, including `/api/scan-receipt`, Gemini calls, and the Tesseract OCR fallback.
- **Firebase Cloud Firestore** remains the single primary database. Do not create a new Firebase project/database for the Vercel deployment.
- Google AI Studio remains useful as the development/share environment, but do not assume its shared-app URL is a stable API endpoint for an independently hosted Vercel frontend.

## 1. Deploy the frontend to Vercel

The actual app is inside `FATEND_STEEL/`. Set Vercel's **Root Directory** to `FATEND_STEEL`.

- Framework preset: Vite
- Build command: `npm run build:frontend`
- Output directory: `dist`
- Install command: `npm install` (or leave Vercel's automatic setting)
- Environment variable: `VITE_API_BASE_URL` = the HTTPS base URL of the deployed Cloud Run service, without a trailing slash

Redeploy after setting or changing environment variables. Vite variables prefixed with `VITE_` are public frontend configuration; never put secret API keys in them.

## 2. Deploy the API to Google Cloud Run

Use `FATEND_STEEL/` as the build context so Cloud Run can see the included `Dockerfile`.

Configure these Cloud Run environment variables:
- `GEMINI_API_KEY` = private Gemini API key, configured as a secret where possible
- `FRONTEND_ORIGINS` = comma-separated exact browser origins allowed to call the API, for example `https://your-app.vercel.app`

If the existing Google AI Studio app should continue to call this API, add its exact browser origin to `FRONTEND_ORIGINS` as well, but only if you can confirm that origin. Do not use a wildcard in production.

The API's health check is `GET /api/health`. After deployment, test that endpoint and test both Gemini receipt scanning and the Tesseract OCR fallback. Cloud Run provides a persistent service runtime better suited to this Express API and OCR fallback than Vercel's serverless function limits.

## 3. Database consistency — do not migrate

The browser app reads `firebase-applet-config.json` and uses the configured Firebase project and named Firestore database. The primary state is stored at:
- Collection: `workshop_data`
- Document: `main_state`

The Vercel frontend must keep using this same Firebase configuration. Do not initialize a new Firebase project or change `firestoreDatabaseId` during deployment. Add the Vercel domain to Firebase Authentication's authorized domains if Firebase sign-in reports an authorized-domain error.

The Google Drive backup feature is separate and does not replace Firestore as the primary database.

## 4. Production security blocker

The current `firestore.rules` grants public read and write access to every document. Workshop projects, inventory, cashflow, worker/loan information, and receipt data may therefore be exposed or modified by anyone who can reach the database.

Do **not** treat this setup as production-safe until Firestore rules are restricted to the actual authorized owner(s). The app currently signs in anonymously for database sync, and an in-app PIN is not a substitute for Firestore authorization. Decide which Google account(s) are allowed to use the app, then implement and test owner-only authorization before tightening rules. Do not change the rules blindly because that can lock the app out.

## 5. Verification still required

Repository configuration changes do not prove the deployment works. Before handing it to the client:
1. Confirm a clean Vercel frontend build.
2. Confirm Cloud Run starts and `/api/health` responds.
3. Scan a test receipt with Gemini.
4. Test the OCR fallback.
5. Open the app on two devices and verify that updates appear in both from the same Firestore database.
6. Secure Firestore rules before entering real business data.
