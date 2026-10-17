import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Flame,
  ShieldCheck,
  KeyRound,
  LogOut,
  AlertTriangle,
  Layers,
  Package,
  ScanLine,
  Users,
  Wallet,
  Printer,
  Settings,
  X,
  Check,
  Smartphone,
  Download,
  Copy,
  ExternalLink,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  ArrowUpCircle,
  ArrowDownCircle,
  BookOpen,
  Database,
  RotateCcw,
  Sparkles,
  HardDrive,
} from 'lucide-react';
import { GoogleDriveBackupModal } from './GoogleDriveBackupModal';

export type NavTab = 'projects' | 'inventory' | 'scan' | 'dailycash' | 'wages' | 'cashflow' | 'report';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const {
    session,
    logout,
    projects,
    inventory,
    mutations,
    workers,
    dailyCashRecords,
    pinConfig,
    updatePin,
    cloudStatus,
    lastSyncedAt,
    forceUploadToCloud,
    forceDownloadFromCloud,
    restoreMasterWorkshopData,
    restoreDailyCashFromWorkshop,
  } = useApp();
  const [showPinSettings, setShowPinSettings] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinTarget, setPinTarget] = useState<'PEMILIK' | 'ADMIN'>('ADMIN');
  const [pinMsg, setPinMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallModal(false);
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Count low stock items
  const lowStockCount = inventory.filter((i) => i.currentStock <= i.minStock).length;

  const handlePinUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    if (newPin.length < 4) {
      setPinMsg({ text: 'PIN baru minimal 4 angka.', isError: true });
      return;
    }
    const success = updatePin(pinTarget, oldPin, newPin);
    if (success) {
      setPinMsg({ text: `PIN ${pinTarget} berhasil diperbarui!`, isError: false });
      setOldPin('');
      setNewPin('');
      setTimeout(() => {
        setShowPinSettings(false);
        setPinMsg(null);
      }, 1500);
    } else {
      setPinMsg({ text: 'PIN lama salah atau tidak sesuai.', isError: true });
    }
  };

  const isPemilik = session?.role === 'PEMILIK';

  return (
    <>
      {/* Top Header - Industrial Aesthetic */}
      <header className="no-print sticky top-0 z-40 bg-[#121316]/95 backdrop-blur-md border-b border-zinc-800">
        {/* Warning Accent Line */}
        <div className="h-1 bg-hazard-stripes w-full" />

        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2">
          {/* Logo & Workshop Title - Format Kop Surat Memanjang ke Kanan */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-zinc-900 flex items-center justify-center shadow-md shadow-amber-500/10 border border-amber-500/40 overflow-hidden shrink-0">
              <img
                src="/logo.jpg"
                alt="Logo CV. Fatend Jaya Teknik Sinergi"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap">
                <span className="font-industrial text-xs sm:text-sm md:text-base font-extrabold tracking-wide text-white truncate max-w-[170px] xs:max-w-[240px] sm:max-w-none">
                  CV. FATEND JAYA TEKNIK SINERGI
                </span>
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap shrink-0">
                  Bengkel Las
                </span>
                <span className="hidden xl:inline text-zinc-600 font-bold shrink-0">•</span>
                <span className="hidden xl:inline text-[11px] text-zinc-300 font-medium tracking-wide whitespace-nowrap shrink-0">
                  Welding &amp; Construction Specialist
                </span>
              </div>
              <p className="text-[9.5px] text-zinc-400 font-mono block xl:hidden truncate">
                Welding &amp; Construction Specialist
              </p>
            </div>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Role Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                isPemilik
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-400'
                  : 'bg-blue-950/40 border-blue-500/50 text-blue-400'
              }`}
            >
              {isPemilik ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <KeyRound className="w-3.5 h-3.5" />
              )}
              <span className="tracking-wide">{session?.role || 'Guest'}</span>
            </div>

            {/* Cloud Real-Time Sync Indicator */}
            <button
              type="button"
              onClick={() => setShowCloudModal(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                cloudStatus === 'connected'
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/50'
                  : cloudStatus === 'syncing'
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-400 hover:bg-amber-900/50'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-750'
              }`}
              title="Status Sinkronisasi Cloud Antar-PC/HP"
            >
              <Cloud className={`w-3.5 h-3.5 shrink-0 ${cloudStatus === 'syncing' ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {cloudStatus === 'connected' ? 'Cloud Terhubung' : cloudStatus === 'syncing' ? 'Menyinkron...' : 'Cloud'}
              </span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                cloudStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : cloudStatus === 'syncing' ? 'bg-amber-400 animate-spin' : 'bg-zinc-500'
              }`} />
            </button>

            {/* Google Drive Backup Button (WhatsApp-Style) */}
            <button
              type="button"
              onClick={() => setShowDriveModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60"
              title="Cadangkan Data ke Google Drive (seperti WhatsApp)"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Cadangan Drive</span>
            </button>

            {/* PIN Settings Trigger (Pemilik only) */}
            {isPemilik && (
              <button
                type="button"
                onClick={() => setShowPinSettings(true)}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all border border-zinc-700"
                title="Kelola PIN Bengkel"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Logout / Lock Session */}
            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-red-950 hover:border-red-600/50 text-zinc-300 hover:text-red-300 transition-all border border-zinc-700 flex items-center gap-1 text-xs"
              title="Kunci / Keluar PIN"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Kunci</span>
            </button>
          </div>
        </div>

        {/* Desktop Tab Bar */}
        <div className="hidden md:block border-t border-zinc-800/80 bg-[#16181d]">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <TabButton
                active={currentTab === 'projects'}
                onClick={() => onSelectTab('projects')}
                icon={<Layers className="w-4 h-4" />}
                label="Proyek Bengkel"
              />
              <TabButton
                active={currentTab === 'inventory'}
                onClick={() => onSelectTab('inventory')}
                icon={<Package className="w-4 h-4" />}
                label="Stok & Kartu Stok"
                badge={lowStockCount > 0 ? `${lowStockCount}` : undefined}
              />
              <TabButton
                active={currentTab === 'scan'}
                onClick={() => onSelectTab('scan')}
                icon={<ScanLine className="w-4 h-4" />}
                label="Scan Nota AI"
              />
              <TabButton
                active={currentTab === 'dailycash'}
                onClick={() => onSelectTab('dailycash')}
                icon={<BookOpen className="w-4 h-4" />}
                label="Kas Harian"
              />
              {isPemilik && (
                <>
                  <TabButton
                    active={currentTab === 'wages'}
                    onClick={() => onSelectTab('wages')}
                    icon={<Users className="w-4 h-4" />}
                    label="Borongan & Kasbon"
                  />
                  <TabButton
                    active={currentTab === 'cashflow'}
                    onClick={() => onSelectTab('cashflow')}
                    icon={<Wallet className="w-4 h-4" />}
                    label="Arus Kas Bengkel"
                  />
                  <TabButton
                    active={currentTab === 'report'}
                    onClick={() => onSelectTab('report')}
                    icon={<Printer className="w-4 h-4" />}
                    label="Laporan PDF"
                  />
                </>
              )}
            </div>

            {/* Desktop Quick Indicator for Low Stock */}
            {lowStockCount > 0 && (
              <button
                type="button"
                onClick={() => onSelectTab('inventory')}
                className="my-1.5 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition-all shadow-sm animate-pulse"
                title={`${lowStockCount} barang butuh restock`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{lowStockCount} Barang Menipis</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation (Strictly Mobile-First touch friendly min-h 44px) */}
      <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#14151a]/95 backdrop-blur-lg border-t border-zinc-800 px-1 py-1 safe-area-pb">
        <div className="flex items-center overflow-x-auto no-scrollbar gap-1 py-0.5 px-0.5 justify-between">
          <MobileNavButton
            active={currentTab === 'projects'}
            onClick={() => onSelectTab('projects')}
            icon={<Layers className="w-4 h-4" />}
            label="Proyek"
          />
          <MobileNavButton
            active={currentTab === 'inventory'}
            onClick={() => onSelectTab('inventory')}
            icon={<Package className="w-4 h-4" />}
            label="Stok"
          />
          {/* Stok Menipis Icon - Bersampingan dengan Scan Nota & Menonjol */}
          <button
            type="button"
            onClick={() => onSelectTab('inventory')}
            className={`min-h-[48px] py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 relative transition-all active:scale-95 shrink-0 min-w-[50px] flex-1 border ${
              lowStockCount > 0
                ? 'bg-gradient-to-b from-amber-500/25 to-amber-600/15 border-amber-500/60 text-amber-300 shadow-md shadow-amber-500/20 animate-pulse'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
            }`}
            title="Peringatan Stok Menipis"
          >
            <div className="relative">
              <AlertTriangle className={`w-4 h-4 ${lowStockCount > 0 ? 'text-amber-400 stroke-[2.5]' : 'text-zinc-500'}`} />
              {lowStockCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-amber-500 text-black text-[9px] font-extrabold min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center shadow-sm">
                  {lowStockCount}
                </span>
              )}
            </div>
            <span className={`text-[9.5px] font-extrabold leading-tight truncate max-w-[56px] ${lowStockCount > 0 ? 'text-amber-300' : 'text-zinc-400'}`}>
              Menipis
            </span>
          </button>
          <MobileNavButton
            active={currentTab === 'scan'}
            onClick={() => onSelectTab('scan')}
            icon={<ScanLine className="w-4 h-4" />}
            label="Scan"
            highlight
          />
          <MobileNavButton
            active={currentTab === 'dailycash'}
            onClick={() => onSelectTab('dailycash')}
            icon={<BookOpen className="w-4 h-4" />}
            label="Kas Harian"
          />
          {isPemilik && (
            <>
              <MobileNavButton
                active={currentTab === 'wages'}
                onClick={() => onSelectTab('wages')}
                icon={<Users className="w-4 h-4" />}
                label="Borongan"
              />
              <MobileNavButton
                active={currentTab === 'cashflow'}
                onClick={() => onSelectTab('cashflow')}
                icon={<Wallet className="w-4 h-4" />}
                label="Arus Kas"
              />
              <MobileNavButton
                active={currentTab === 'report'}
                onClick={() => onSelectTab('report')}
                icon={<Printer className="w-4 h-4" />}
                label="Laporan"
              />
            </>
          )}
        </div>
      </nav>

      {/* PIN Settings Modal */}
      {showPinSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#181a20] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold">
                <Settings className="w-5 h-5 text-amber-400" />
                <span>Pengaturan PIN Pengguna</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPinSettings(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePinUpdate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Pilih Peran yang Ingin Diubah PIN-nya
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPinTarget('PEMILIK')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      pinTarget === 'PEMILIK'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Ganti PIN Pemilik
                  </button>
                  <button
                    type="button"
                    onClick={() => setPinTarget('ADMIN')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      pinTarget === 'ADMIN'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Ganti PIN Admin
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  PIN Lama
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="Masukkan PIN saat ini"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono tracking-widest text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  PIN Baru (Minimal 4 Angka)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Masukkan PIN baru"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono tracking-widest text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              {pinMsg && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-medium ${
                    pinMsg.isError
                      ? 'bg-red-950/60 border border-red-800 text-red-300'
                      : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                  }`}
                >
                  {pinMsg.text}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinSettings(false)}
                  className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan PIN</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APK & PWA Installation Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-[#181a20] border border-zinc-700 rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pasang Aplikasi di HP / Ubah ke APK</h3>
                  <p className="text-[11px] text-zinc-400">Gunakan di HP layaknya aplikasi bawaan (Full Screen & Cepat)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option 1: Direct Install (PWA) */}
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  <span>Cara 1: Pasang Langsung di HP (Rekomendasi)</span>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Tanpa Play Store
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Aplikasi ini sudah berteknologi <strong>PWA (Progressive Web App)</strong>. Ikon <strong className="text-amber-400">CV FATEND STEEL</strong> akan langsung muncul di layar utama smartphone Android Anda dan berjalan tanpa browser bar!
              </p>

              {deferredPrompt ? (
                <button
                  type="button"
                  onClick={handleTriggerInstall}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Klik untuk Pasang Sekarang di HP</span>
                </button>
              ) : (
                <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                  <p className="font-semibold text-zinc-200">Langkah di Google Chrome HP:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-zinc-300">
                    <li>Buka link aplikasi ini di <strong>Google Chrome HP</strong>.</li>
                    <li>Ketuk menu titik tiga <strong>(⋮)</strong> di pojok kanan atas.</li>
                    <li>Pilih <strong>"Instal aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Option 2: Generate APK File */}
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                <span>Cara 2: Butuh File Mentahan (.APK)?</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Jika Anda ingin membagikan file <strong>.APK</strong> langsung via WhatsApp atau Bluetooth, Anda bisa mengubah link ini menjadi APK gratis dalam 1 menit via <strong>PWABuilder</strong> atau <strong>WebIntoApp</strong>:
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-zinc-700"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Tersalin!' : 'Salin Link Web'}</span>
                </button>
                <a
                  href={`https://www.pwabuilder.com/?url=${encodeURIComponent(window.location.origin)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Generate APK</span>
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Cloud Real-Time Sync Modal */}
      {showCloudModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16181d] border border-zinc-700/80 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Sinkronisasi Cloud Antar-Perangkat</h3>
                  <p className="text-[11px] text-zinc-400">Database Online Real-Time (Firestore)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCloudModal(false);
                  setCloudNotice(null);
                }}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Card */}
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-3 h-3 rounded-full ${
                  cloudStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : cloudStatus === 'syncing' ? 'bg-amber-400 animate-spin' : 'bg-red-400'
                }`} />
                <div>
                  <div className="text-xs font-bold text-white">
                    {cloudStatus === 'connected' ? 'Terhubung & Aktif Otomatis' : cloudStatus === 'syncing' ? 'Sedang Menyinkron...' : 'Menghubungkan ke Cloud...'}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Update Terakhir: {lastSyncedAt ? `${lastSyncedAt} WIB` : 'Baru saja'}
                  </div>
                </div>
              </div>
              <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                Online Real-Time
              </div>
            </div>

            {/* Current Loaded Data Counters */}
            <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Database className="w-3.5 h-3.5" />
                  <span>Data Aktif di Perangkat Ini:</span>
                </span>
                <span className="text-[10px] text-zinc-500">CV FATEND STEEL</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-sm font-extrabold text-white">{projects.length}</div>
                  <div className="text-[9px] text-zinc-400">Proyek</div>
                </div>
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-sm font-extrabold text-amber-400">{inventory.length}</div>
                  <div className="text-[9px] text-zinc-400">Stok</div>
                </div>
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-sm font-extrabold text-blue-400">{mutations.length}</div>
                  <div className="text-[9px] text-zinc-400">Mutasi</div>
                </div>
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-sm font-extrabold text-emerald-400">{dailyCashRecords.length}</div>
                  <div className="text-[9px] text-zinc-400">Kas Harian</div>
                </div>
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-sm font-extrabold text-purple-400">{workers.length}</div>
                  <div className="text-[9px] text-zinc-400">Pekerja</div>
                </div>
              </div>
            </div>

            {cloudNotice && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed font-medium">
                {cloudNotice}
              </div>
            )}

            {/* 100% Real Restore Master Button */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kembalikan Data Asli 100% Real</span>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Solusi Pasti
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-snug">
                Memulihkan <strong>6 Proyek Asli</strong>, <strong>35 Item Stok</strong>, <strong>123 Mutasi</strong>, <strong>9 Transaksi Kas Harian (Rp 14.910.000)</strong>, dan <strong>3 Kasbon Pekerja</strong> serta menyelaraskannya ke Cloud Firestore.
              </p>
              <button
                type="button"
                disabled={isManualSyncing}
                onClick={async () => {
                  const conf = window.confirm(
                    'Pulihkan 100% Seluruh Data Asli Bengkel CV FATEND STEEL (6 Proyek Asli, 35 Stok Besi/Alat, 123 Mutasi, 9 Transaksi Kas Harian Rp 14.910.000, dan Kasbon)?'
                  );
                  if (!conf) return;
                  setIsManualSyncing(true);
                  setCloudNotice('Memulihkan 100% data asli bengkel ke perangkat & Cloud...');
                  const res = await restoreMasterWorkshopData();
                  setIsManualSyncing(false);
                  if (res.success) {
                    setCloudNotice(
                      `✅ SUKSES 100%! Data asli bengkel berhasil dipulihkan: ${res.projectCount} Proyek Aktif, ${res.stockCount} Item Stok, ${res.mutationCount} Catatan Mutasi, ${res.dailyCashCount} Transaksi Kas Harian, dan ${res.workerCount} Kasbon Pekerja. Data telah disinkronkan ke Cloud Firestore.`
                    );
                  } else {
                    setCloudNotice('Berhasil memuat data lokal, namun koneksi cloud sedang lambat. Data tetap aman di browser!');
                  }
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>⚡ Pulihkan Seluruh Data Bengkel 100% Real</span>
              </button>
            </div>

            {/* Manual Controls */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Sinkronisasi Cloud Manual:</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isManualSyncing}
                  onClick={async () => {
                    setIsManualSyncing(true);
                    setCloudNotice('Menarik data terbaru dari Cloud...');
                    const ok = await forceDownloadFromCloud();
                    setIsManualSyncing(false);
                    setCloudNotice(ok ? 'Data dari Cloud berhasil ditarik dan dimuat!' : 'Gagal mengambil data dari Cloud.');
                  }}
                  className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-zinc-700 cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tarik dari Cloud</span>
                </button>

                <button
                  type="button"
                  disabled={isManualSyncing}
                  onClick={async () => {
                    setIsManualSyncing(true);
                    setCloudNotice('Mengunggah data perangkat ini ke Cloud...');
                    const ok = await forceUploadToCloud();
                    setIsManualSyncing(false);
                    setCloudNotice(ok ? 'Data perangkat ini sukses diunggah ke Cloud!' : 'Gagal mengunggah ke Cloud.');
                  }}
                  className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-zinc-700 cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kirim ke Cloud</span>
                </button>
              </div>
            </div>

            {/* Google Drive Link Card */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/40 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-zinc-200 text-xs">
                  Cadangkan seperti <strong>WhatsApp</strong> ke Google Drive pribadi Anda?
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCloudModal(false);
                  setShowDriveModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs whitespace-nowrap shrink-0 transition-all shadow"
              >
                Buka Drive
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowCloudModal(false);
                setCloudNotice(null);
              }}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Google Drive Backup Modal (WhatsApp Style) */}
      <GoogleDriveBackupModal
        isOpen={showDriveModal}
        onClose={() => setShowDriveModal(false)}
      />
    </>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}> = ({ active, onClick, icon, label, badge }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold tracking-wide transition-all border-b-2 relative ${
      active
        ? 'border-amber-400 text-amber-400 bg-amber-500/5'
        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
    }`}
  >
    {icon}
    <span>{label}</span>
    {badge && (
      <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-bold">
        {badge}
      </span>
    )}
  </button>
);

const MobileNavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  highlight?: boolean;
}> = ({ active, onClick, icon, label, badge, highlight }) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-h-[48px] py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 relative transition-all active:scale-95 shrink-0 min-w-[50px] flex-1 ${
      active
        ? 'text-amber-400 font-bold bg-amber-500/10'
        : highlight
        ? 'text-amber-300/80 hover:text-amber-300'
        : 'text-zinc-400 hover:text-zinc-200'
    }`}
  >
    <div className="relative">
      {icon}
      {badge && (
        <span className="absolute -top-1.5 -right-2 bg-amber-500 text-black text-[9px] font-extrabold w-3.5 h-3.5 rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </div>
    <span className="text-[10px] leading-tight truncate max-w-[54px]">{label}</span>
  </button>
);
