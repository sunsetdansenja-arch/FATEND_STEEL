# Deploy CV FATEND STEEL to Vercel

## Vercel project settings

The actual app is inside the `FATEND_STEEL/` directory in this repository. Set Vercel's **Root Directory** to `FATEND_STEEL` (not the repository root).

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install` (or leave Vercel's automatic setting)
- Environment variable: `GEMINI_API_KEY` = your private Gemini API key

Redeploy after changing environment variables. Do not commit a real API key or a `.env.local` file.

## API routes

The `api/[...path].ts` function exposes the existing Express API under `/api/*`, including:

- `GET /api/health`
- `POST /api/scan-receipt`

The regular local development server remains available through `npm run dev`. On Vercel, `server.ts` exports the Express app without starting a persistent listener.

## Database destination

The browser app uses Firebase Cloud Firestore. It reads the project and named database from `firebase-applet-config.json`, then stores the main workshop state at collection `workshop_data`, document `main_state`. Google Drive backup is a separate optional feature that saves backup JSON files to the signed-in user's Google Drive; it is not the primary database.

## Production security blocker — do not ignore

The current `firestore.rules` file grants public read and write access to every document. Workshop projects, inventory, cashflow, worker/loan information, and receipt data may therefore be exposed or modified by anyone who can reach the database.

Do **not** treat this deployment as production-safe until Firestore rules are restricted to the actual authorized owner(s). The app currently signs in anonymously for database sync, and an in-app PIN is not a substitute for Firestore authorization. A correct owner-only rule requires deciding how the owner identity will be authenticated/authorized; changing the rules blindly could either leave the database exposed or lock the app out.

## Runtime caveat

The scan endpoint can call Gemini and falls back to Tesseract OCR. Vercel Functions have request-size and execution-time limits, and OCR model downloads/runtime behavior differ from a persistent server. Test both Gemini scanning and OCR fallback after deployment. If Tesseract exceeds Vercel limits, keep the frontend and API on Vercel but replace the OCR fallback with a compatible implementation or a separately hosted OCR service.
