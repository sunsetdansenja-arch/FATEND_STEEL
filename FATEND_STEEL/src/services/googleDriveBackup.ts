import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  Project,
  InventoryItem,
  StockMutation,
  DailyCashRecord,
  KasbonWorker,
  CashflowRecord,
  ReceiptScan,
  PinConfig,
} from '../types';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export interface WorkshopBackupPayload {
  version: string;
  appName: string;
  createdAt: string;
  createdTimestamp: number;
  stats: {
    projectCount: number;
    inventoryCount: number;
    mutationCount: number;
    dailyCashCount: number;
    workerCount: number;
    cashflowCount: number;
    receiptCount: number;
    dailyCashBalance: number;
  };
  data: {
    projects: Project[];
    inventory: InventoryItem[];
    mutations: StockMutation[];
    dailyCash: DailyCashRecord[];
    workers: KasbonWorker[];
    cashflow: CashflowRecord[];
    receipts: ReceiptScan[];
    pinConfig: PinConfig;
  };
}

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  description?: string;
}

// In-memory token cache (never stored in localStorage/sessionStorage as required)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

/**
 * Initialize Firebase Auth listener to maintain Google user state
 */
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && !user.isAnonymous) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token will be acquired via interactive popup sign-in
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Trigger official Google Sign-In with Google Drive scope
 */
export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

/**
 * Disconnect Google Drive
 */
export const signOutGoogle = async (): Promise<void> => {
  try {
    await signOut(auth);
  } finally {
    cachedAccessToken = null;
  }
};

export const getCachedGoogleToken = (): string | null => cachedAccessToken;

/**
 * Upload complete workshop backup directly to user's Google Drive
 */
export const uploadBackupToGoogleDrive = async (
  payload: WorkshopBackupPayload
): Promise<{ success: boolean; fileId?: string; fileName?: string; error?: string }> => {
  const token = cachedAccessToken;
  if (!token) {
    return { success: false, error: 'Belum terhubung ke Akun Google. Silakan masuk terlebih dahulu.' };
  }

  try {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `CV-FATEND-STEEL-BACKUP-${dateStr}-${timeStr}.json`;

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      description: `Cadangan Otomatis CV. FATEND STEEL | ${payload.stats.projectCount} Proyek, ${payload.stats.inventoryCount} Stok, ${payload.stats.dailyCashCount} Kas Harian`,
      properties: {
        app: 'fatend_steel_workshop',
        version: payload.version,
      },
    };

    const fileContent = JSON.stringify(payload, null, 2);

    // Multipart upload to Google Drive REST API v3
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      closeDelimiter;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `Gagal mengunggah ke Google Drive (Status ${res.status})`);
    }

    const createdFile = await res.json();
    return {
      success: true,
      fileId: createdFile.id,
      fileName,
    };
  } catch (error: any) {
    console.error('uploadBackupToGoogleDrive error:', error);
    return { success: false, error: error?.message || 'Terjadi kesalahan saat mengunggah cadangan ke Google Drive' };
  }
};

/**
 * List all CV Fatend Steel backup files available in user's Google Drive
 */
export const listGoogleDriveBackups = async (): Promise<DriveBackupFile[]> => {
  const token = cachedAccessToken;
  if (!token) return [];

  try {
    const q = encodeURIComponent("name contains 'CV-FATEND-STEEL-BACKUP' and trashed = false");
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=20&fields=files(id,name,createdTime,size,description)`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.files || []) as DriveBackupFile[];
  } catch (error) {
    console.error('listGoogleDriveBackups error:', error);
    return [];
  }
};

/**
 * Download and parse a backup file from Google Drive
 */
export const downloadBackupFromGoogleDrive = async (
  fileId: string
): Promise<{ success: boolean; data?: WorkshopBackupPayload; error?: string }> => {
  const token = cachedAccessToken;
  if (!token) {
    return { success: false, error: 'Token autentikasi Google tidak tersedia. Silakan gunakan tombol Impor File .json di bawah jika login Google dibatasi.' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Gagal mengunduh file cadangan dari Google Drive (Status ${res.status})`);
    }

    const json = (await res.json()) as WorkshopBackupPayload;
    if (!json || (!json.data && !(json as any).projects)) {
      throw new Error('Format file cadangan tidak valid atau rusak.');
    }

    return { success: true, data: json };
  } catch (error: any) {
    console.error('downloadBackupFromGoogleDrive error:', error);
    if (error.name === 'AbortError') {
      return { success: false, error: 'Koneksi ke Google Drive timeout (terlalu lama). Silakan gunakan tombol Impor File .json.' };
    }
    return { success: false, error: error?.message || 'Gagal membaca isi file cadangan dari Google Drive' };
  }
};

/**
 * Delete a specific backup file from Google Drive with mandatory user confirmation
 */
export const deleteGoogleDriveBackup = async (
  fileId: string,
  fileName: string
): Promise<boolean> => {
  const token = cachedAccessToken;
  if (!token) return false;

  const confirmed = window.confirm(
    `Apakah Anda yakin ingin menghapus file cadangan "${fileName}" dari Google Drive Anda? Tindakan ini tidak dapat dibatalkan.`
  );
  if (!confirmed) return false;

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch (error) {
    console.error('deleteGoogleDriveBackup error:', error);
    return false;
  }
};
