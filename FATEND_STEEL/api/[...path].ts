import { app } from '../server';

// Vercel routes /api/* requests through this catch-all function.
// server.ts skips app.listen() in Vercel's serverless runtime.
export default app;
