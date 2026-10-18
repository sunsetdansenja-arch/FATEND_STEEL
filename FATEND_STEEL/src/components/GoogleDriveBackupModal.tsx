import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  signInWithGoogle,
  signOutGoogle,
  uploadBackupToGoogleDrive,
  listGoogleDriveBackups,
  downloadBackupFromGoogleDrive,
  deleteGoogleDriveBackup,
  getCachedGoogleToken,
  DriveBackupFile,
  WorkshopBackupPayload,
} from '../services/googleDriveBackup';
import { formatIDR, formatDate } from '../utils/formatters';
import {
  Cloud,
  HardDrive,
  UploadCloud,
  DownloadCloud,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  X,
  FileText,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Database,
  Calendar,
  LogOut,
  RefreshCw,
  FileDown,
  FileUp,
  Share2,
} from 'lucide-react';
import { User } from 'firebase/auth';

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleDriveBackupModal: React.FC<GoogleDriveBackupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    projects,
    inventory,
    mutations,
    dailyCashRecords,
    workers,
    cashflow,
    receipts,
    pinConfig,
    forceUploadToCloud,
    importMasterPayload,
  } = useApp();

  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    return localStorage.getItem('fatend_last_drive_backup_time');
  });

  // In-modal Staged Import confirmation state (avoids blocked window.confirm/alert)
  const [stagedImport, setStagedImport] = useState<{
    source: 'FILE' | 'DRIVE';
    fileName: string;
    payload: any;
    stats: {
      projectCount: number;
      inventoryCount: number;
      mutationCount: number;
      dailyCashCount: number;
      workerCount: number;
      cashflowCount: number;
    };
  } | null>(null);

  // Calculate current dataset stats
  const totalDailyCashBalance = dailyCashRecords
    .filter((r) => r.type === 'MASUK')
    .reduce((s, r) => s + r.amount, 0) -
    dailyCashRecords
      .filter((r) => r.type === 'KELUAR')
      .reduce((s, r) => s + r.amount, 0);

  // Check initial token status
  useEffect(() => {
    if (isOpen) {
      const token = getCachedGoogleToken();
      if (token) {
        loadBackups();
      }
    }
  }, [isOpen]);

  const loadBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const files = await listGoogleDriveBackups();
      setDriveBackups(files);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setNotice({ text: 'Menghubungkan ke Akun Google...', type: 'info' });
      const { user } = await signInWithGoogle();
      setGoogleUser(user);
      setNotice({
        text: `Terhubung dengan akun Google: ${user.email}. Siap mencadangkan data ke Google Drive.`,
        type: 'success',
      });
      loadBackups();
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      setNotice({
        text: err?.message || 'Gagal masuk dengan akun Google. Pastikan popup tidak diblokir.',
        type: 'error',
      });
    }
  };

  const handleGoogleLogout = async () => {
    await signOutGoogle();
    setGoogleUser(null);
    setDriveBackups([]);
    setNotice({ text: 'Koneksi Akun Google telah diputus.', type: 'info' });
  };

  const buildBackupPayload = (): WorkshopBackupPayload => {
    const now = new Date();
    return {
      version: '2.0',
      appName: 'CV. FATEND JAYA TEKNIK SINERGI (CV FATEND STEEL)',
      createdAt: now.toISOString(),
      createdTimestamp: now.getTime(),
      stats: {
        projectCount: projects.length,
        inventoryCount: inventory.length,
        mutationCount: mutations.length,
        dailyCashCount: dailyCashRecords.length,
        workerCount: workers.length,
        cashflowCount: cashflow.length,
        receiptCount: receipts.length,
        dailyCashBalance: totalDailyCashBalance,
      },
      data: {
        projects,
        inventory,
        mutations,
        dailyCash: dailyCashRecords,
        workers,
        cashflow,
        receipts,
        pinConfig,
      },
    };
  };

  const handleBackupToDrive = async () => {
    const token = getCachedGoogleToken();
    if (!token) {
      await handleGoogleLogin();
      return;
    }

    setIsBackingUp(true);
    setNotice({ text: 'Sedang membuat dan mengunggah paket cadangan ke Google Drive...', type: 'info' });

    try {
      const payload = buildBackupPayload();
      const res = await uploadBackupToGoogleDrive(payload);

      if (res.success) {
        const timeNow = new Date().toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        setLastBackupTime(timeNow);
        localStorage.setItem('fatend_last_drive_backup_time', timeNow);

        setNotice({
          text: `✅ Sukses mencadangkan ke Google Drive! (${payload.stats.projectCount} Proyek, ${payload.stats.inventoryCount} Stok, ${payload.stats.dailyCashCount} Kas Harian tersimpan aman).`,
          type: 'success',
        });
        loadBackups();
      } else {
        setNotice({
          text: res.error || 'Gagal mengunggah cadangan ke Google Drive.',
          type: 'error',
        });
      }
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFromDrive = async (file: DriveBackupFile) => {
    setIsRestoring(true);
    setNotice({ text: `Mengunduh file "${file.name}" dari Google Drive...`, type: 'info' });

    try {
      const res = await downloadBackupFromGoogleDrive(file.id);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Gagal membaca data cadangan');
      }

      const backup = res.data;
      const data: any = (backup as any).data || backup;

      const projectCount = Array.isArray(data.projects) ? data.projects.length : 0;
      const inventoryCount = Array.isArray(data.inventory) ? data.inventory.length : 0;
      const mutationCount = Array.isArray(data.mutations) ? data.mutations.length : 0;
      const dailyCashCount = Array.isArray(data.dailyCash) ? data.dailyCash.length : 0;
      const workerCount = Array.isArray(data.workers) ? data.workers.length : 0;
      const cashflowCount = Array.isArray(data.cashflow) ? data.cashflow.length : 0;

      setStagedImport({
        source: 'DRIVE',
        fileName: file.name,
        payload: data,
        stats: {
          projectCount,
          inventoryCount,
          mutationCount,
          dailyCashCount,
          workerCount,
          cashflowCount,
        },
      });

      setNotice({
        text: `File "${file.name}" berhasil diunduh dari Google Drive! Silakan periksa rincian data lalu klik "YA, PULIHKAN SEKARANG".`,
        type: 'info',
      });
    } catch (err: any) {
      console.error('Restore error:', err);
      setNotice({
        text: `Gagal membaca file dari Google Drive: ${err?.message || 'Error'}`,
        type: 'error',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackup = async (file: DriveBackupFile) => {
    const ok = await deleteGoogleDriveBackup(file.id, file.name);
    if (ok) {
      setNotice({ text: `File "${file.name}" berhasil dihapus dari Google Drive.`, type: 'info' });
      loadBackups();
    }
  };

  // Native Android/iOS/Browser Share to Drive or WhatsApp
  const handleNativeShare = async () => {
    const payload = buildBackupPayload();
    const str = JSON.stringify(payload, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `CV-FATEND-STEEL-CADANGAN-${dateStr}.json`;
    const file = new File([str], fileName, { type: 'application/json' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'Cadangan CV FATEND STEEL',
          text: `Cadangan Data Bengkel CV FATEND STEEL (${dateStr}): ${payload.stats.projectCount} Proyek, ${payload.stats.inventoryCount} Stok, ${payload.stats.dailyCashCount} Kas Harian.`,
          files: [file],
        });
        setNotice({
          text: '✅ File cadangan siap disimpan ke Google Drive atau dikirim ke WhatsApp!',
          type: 'success',
        });
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Share error:', err);
        }
      }
    }
    // Fallback if native file share isn't supported on device
    handleDownloadLocalJson();
  };

  // Local JSON Download
  const handleDownloadLocalJson = () => {
    const payload = buildBackupPayload();
    const str = JSON.stringify(payload, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `CV-FATEND-STEEL-CADANGAN-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice({
      text: 'File cadangan (.json) berhasil diunduh ke komputer/HP Anda!',
      type: 'success',
    });
  };

  // Local JSON Restore File Input (With robust decoding, BOM stripping, alias normalization)
  const handleUploadLocalJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNotice({ text: `Membaca file "${file.name}"...`, type: 'info' });

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let content = (event.target?.result as string) || '';
        // 1. Strip UTF-8 BOM if present
        content = content.replace(/^\uFEFF/, '').trim();

        // 2. Remove markdown code blocks if file was copied with ```json ... ```
        if (content.startsWith('```')) {
          content = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        }

        if (!content) {
          throw new Error('File cadangan kosong (0 byte).');
        }

        let parsed: any;
        try {
          parsed = JSON.parse(content);
        } catch {
          throw new Error('Format file bukan JSON yang valid. Pastikan file tidak rusak.');
        }

        // If JSON was double stringified
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            // keep as-is
          }
        }

        // Extract nested container if wrapped
        let raw = parsed?.data || parsed?.workshopData || parsed?.fatend_workshop_data || parsed?.payload || parsed;

        // If raw is an array of projects directly
        if (Array.isArray(raw)) {
          raw = { projects: raw };
        }

        if (!raw || typeof raw !== 'object') {
          throw new Error('Isi file cadangan tidak memuat objek data bengkel yang dapat dibaca.');
        }

        // Normalize keys (English & Indonesian aliases)
        const normalizedProjects = Array.isArray(raw.projects)
          ? raw.projects
          : Array.isArray(raw.proyek)
          ? raw.proyek
          : Array.isArray(raw.fatend_projects)
          ? raw.fatend_projects
          : [];

        const normalizedInventory = Array.isArray(raw.inventory)
          ? raw.inventory
          : Array.isArray(raw.stok)
          ? raw.stok
          : Array.isArray(raw.items)
          ? raw.items
          : Array.isArray(raw.fatend_inventory)
          ? raw.fatend_inventory
          : [];

        const normalizedMutations = Array.isArray(raw.mutations)
          ? raw.mutations
          : Array.isArray(raw.mutasi)
          ? raw.mutasi
          : Array.isArray(raw.fatend_mutations)
          ? raw.fatend_mutations
          : [];

        const normalizedDailyCash = Array.isArray(raw.dailyCash)
          ? raw.dailyCash
          : Array.isArray(raw.daily_cash)
          ? raw.daily_cash
          : Array.isArray(raw.kas)
          ? raw.kas
          : Array.isArray(raw.fatend_daily_cash)
          ? raw.fatend_daily_cash
          : [];

        const normalizedWorkers = Array.isArray(raw.workers)
          ? raw.workers
          : Array.isArray(raw.tukang)
          ? raw.tukang
          : Array.isArray(raw.fatend_workers)
          ? raw.fatend_workers
          : [];

        const normalizedCashflow = Array.isArray(raw.cashflow)
          ? raw.cashflow
          : Array.isArray(raw.kasflow)
          ? raw.kasflow
          : Array.isArray(raw.fatend_cashflow)
          ? raw.fatend_cashflow
          : [];

        const normalizedReceipts = Array.isArray(raw.receipts)
          ? raw.receipts
          : Array.isArray(raw.nota)
          ? raw.nota
          : Array.isArray(raw.fatend_receipts)
          ? raw.fatend_receipts
          : [];

        const projectCount = normalizedProjects.length;
        const inventoryCount = normalizedInventory.length;
        const mutationCount = normalizedMutations.length;
        const dailyCashCount = normalizedDailyCash.length;
        const workerCount = normalizedWorkers.length;
        const cashflowCount = normalizedCashflow.length;
        const receiptCount = normalizedReceipts.length;

        const totalItemsCount =
          projectCount + inventoryCount + mutationCount + dailyCashCount + workerCount + cashflowCount + receiptCount;

        if (totalItemsCount === 0 && !raw.pinConfig) {
          throw new Error('File JSON ini tidak memuat satupun data bengkel (0 proyek, 0 stok, 0 kas).');
        }

        const normalizedPayload = {
          projects: normalizedProjects,
          inventory: normalizedInventory,
          mutations: normalizedMutations,
          dailyCash: normalizedDailyCash,
          workers: normalizedWorkers,
          cashflow: normalizedCashflow,
          receipts: normalizedReceipts,
          pinConfig: raw.pinConfig,
        };

        setStagedImport({
          source: 'FILE',
          fileName: file.name,
          payload: normalizedPayload,
          stats: {
            projectCount,
            inventoryCount,
            mutationCount,
            dailyCashCount,
            workerCount,
            cashflowCount,
          },
        });

        setNotice({
          text: `File "${file.name}" berhasil dibaca! (${projectCount} Proyek, ${inventoryCount} Stok, ${dailyCashCount} Kas). Klik tombol hijau di bawah untuk memulihkan.`,
          type: 'info',
        });
      } catch (err: any) {
        setNotice({
          text: `Gagal membaca file: ${err?.message || 'Format tidak valid'}`,
          type: 'error',
        });
      }
    };

    reader.onerror = () => {
      setNotice({ text: 'Gagal membuka file dari perangkat Anda.', type: 'error' });
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteRestore = async () => {
    if (!stagedImport) return;
    setIsRestoring(true);
    setNotice({ text: 'Sedang menerapkan pemulihan data ke sistem dan menyelaraskan ke Cloud...', type: 'info' });

    try {
      const res = await importMasterPayload(stagedImport.payload);
      setNotice({
        text: `🎉 SUKSES 100%! Data berhasil dipulihkan: ${res.projectCount} Proyek Aktif, ${res.stockCount} Item Stok, ${res.mutationCount} Mutasi, dan ${res.dailyCashCount} Transaksi Kas Harian. Seluruh data telah aktif seketika dan tersinkronkan ke Cloud!`,
        type: 'success',
      });
      setStagedImport(null);
    } catch (err: any) {
      setNotice({
        text: `Gagal memulihkan: ${err?.message || 'Terjadi kesalahan sistem'}`,
        type: 'error',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = !!googleUser || !!getCachedGoogleToken();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#13151b] border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#1c1e27] via-[#161821] to-[#12141a] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-industrial text-base sm:text-lg font-bold text-white tracking-wide">
                  Cadangkan ke Google Drive
                </h3>
                <span className="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Seperti WhatsApp
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Amankan 100% data bengkel ke akun Google Drive pribadi Anda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Notification Toast */}
          {notice && (
            <div
              className={`p-3 rounded-xl border font-medium flex items-center justify-between gap-2 ${
                notice.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                  : notice.type === 'error'
                  ? 'bg-rose-950/70 border-rose-500/50 text-rose-300'
                  : 'bg-amber-950/70 border-amber-500/50 text-amber-300'
              }`}
            >
              <span>{notice.text}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* In-Modal Staged Import Confirmation Card */}
          {stagedImport && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-950/80 via-zinc-900 to-zinc-950 border-2 border-amber-500/70 shadow-2xl space-y-3.5 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-amber-500/30">
                <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                  <Database className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>Konfirmasi Pemulihan Cadangan ({stagedImport.source === 'DRIVE' ? 'Google Drive' : 'File Lokal .json'})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStagedImport(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-zinc-300">
                  File Target: <strong className="text-white font-mono">{stagedImport.fileName}</strong>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                  Format Valid 100%
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-black/50 border border-amber-500/30">
                  <div className="text-base font-extrabold text-white">{stagedImport.stats.projectCount}</div>
                  <div className="text-[10px] text-zinc-400">Proyek</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/50 border border-amber-500/30">
                  <div className="text-base font-extrabold text-amber-400">{stagedImport.stats.inventoryCount}</div>
                  <div className="text-[10px] text-zinc-400">Stok</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/50 border border-amber-500/30">
                  <div className="text-base font-extrabold text-blue-400">{stagedImport.stats.mutationCount}</div>
                  <div className="text-[10px] text-zinc-400">Mutasi</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/50 border border-amber-500/30">
                  <div className="text-base font-extrabold text-emerald-400">{stagedImport.stats.dailyCashCount}</div>
                  <div className="text-[10px] text-zinc-400">Kas Harian</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/50 border border-amber-500/30">
                  <div className="text-base font-extrabold text-purple-400">{stagedImport.stats.workerCount}</div>
                  <div className="text-[10px] text-zinc-400">Pekerja</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/50 border border-amber-500/30">
                  <div className="text-base font-extrabold text-cyan-400">{stagedImport.stats.cashflowCount}</div>
                  <div className="text-[10px] text-zinc-400">Arus Kas</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200/90 leading-relaxed">
                ℹ️ Menekan tombol di bawah akan <strong>langsung menerapkan seluruh data</strong> ke aplikasi Anda dan <strong>menyelaraskannya secara otomatis ke Cloud Database</strong> tanpa perlu memuat ulang browser.
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={handleExecuteRestore}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-98 transition-all cursor-pointer disabled:opacity-60"
                >
                  <RotateCcw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                  <span>{isRestoring ? 'Sedang Memulihkan...' : '⚡ YA, PULIHKAN SELURUH DATA INI SEKARANG (100%)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStagedImport(null)}
                  className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* WhatsApp-Style Main Status Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1a1c24] to-[#121318] border border-zinc-700/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                <Cloud className="w-4 h-4 text-emerald-400" />
                <span>Status Cadangan Terakhir</span>
              </div>
              <span className="text-[11px] font-mono text-amber-400">
                {lastBackupTime ? lastBackupTime : 'Belum pernah dicadangkan'}
              </span>
            </div>

            {/* Live Data Summary to be backed up */}
            <div className="grid grid-cols-4 gap-2 text-center pt-1">
              <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <div className="text-base font-extrabold text-white">{projects.length}</div>
                <div className="text-[10px] text-zinc-400">Proyek Aktif</div>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <div className="text-base font-extrabold text-amber-400">{inventory.length}</div>
                <div className="text-[10px] text-zinc-400">Stok Barang</div>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <div className="text-base font-extrabold text-blue-400">{mutations.length}</div>
                <div className="text-[10px] text-zinc-400">Mutasi Stok</div>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <div className="text-base font-extrabold text-emerald-400">{dailyCashRecords.length}</div>
                <div className="text-[10px] text-zinc-400">Kas Harian</div>
              </div>
            </div>

            {/* Primary Action 1: Native Share to Drive / WhatsApp (Bypasses Google OAuth 403 Restrictions) */}
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm tracking-wide shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Share2 className="w-5 h-5 text-white" />
              <span>SIMPAN KE GOOGLE DRIVE / WHATSAPP (LEWAT HP)</span>
            </button>

            {/* Explanation Notice for Google Error 403 */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300">Catatan Error 403 Google:</strong> Jika saat login muncul pesan <em>"Error 403: Akses diblokir / Belum menyelesaikan proses verifikasi"</em>, itu karena Google membatasi aplikasi uji coba hanya untuk akun developer. 
                Gunakan tombol hijau di atas untuk menyimpan file cadangan langsung ke aplikasi <strong>Google Drive</strong> atau <strong>WhatsApp</strong> di HP Anda 100% tanpa error!
              </div>
            </div>

            {/* Google Account Connection (Optional Direct API) */}
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-black/30 p-3 rounded-xl border border-zinc-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.02h3.87c2.26-2.09 3.675-5.17 3.675-9.11z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.02c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.25v3.12C3.27 21.36 7.36 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.61H1.25C.45 8.24 0 10.06 0 12s.45 3.76 1.25 5.39l4.02-3.12z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.27 2.64 1.25 6.61l4.02 3.12c.95-2.85 3.6-4.98 6.73-4.98z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-white text-xs">
                    {googleUser?.displayName || 'Login API Google Drive (Developer)'}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {googleUser?.email || (isConnected ? 'Sudah Terhubung' : 'Khusus email terdaftar')}
                  </div>
                </div>
              </div>

              {isConnected ? (
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium flex items-center gap-1 self-start sm:self-auto"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Putus Akun</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold shadow transition-all flex items-center gap-1.5 self-start sm:self-auto border border-zinc-700"
                >
                  <span>Login Langsung</span>
                </button>
              )}
            </div>

            {/* Direct Drive API Backup Button if connected */}
            {isConnected && (
              <button
                type="button"
                disabled={isBackingUp}
                onClick={handleBackupToDrive}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
              >
                <UploadCloud className={`w-4 h-4 ${isBackingUp ? 'animate-bounce' : ''}`} />
                <span>{isBackingUp ? 'Sedang Mengunggah...' : 'Unggah ke Google Drive Otomatis (API)'}</span>
              </button>
            )}
          </div>

          {/* List of Backups Stored on User's Google Drive */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>Riwayat File Cadangan di Google Drive:</span>
              </span>
              {isConnected && (
                <button
                  type="button"
                  onClick={loadBackups}
                  disabled={isLoadingBackups}
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px]"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                  <span>Segarkan</span>
                </button>
              )}
            </div>

            {!isConnected ? (
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-dashed border-zinc-800 text-center space-y-1">
                <Cloud className="w-6 h-6 text-zinc-500 mx-auto" />
                <p className="text-zinc-300 font-semibold">Hubungkan Google Drive Anda</p>
                <p className="text-zinc-500 text-[11px]">
                  Klik tombol <strong>"CADANGKAN KE GOOGLE DRIVE SEKARANG"</strong> di atas untuk login dan mulai mencadangkan.
                </p>
              </div>
            ) : isLoadingBackups ? (
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center text-zinc-400">
                Memeriksa daftar cadangan di Google Drive Anda...
              </div>
            ) : driveBackups.length === 0 ? (
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-dashed border-zinc-800 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-zinc-500 mx-auto" />
                <p className="text-zinc-300 font-semibold">Belum Ada File Cadangan di Google Drive</p>
                <p className="text-zinc-500 text-[11px]">
                  Klik tombol hijau di atas untuk membuat cadangan pertama Anda.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {driveBackups.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white text-xs truncate">{b.name}</div>
                      <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-0.5">
                        <span>
                          {new Date(b.createdTime).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                        {b.size && <span>• {(parseInt(b.size, 10) / 1024).toFixed(1)} KB</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isRestoring}
                        onClick={() => handleRestoreFromDrive(b)}
                        className="py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-bold text-xs border border-amber-500/40 transition-all flex items-center gap-1"
                        title="Pulihkan data bengkel dari file ini"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Pulihkan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBackup(b)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-300 border border-zinc-700 transition-colors"
                        title="Hapus cadangan ini dari Drive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Local Device Backup (Bonus Offline Freedom) */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
            <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <FileDown className="w-4 h-4 text-sky-400" />
              <span>Cadangan Tambahan ke Perangkat (Offline):</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Selain ke Google Drive, Anda juga bisa menyimpan file cadangan (.json) langsung ke folder Download komputer atau HP Anda.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadLocalJson}
                className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-zinc-700 transition-all"
              >
                <FileDown className="w-3.5 h-3.5 text-sky-400" />
                <span>Unduh File .json</span>
              </button>

              <label className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-zinc-700 transition-all cursor-pointer">
                <FileUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Impor File .json</span>
                <input
                  type="file"
                  accept=".json,application/json,text/plain,*/*"
                  onChange={handleUploadLocalJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#111217] border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            CV FATEND STEEL • Google Drive Backup System
          </span>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
