import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Project,
  InventoryItem,
  StockMutation,
  ReceiptScan,
  KasbonWorker,
  CashflowRecord,
  PinConfig,
  DailyCashRecord,
} from '../types';

// Generate unique runtime instance ID for this session/tab execution
// (We avoid persistent sessionStorage so a reload is recognized as a fresh instance that must pull server state)
const RUNTIME_CLIENT_ID = 'inst_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

export function getClientId(): string {
  return RUNTIME_CLIENT_ID;
}

export function getDeviceId(): string {
  return RUNTIME_CLIENT_ID;
}

export interface WorkshopCloudData {
  projects: Project[];
  inventory: InventoryItem[];
  mutations: StockMutation[];
  receipts: ReceiptScan[];
  workers: KasbonWorker[];
  cashflow: CashflowRecord[];
  pinConfig: PinConfig;
  dailyCash?: DailyCashRecord[];
  deletedDailyCashIds?: string[];
  deletedProjectIds?: string[];
  deletedInventoryIds?: string[];
  deletedSubItemIds?: string[];
  updatedAt: number;
  updatedBy: string;
}

const COLLECTION_NAME = 'workshop_data';
const MAIN_DOC_ID = 'main_state';

let isRemoteSyncInProgress = false;
let lastLocalPushTimestamp = 0;

export function getIsRemoteSyncInProgress(): boolean {
  return isRemoteSyncInProgress;
}

/**
 * Save complete or partial workshop state to Firestore Cloud Database
 */
export async function pushToCloud(data: Partial<WorkshopCloudData>): Promise<boolean> {
  try {
    lastLocalPushTimestamp = Date.now();
    const docRef = doc(db, COLLECTION_NAME, MAIN_DOC_ID);
    
    // Safety sanitize receipts to avoid payload bloat & Firestore 1MB limits
    const safeData = { ...data };
    if (Array.isArray(safeData.receipts)) {
      safeData.receipts = safeData.receipts.map((r) => {
        if (r.imageBase64 && r.imageBase64.length > 400000) {
          const { imageBase64, ...rest } = r;
          return rest;
        }
        return r;
      });
    }

    const writePromise = setDoc(
      docRef,
      {
        ...safeData,
        updatedAt: Date.now(),
        updatedBy: RUNTIME_CLIENT_ID,
      },
      { merge: true }
    );

    // Timeout after 6 seconds so UI operations never stall
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Cloud push timeout')), 6000)
    );

    await Promise.race([writePromise, timeoutPromise]);
    return true;
  } catch (err) {
    console.warn('Failed to push data to cloud (will retry on next activity):', err);
    return false;
  }
}

/**
 * Fetch complete workshop state once from Cloud
 */
export async function pullFromCloud(): Promise<WorkshopCloudData | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, MAIN_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as WorkshopCloudData;
    }
    return null;
  } catch (err) {
    console.error('Failed to pull data from cloud:', err);
    return null;
  }
}

/**
 * Subscribe to real-time changes from other PCs/devices
 */
export function subscribeToCloudChanges(
  onRemoteUpdate: (data: WorkshopCloudData) => void,
  onStatusChange?: (status: 'connected' | 'connecting' | 'error') => void
): Unsubscribe {
  const docRef = doc(db, COLLECTION_NAME, MAIN_DOC_ID);

  if (onStatusChange) onStatusChange('connecting');

  let isFirstSnapshot = true;

  const unsubscribe = onSnapshot(
    docRef,
    (snapshot) => {
      if (onStatusChange) onStatusChange('connected');
      if (!snapshot.exists()) {
        isFirstSnapshot = false;
        return;
      }

      const remoteData = snapshot.data() as WorkshopCloudData;

      // CRITICAL: Always accept the initial snapshot on page boot/refresh!
      // For subsequent snapshots, only ignore if this exact client instance pushed it within the last 2.5 seconds
      if (!isFirstSnapshot) {
        if (remoteData.updatedBy === RUNTIME_CLIENT_ID && Date.now() - lastLocalPushTimestamp < 2500) {
          return;
        }
      }
      isFirstSnapshot = false;

      try {
        isRemoteSyncInProgress = true;
        onRemoteUpdate(remoteData);
      } finally {
        setTimeout(() => {
          isRemoteSyncInProgress = false;
        }, 150);
      }
    },
    (err) => {
      console.warn('Real-time cloud listener notice:', err);
      if (onStatusChange) onStatusChange('error');
    }
  );

  return unsubscribe;
}
