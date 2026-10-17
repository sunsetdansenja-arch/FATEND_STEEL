import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Always pass the specific database ID from firebase-applet-config.json if present
const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = firestoreDbId
  ? getFirestore(app, firestoreDbId)
  : getFirestore(app);

// Ensure anonymous authentication for Firestore security
signInAnonymously(auth).catch((err) => {
  console.warn('Firebase anonymous sign-in error:', err);
});

export { app };
