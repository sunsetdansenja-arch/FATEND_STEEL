import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { DailyCashRecord, DailyCashType } from '../types';
import { formatIDR, parseIDR, formatDate } from '../utils/formatters';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  MinusCircle,
  Calendar,
  Search,
  Filter,
  Trash2,
  Edit3,
  Share2,
  Download,
  Image as ImageIcon,
  Check,
  X,
  FileSpreadsheet,
  Copy,
  Clock,
  ExternalLink,
  BookOpen,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Cloud,
} from 'lucide-react';

export const DailyCashView: React.FC = () => {
  const {
    dailyCashRecords,
    addDailyCashRecord,
    updateDailyCashRecord,
    deleteDailyCashRecord,
    clearAllDailyCash,
    zeroOutDailyCashBalance,
    resetDailyCashBook,
    restoreDailyCashFromWorkshop,
    forceDownloadFromCloud,
    cloudStatus,
    session,
  } = useApp();

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const handleManualSyncCloud = async () => {
    setIsSyncingCloud(true);
    setSyncNotice(null);
    try {
      const ok = await forceDownloadFromCloud();
      if (ok) {
        setSyncNotice('✅ Kas Harian berhasil disinkronkan dengan Cloud!');
      } else {
        setSyncNotice('⚠️ Tidak dapat terhubung ke Cloud. Pastikan koneksi internet aktif.');
      }
    } catch (e: any) {
      setSyncNotice('❌ Gagal sinkronisasi: ' + (e?.message || 'Error'));
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setSyncNotice(null), 4000);
    }
  };

  // Active view: 'buku' (Ledger & History) or 'laporan' (Reports & Export)
  const [activeSubTab, setActiveSubTab] = useState<'buku' | 'laporan'>('buku');

  // Modal state for Add/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<DailyCashType>('MASUK');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Modal state for 0-kan Kas / Reset Buku
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetActionType, setResetActionType] = useState<'ZERO_BALANCE' | 'RESET_BOOK'>('ZERO_BALANCE');
  const [zeroNotesInput, setZeroNotesInput] = useState('');
  const [actionAlert, setActionAlert] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Form Fields
  const todayStr = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    date: todayStr,
    amount: '',
    description: '',
  });

  // Delete Confirmation Modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter state for Riwayat Transaksi
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'MASUK' | 'KELUAR'>('ALL');
  const [filterPeriod, setFilterPeriod] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // Report Period State (for Laporan Tab)
  const [reportType, setReportType] = useState<'HARIAN' | 'MINGGUAN' | 'BULANAN'>('HARIAN');
  const [reportDate, setReportDate] = useState(todayStr);
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Export / Share State
  const [copiedWA, setCopiedWA] = useState(false);
  const [isGeneratingJPG, setIsGeneratingJPG] = useState(false);
  const [previewJpgUrl, setPreviewJpgUrl] = useState<string | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Quick Preset Chips for Descriptions
  const INCOME_EXAMPLES = [
    'Pembayaran pelanggan',
    'Sisa modal',
    'Pendapatan',
    'DP Servis Pagar',
    'Pelunasan Kanopi',
    'Ongkos Las Panggilan',
    'Tambahan Kas Toko',
  ];

  const EXPENSE_EXAMPLES = [
    'Beli bahan',
    'Transport',
    'Makan',
    'Bensin armada',
    'Makan & kopi tukang',
    'Beli mata gerinda/amplas',
    'Beli baut roofing & kawat',
    'Isi ulang tabung oksigen',
    'Listrik bengkel',
  ];

  // ==========================================
  // DASHBOARD CALCULATIONS
  // ==========================================
  // 1. Saldo Kas Saat Ini (Total Masuk kumulatif - Total Keluar kumulatif)
  const totalAllIncome = useMemo(
    () => dailyCashRecords.filter((r) => r.type === 'MASUK').reduce((sum, r) => sum + r.amount, 0),
    [dailyCashRecords]
  );
  const totalAllExpense = useMemo(
    () => dailyCashRecords.filter((r) => r.type === 'KELUAR').reduce((sum, r) => sum + r.amount, 0),
    [dailyCashRecords]
  );
  const currentTotalBalance = totalAllIncome - totalAllExpense;

  // 2. Hari Ini calculations
  const todayRecords = useMemo(
    () => dailyCashRecords.filter((r) => r.date === todayStr),
    [dailyCashRecords, todayStr]
  );
  const todayIncome = useMemo(
    () => todayRecords.filter((r) => r.type === 'MASUK').reduce((sum, r) => sum + r.amount, 0),
    [todayRecords]
  );
  const todayExpense = useMemo(
    () => todayRecords.filter((r) => r.type === 'KELUAR').reduce((sum, r) => sum + r.amount, 0),
    [todayRecords]
  );

  // ==========================================
  // FORM HANDLERS
  // ==========================================
  const handleOpenAdd = (type: DailyCashType) => {
    setEditingRecordId(null);
    setModalType(type);
    setFormData({
      date: todayStr,
      amount: '',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (record: DailyCashRecord) => {
    setEditingRecordId(record.id);
    setModalType(record.type);
    setFormData({
      date: record.date,
      amount: record.amount.toString(),
      description: record.description,
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseIDR(formData.amount);
    if (parsedAmount <= 0) {
      alert('Mohon masukkan nominal uang yang valid.');
      return;
    }
    if (!formData.description.trim()) {
      alert('Mohon isi keterangan transaksi.');
      return;
    }

    if (editingRecordId) {
      updateDailyCashRecord(editingRecordId, {
        date: formData.date,
        type: modalType,
        amount: parsedAmount,
        description: formData.description.trim(),
      });
    } else {
      addDailyCashRecord({
        date: formData.date,
        type: modalType,
        amount: parsedAmount,
        description: formData.description.trim(),
      });
    }

    setIsModalOpen(false);
    setEditingRecordId(null);
    setFormData({ date: todayStr, amount: '', description: '' });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      deleteDailyCashRecord(deleteConfirmId);
      setDeleteConfirmId(null);
      setActionAlert({
        message: 'Catatan kas berhasil dihapus dan otomatis terhapus di tampilan Pemilik & Admin.',
        type: 'success',
      });
      setTimeout(() => setActionAlert(null), 3500);
    }
  };

  const handleExecuteZeroBalance = () => {
    const res = zeroOutDailyCashBalance(zeroNotesInput.trim() || undefined);
    setIsResetModalOpen(false);
    setZeroNotesInput('');
    if (res.success) {
      setActionAlert({
        message: `Saldo kas berhasil di-0-kan dengan transaksi penyeimbang ${formatIDR(res.amount)}. Tersinkronisasi ke Pemilik & Admin.`,
        type: 'success',
      });
    } else {
      setActionAlert({
        message: 'Saldo kas saat ini sudah Rp 0. Tidak ada penyesuaian yang diperlukan.',
        type: 'info',
      });
    }
    setTimeout(() => setActionAlert(null), 4500);
  };

  const handleExecuteResetBook = () => {
    resetDailyCashBook();
    setIsResetModalOpen(false);
    setActionAlert({
      message: 'Buku kas harian berhasil direset bersih (0 catatan & saldo Rp 0) untuk Pemilik & Admin.',
      type: 'success',
    });
    setTimeout(() => setActionAlert(null), 4500);
  };

  // ==========================================
  // FILTERED RECORDS FOR RIWAYAT
  // ==========================================
  const filteredRecords = useMemo(() => {
    return dailyCashRecords.filter((r) => {
      // Type filter
      if (filterType !== 'ALL' && r.type !== filterType) return false;

      // Period filter
      if (filterPeriod === 'TODAY' && r.date !== todayStr) return false;
      if (filterPeriod === 'WEEK') {
        const d = new Date(r.date);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0 || diffDays > 7) return false;
      }
      if (filterPeriod === 'MONTH') {
        const d = new Date(r.date);
        const now = new Date();
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
      }
      if (filterPeriod === 'CUSTOM') {
        if (r.date < customStartDate || r.date > customEndDate) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = r.description.toLowerCase().includes(q);
        const matchDate = r.date.includes(q);
        const matchAmount = r.amount.toString().includes(q);
        if (!matchDesc && !matchDate && !matchAmount) return false;
      }

      return true;
    });
  }, [dailyCashRecords, filterType, filterPeriod, todayStr, customStartDate, customEndDate, searchQuery]);

  // Group filtered records by date descending
  const groupedRecords = useMemo((): Record<string, DailyCashRecord[]> => {
    const groups: Record<string, DailyCashRecord[]> = {};
    const sorted = [...filteredRecords].sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    for (const item of sorted) {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
    }
    return groups;
  }, [filteredRecords]);

  // ==========================================
  // REPORT DATA CALCULATIONS
  // ==========================================
  const reportRecords = useMemo(() => {
    return dailyCashRecords.filter((r) => {
      if (reportType === 'HARIAN') {
        return r.date === reportDate;
      }
      if (reportType === 'MINGGUAN') {
        const d = new Date(r.date);
        const target = new Date(reportDate);
        const diffDays = Math.floor((target.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays < 7;
      }
      if (reportType === 'BULANAN') {
        return r.date.startsWith(reportMonth);
      }
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyCashRecords, reportType, reportDate, reportMonth]);

  const reportTotalIncome = useMemo(
    () => reportRecords.filter((r) => r.type === 'MASUK').reduce((sum, r) => sum + r.amount, 0),
    [reportRecords]
  );
  const reportTotalExpense = useMemo(
    () => reportRecords.filter((r) => r.type === 'KELUAR').reduce((sum, r) => sum + r.amount, 0),
    [reportRecords]
  );
  const reportBalance = reportTotalIncome - reportTotalExpense;

  const reportPeriodLabel = useMemo(() => {
    if (reportType === 'HARIAN') {
      return `Harian: ${formatDate(reportDate)}`;
    }
    if (reportType === 'MINGGUAN') {
      return `7 Hari Terakhir (s/d ${formatDate(reportDate)})`;
    }
    if (reportType === 'BULANAN') {
      const [year, month] = reportMonth.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return `Bulan ${d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
    }
    return 'Semua Catatan';
  }, [reportType, reportDate, reportMonth]);

  // ==========================================
  // WHATSAPP REPORT GENERATOR
  // ==========================================
  const generateWhatsAppText = () => {
    let text = `📋 *LAPORAN KAS HARIAN - CV. FATEND STEEL*\n`;
    text += `🏢 *CV. FATEND JAYA TEKNIK SINERGI*\n`;
    text += `🗓️ Periode: ${reportPeriodLabel}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 *RINGKASAN KAS:*\n`;
    text += `• Total Uang Masuk  : ${formatIDR(reportTotalIncome)}\n`;
    text += `• Total Uang Keluar : ${formatIDR(reportTotalExpense)}\n`;
    text += `• *SALDO AKHIR*     : *${formatIDR(reportBalance)}* ${reportBalance >= 0 ? '🟢 (Surplus)' : '🔴 (Defisit)'}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📝 *RINCIAN TRANSAKSI (${reportRecords.length} Catatan):*\n`;

    if (reportRecords.length === 0) {
      text += `_(Tidak ada transaksi pada periode ini)_\n`;
    } else {
      reportRecords.forEach((r, idx) => {
        const sign = r.type === 'MASUK' ? '[+]' : '[-]';
        text += `${idx + 1}. ${sign} ${r.date} | ${r.description} : *${formatIDR(r.amount)}*\n`;
      });
    }

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Dicatat otomatis via Aplikasi Kas CV Fatend Steel.\n`;
    text += `Waktu cetak: ${new Date().toLocaleString('id-ID')}\n`;
    return text;
  };

  const handleShareWhatsApp = () => {
    const text = generateWhatsAppText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyWhatsAppText = () => {
    const text = generateWhatsAppText();
    navigator.clipboard.writeText(text);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2000);
  };

  // ==========================================
  // CETAK LAPORAN JPG GENERATOR (HTML5 CANVAS)
  // ==========================================
  const generateJPGReport = () => {
    setIsGeneratingJPG(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsGeneratingJPG(false);
        return;
      }

      // High-resolution canvas (Retina quality)
      const width = 1080;
      const baseHeaderHeight = 320;
      const summaryHeight = 180;
      const rowHeight = 44;
      const tableHeaderHeight = 48;
      const tableRowsHeight = Math.max(reportRecords.length * rowHeight, 80);
      const footerHeight = 160;
      const height = baseHeaderHeight + summaryHeight + tableHeaderHeight + tableRowsHeight + footerHeight;

      canvas.width = width;
      canvas.height = height;

      // 1. Background clean warm off-white / light paper tone
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      // 2. Header Industrial Brand Stripe
      const stripeHeight = 10;
      ctx.fillStyle = '#f59e0b'; // Amber-500
      ctx.fillRect(0, 0, width, stripeHeight);

      // 3. Header Card
      ctx.fillStyle = '#0f172a'; // Slate-900
      ctx.fillRect(0, stripeHeight, width, 180);

      // Logo / Title Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('CV. FATEND JAYA TEKNIK SINERGI', 48, 75);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('BENGKEL LAS & KONSTRUKSI BAJA • KAS HARIAN PERSONAL', 48, 110);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.fillText('Laporan Buku Kas Masuk & Keluar Mandiri', 48, 140);

      // Periode Bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(48, 205, width - 96, 50);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`PERIODE: ${reportPeriodLabel.toUpperCase()}`, 68, 237);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px sans-serif';
      const printDateStr = `Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      ctx.fillText(printDateStr, width - 360, 237);

      // 4. Summary Cards (3 Columns)
      const summaryY = 275;
      const cardWidth = (width - 96 - 32) / 3;

      // Box 1: Total Masuk (Green)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#bbf7d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(48, summaryY, cardWidth, 110, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#15803d';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('↗ TOTAL UANG MASUK', 68, summaryY + 36);
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(formatIDR(reportTotalIncome), 68, summaryY + 76);

      // Box 2: Total Keluar (Red)
      const col2X = 48 + cardWidth + 16;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#fecdd3';
      ctx.beginPath();
      ctx.roundRect(col2X, summaryY, cardWidth, 110, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#be123c';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('↘ TOTAL UANG KELUAR', col2X + 20, summaryY + 36);
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(formatIDR(reportTotalExpense), col2X + 20, summaryY + 76);

      // Box 3: Saldo Akhir (Dark/Blue)
      const col3X = col2X + cardWidth + 16;
      ctx.fillStyle = reportBalance >= 0 ? '#064e3b' : '#881337';
      ctx.beginPath();
      ctx.roundRect(col3X, summaryY, cardWidth, 110, 8);
      ctx.fill();

      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('SALDO AKHIR (BERSIH)', col3X + 20, summaryY + 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(formatIDR(reportBalance), col3X + 20, summaryY + 76);

      // 5. Table Section
      const tableStartY = 410;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(48, tableStartY, width - 96, tableHeaderHeight);

      // Table Headers
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('NO', 68, tableStartY + 30);
      ctx.fillText('TANGGAL', 120, tableStartY + 30);
      ctx.fillText('KETERANGAN', 260, tableStartY + 30);
      ctx.fillText('TIPE', 640, tableStartY + 30);
      ctx.fillText('NOMINAL (RP)', 820, tableStartY + 30);

      // Table Rows
      let currentY = tableStartY + tableHeaderHeight;
      let runningBalance = 0;

      if (reportRecords.length === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(48, currentY, width - 96, 60);
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(48, currentY, width - 96, 60);

        ctx.fillStyle = '#64748b';
        ctx.font = 'italic 16px sans-serif';
        ctx.fillText('Tidak ada transaksi pada periode kas ini.', width / 2 - 140, currentY + 36);
        currentY += 60;
      } else {
        reportRecords.forEach((r, idx) => {
          const isEven = idx % 2 === 0;
          ctx.fillStyle = isEven ? '#ffffff' : '#f1f5f9';
          ctx.fillRect(48, currentY, width - 96, rowHeight);
          ctx.strokeStyle = '#e2e8f0';
          ctx.strokeRect(48, currentY, width - 96, rowHeight);

          // No
          ctx.fillStyle = '#475569';
          ctx.font = '14px sans-serif';
          ctx.fillText(String(idx + 1), 68, currentY + 27);

          // Tanggal
          ctx.fillStyle = '#1e293b';
          ctx.fillText(r.date, 120, currentY + 27);

          // Keterangan
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 14px sans-serif';
          const maxDescLen = 42;
          const displayDesc = r.description.length > maxDescLen ? r.description.substring(0, maxDescLen) + '...' : r.description;
          ctx.fillText(displayDesc, 260, currentY + 27);

          // Tipe Badge
          if (r.type === 'MASUK') {
            ctx.fillStyle = '#16a34a';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText('+ UANG MASUK', 640, currentY + 27);

            ctx.fillStyle = '#15803d';
            ctx.font = 'bold 15px monospace';
            ctx.fillText(`+ ${formatIDR(r.amount)}`, 820, currentY + 27);
          } else {
            ctx.fillStyle = '#dc2626';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText('- UANG KELUAR', 640, currentY + 27);

            ctx.fillStyle = '#b91c1c';
            ctx.font = 'bold 15px monospace';
            ctx.fillText(`- ${formatIDR(r.amount)}`, 820, currentY + 27);
          }

          currentY += rowHeight;
        });
      }

      // 6. Footer Section
      const footerStartY = currentY + 30;

      // Divider line
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(48, footerStartY);
      ctx.lineTo(width - 48, footerStartY);
      ctx.stroke();

      // Signatures / Stamp area
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Dicatat & Diperiksa Oleh:', 68, footerStartY + 30);
      ctx.font = '13px sans-serif';
      ctx.fillText('Kasir / Admin CV Fatend Steel', 68, footerStartY + 50);

      // Signature line
      ctx.strokeStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(68, footerStartY + 105);
      ctx.lineTo(240, footerStartY + 105);
      ctx.stroke();
      ctx.fillText(`(${session?.name || 'Admin / Pemilik'})`, 68, footerStartY + 120);

      // Right: Workshop Watermark info
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 13px sans-serif';
      ctx.fillText('Catatan: Laporan ini adalah Buku Kas Harian Internal Bengkel.', width - 420, footerStartY + 30);
      ctx.fillText('CV. FATEND JAYA TEKNIK SINERGI', width - 420, footerStartY + 52);
      ctx.fillText('Bebas dari pengaruh Arus Kas Global Proyek', width - 420, footerStartY + 74);

      // Convert to JPG Data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setPreviewJpgUrl(dataUrl);

      // Download file directly
      const cleanPeriodName = reportPeriodLabel.replace(/[^a-zA-Z0-9]/g, '-');
      const filename = `Laporan-Kas-Harian-${cleanPeriodName}.jpg`;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating JPG:', err);
      alert('Gagal menghasilkan gambar JPG laporan. Silakan coba kembali.');
    } finally {
      setIsGeneratingJPG(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ==========================================
          HEADER SECTION & SUB-TAB NAVIGATION
      ========================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#14151b] p-4 sm:p-5 rounded-2xl border border-zinc-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-industrial text-xl sm:text-2xl font-extrabold text-white tracking-wide">
                BUKU KAS HARIAN
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Personal Bengkel
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                Akses Pemilik &amp; Admin
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Catat uang masuk &amp; uang keluar harian dengan cepat dan mandiri.
            </p>
          </div>
        </div>

        {/* Actions: Cloud Sync & View Switcher */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            disabled={isSyncingCloud}
            onClick={handleManualSyncCloud}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 hover:text-emerald-200 border border-emerald-500/50 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Tarik data Kas Harian terbaru dari Cloud Firestore (Sinkronisasi Admin & Pemilik)"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingCloud ? 'animate-spin' : ''}`} />
            <span>{isSyncingCloud ? 'Menyinkron...' : 'Sinkronkan Cloud'}</span>
          </button>

          {/* View Switcher: Buku Kas vs Laporan */}
          <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('buku')}
              className={`py-2 px-3 sm:px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'buku'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Buku Kas &amp; Riwayat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('laporan')}
              className={`py-2 px-3 sm:px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'laporan'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Laporan &amp; Cetak JPG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cloud Sync Toast Banner */}
      {syncNotice && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <span>{syncNotice}</span>
          <button type="button" onClick={() => setSyncNotice(null)} className="text-zinc-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Notification Toast Banner */}
      {actionAlert && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-3 border transition-all ${
            actionAlert.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : 'bg-blue-950/80 border-blue-500/50 text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{actionAlert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionAlert(null)}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==========================================
          1. DASHBOARD: 3 METRIC CARDS
      ========================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Saldo Kas Saat Ini */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#181a20] to-[#121316] border border-amber-500/30 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Saldo Kas Saat Ini
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setZeroNotesInput('');
                  setResetActionType('ZERO_BALANCE');
                  setIsResetModalOpen(true);
                }}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-colors"
                title="Nol-kan saldo kas saat ini"
              >
                0-kan Kas
              </button>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
          </div>
          <div className={`font-mono text-2xl sm:text-3xl font-extrabold ${currentTotalBalance >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
            {formatIDR(currentTotalBalance)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Akumulasi Masuk: {formatIDR(totalAllIncome)} • Keluar: {formatIDR(totalAllExpense)}
          </p>
        </div>

        {/* Card 2: Total Uang Masuk Hari Ini */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#151c18] to-[#121316] border border-emerald-500/30 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Uang Masuk Hari Ini
              </span>
              <span className="text-[10px] font-mono text-zinc-400">({todayStr})</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-emerald-400">
            {formatIDR(todayIncome)}
          </div>
          <p className="text-[11px] text-emerald-400/70 mt-1">
            {todayRecords.filter((r) => r.type === 'MASUK').length} catatan penerimaan hari ini
          </p>
        </div>

        {/* Card 3: Total Uang Keluar Hari Ini */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1e1516] to-[#121316] border border-rose-500/30 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                Uang Keluar Hari Ini
              </span>
              <span className="text-[10px] font-mono text-zinc-400">({todayStr})</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-rose-400">
            {formatIDR(todayExpense)}
          </div>
          <p className="text-[11px] text-rose-400/70 mt-1">
            {todayRecords.filter((r) => r.type === 'KELUAR').length} catatan pengeluaran hari ini
          </p>
        </div>
      </div>

      {/* Empty State Banner with Quick 100% Recovery */}
      {dailyCashRecords.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-amber-300">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm">Buku Kas Harian Belum Memuat Transaksi (0 Catatan)</div>
              <p className="text-zinc-300 mt-0.5">
                Ingin memulihkan <strong>9 transaksi resmi kas bengkel</strong> (Total Masuk Rp 21.000.000, Keluar Rp 6.090.000, Saldo Kas Rp 14.910.000)?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              const res = await restoreDailyCashFromWorkshop();
              if (res.success) {
                setActionAlert({
                  message: `✅ Berhasil memulihkan ${res.count} transaksi kas bengkel! Saldo Kas: ${formatIDR(res.balance)}. Tersinkronisasi ke Cloud.`,
                  type: 'success',
                });
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs whitespace-nowrap shrink-0 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Pulihkan 9 Transaksi (Rp 14.910.000)</span>
          </button>
        </div>
      )}

      {/* ==========================================
          ACTION BUTTONS (MASUK, KELUAR, 0-KAN / RESET BUKU)
      ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <button
          type="button"
          onClick={() => handleOpenAdd('MASUK')}
          className="sm:col-span-5 min-h-[54px] py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-sm sm:text-base tracking-wide flex items-center justify-center gap-3 shadow-lg shadow-emerald-950/40 border border-emerald-400/40 transition-all active:scale-[0.98] cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <PlusCircle className="w-5 h-5 text-white" />
          </div>
          <span>+ CATAT UANG MASUK</span>
        </button>

        <button
          type="button"
          onClick={() => handleOpenAdd('KELUAR')}
          className="sm:col-span-5 min-h-[54px] py-3.5 px-5 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-extrabold text-sm sm:text-base tracking-wide flex items-center justify-center gap-3 shadow-lg shadow-rose-950/40 border border-rose-400/40 transition-all active:scale-[0.98] cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <MinusCircle className="w-5 h-5 text-white" />
          </div>
          <span>- CATAT UANG KELUAR</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setZeroNotesInput('');
            setResetActionType('ZERO_BALANCE');
            setIsResetModalOpen(true);
          }}
          className="sm:col-span-2 min-h-[54px] py-3 px-3 rounded-2xl bg-[#181a22] hover:bg-zinc-800 text-amber-400 hover:text-amber-300 font-bold text-xs tracking-wide flex flex-row sm:flex-col items-center justify-center gap-1 border border-amber-500/30 hover:border-amber-500/60 shadow-md transition-all active:scale-[0.98] cursor-pointer"
          title="0-kan Saldo Kas atau Reset Buku Kas"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-center whitespace-nowrap">0-kan / Reset</span>
        </button>
      </div>

      {/* ==========================================
          TAB 1: BUKU KAS & RIWAYAT TRANSAKSI
      ========================================== */}
      {activeSubTab === 'buku' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="p-4 bg-[#14151a] rounded-2xl border border-zinc-800 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari keterangan, tanggal, atau nominal..."
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Type Switcher */}
              <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterType('ALL')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    filterType === 'ALL'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('MASUK')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    filterType === 'MASUK'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'text-zinc-400 hover:text-emerald-400'
                  }`}
                >
                  Masuk (+)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('KELUAR')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    filterType === 'KELUAR'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'text-zinc-400 hover:text-rose-400'
                  }`}
                >
                  Keluar (-)
                </button>
              </div>

              {/* Period Quick Filter */}
              <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 shrink-0 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setFilterPeriod('ALL')}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    filterPeriod === 'ALL' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Semua Waktu
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPeriod('TODAY')}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    filterPeriod === 'TODAY' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPeriod('WEEK')}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    filterPeriod === 'WEEK' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPeriod('MONTH')}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    filterPeriod === 'MONTH' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPeriod('CUSTOM')}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    filterPeriod === 'CUSTOM' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Kustom
                </button>
              </div>
            </div>

            {/* Custom Date Range selector if CUSTOM is active */}
            {filterPeriod === 'CUSTOM' && (
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800 text-xs text-zinc-300">
                <span className="font-semibold text-zinc-400">Rentang Tanggal:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 rounded-lg text-white text-xs"
                />
                <span>s/d</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 rounded-lg text-white text-xs"
                />
              </div>
            )}
          </div>

          {/* Ledger Table / List */}
          <div className="bg-[#14151a] rounded-2xl border border-zinc-800 shadow-xl overflow-hidden">
            {/* Header of Table */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <h3 className="font-industrial text-base font-bold text-white tracking-wide">
                  RIWAYAT BUKU KAS
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-800 text-zinc-300">
                  {filteredRecords.length} Catatan
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setZeroNotesInput('');
                    setResetActionType('RESET_BOOK');
                    setIsResetModalOpen(true);
                  }}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-amber-300 border border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Kosongkan buku kas setelah dilaporkan agar tidak penuh"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Buku</span>
                </button>
                <div className="text-xs text-zinc-400 font-mono hidden sm:block">
                  Format Buku Kas Fisik Mandiri
                </div>
              </div>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 text-zinc-500 flex items-center justify-center mx-auto">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-zinc-300">Belum Ada Transaksi Kas</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Tekan tombol hijau <strong>+ Uang Masuk</strong> atau merah <strong>- Uang Keluar</strong> di atas untuk mulai mencatat.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/70">
                {(Object.entries(groupedRecords) as [string, DailyCashRecord[]][]).map(([dateKey, records]) => {
                  const dateSubtotalIncome = records
                    .filter((r) => r.type === 'MASUK')
                    .reduce((sum, r) => sum + r.amount, 0);
                  const dateSubtotalExpense = records
                    .filter((r) => r.type === 'KELUAR')
                    .reduce((sum, r) => sum + r.amount, 0);

                  return (
                    <div key={dateKey} className="group">
                      {/* Date Header Strip */}
                      <div className="bg-[#181a22] px-4 py-2 flex items-center justify-between border-b border-zinc-800/50">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs font-extrabold text-zinc-200">
                            {formatDate(dateKey)}
                          </span>
                          {dateKey === todayStr && (
                            <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">
                              Hari Ini
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-mono">
                          {dateSubtotalIncome > 0 && (
                            <span className="text-emerald-400">
                              + {formatIDR(dateSubtotalIncome)}
                            </span>
                          )}
                          {dateSubtotalExpense > 0 && (
                            <span className="text-rose-400">
                              - {formatIDR(dateSubtotalExpense)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items under this date */}
                      <div className="divide-y divide-zinc-800/40">
                        {records.map((record) => {
                          const isIncome = record.type === 'MASUK';
                          return (
                            <div
                              key={record.id}
                              className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-800/30 transition-colors"
                            >
                              {/* Left: Icon & Description */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                    isIncome
                                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                      : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                                  }`}
                                >
                                  {isIncome ? (
                                    <ArrowUpRight className="w-5 h-5" />
                                  ) : (
                                    <ArrowDownLeft className="w-5 h-5" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-white truncate">
                                      {record.description}
                                    </p>
                                    <span
                                      className={`text-[9.5px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                        isIncome
                                          ? 'bg-emerald-500/15 text-emerald-400'
                                          : 'bg-rose-500/15 text-rose-400'
                                      }`}
                                    >
                                      {isIncome ? 'Masuk' : 'Keluar'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                                    <span>{record.date}</span>
                                    {record.createdBy && (
                                      <>
                                        <span>•</span>
                                        <span>Oleh: {record.createdBy}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Amount & Actions */}
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                  <div
                                    className={`font-mono text-sm sm:text-base font-extrabold ${
                                      isIncome ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {isIncome ? '+' : '-'} {formatIDR(record.amount)}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(record)}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                                    title="Edit Catatan"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(record.id)}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                                    title="Hapus Catatan"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: LAPORAN (HARIAN, MINGGUAN, BULANAN) & EXPORT JPG / WHATSAPP
      ========================================== */}
      {activeSubTab === 'laporan' && (
        <div className="space-y-5">
          {/* Filter Periode Laporan */}
          <div className="p-5 bg-[#14151a] rounded-2xl border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-industrial text-base font-bold text-white tracking-wide">
                  PILIH PERIODE LAPORAN KAS
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Hitung otomatis Saldo Kas = Total Uang Masuk - Total Uang Keluar
                </p>
              </div>

              {/* Radio-style Buttons for Period Type */}
              <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setReportType('HARIAN')}
                  className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all ${
                    reportType === 'HARIAN'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Laporan Harian
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('MINGGUAN')}
                  className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all ${
                    reportType === 'MINGGUAN'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Laporan Mingguan
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('BULANAN')}
                  className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all ${
                    reportType === 'BULANAN'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Laporan Bulanan
                </button>
              </div>
            </div>

            {/* Inputs based on period type */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-zinc-800">
              {reportType === 'HARIAN' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-zinc-300">Pilih Tanggal:</label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 px-3 py-1.5 rounded-xl text-white text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setReportDate(todayStr)}
                    className="py-1.5 px-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                  >
                    Hari Ini
                  </button>
                </div>
              )}

              {reportType === 'MINGGUAN' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-zinc-300">Pilih Akhir Periode (7 Hari):</label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 px-3 py-1.5 rounded-xl text-white text-xs font-mono"
                  />
                </div>
              )}

              {reportType === 'BULANAN' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-zinc-300">Pilih Bulan &amp; Tahun:</label>
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 px-3 py-1.5 rounded-xl text-white text-xs font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Report Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#14151a] border border-emerald-500/30">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Total Uang Masuk
              </span>
              <div className="font-mono text-2xl font-extrabold text-emerald-400 mt-1">
                {formatIDR(reportTotalIncome)}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {reportRecords.filter((r) => r.type === 'MASUK').length} kali penerimaan
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#14151a] border border-rose-500/30">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Total Uang Keluar
              </span>
              <div className="font-mono text-2xl font-extrabold text-rose-400 mt-1">
                {formatIDR(reportTotalExpense)}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {reportRecords.filter((r) => r.type === 'KELUAR').length} kali pengeluaran
              </p>
            </div>

            <div
              className={`p-5 rounded-2xl border ${
                reportBalance >= 0
                  ? 'bg-gradient-to-br from-emerald-950/40 to-[#14151a] border-emerald-500/50'
                  : 'bg-gradient-to-br from-rose-950/40 to-[#14151a] border-rose-500/50'
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Saldo Akhir (Masuk - Keluar)
              </span>
              <div
                className={`font-mono text-2xl font-extrabold mt-1 ${
                  reportBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {formatIDR(reportBalance)}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {reportBalance >= 0 ? 'Kondisi Kas Surplus' : 'Kondisi Kas Defisit'}
              </p>
            </div>
          </div>

          {/* Action Buttons: Cetak JPG & Bagikan WA */}
          <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-zinc-900 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-amber-300">
                Fitur Ekspor &amp; Bagikan Laporan
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Cetak ke gambar JPG berkualitas tinggi atau kirim ringkasan kas via WhatsApp ke pemilik.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <button
                type="button"
                onClick={generateJPGReport}
                disabled={isGeneratingJPG}
                className="flex-1 sm:flex-initial py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
                <span>{isGeneratingJPG ? 'Memproses JPG...' : 'Cetak Gambar JPG'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex-1 sm:flex-initial py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Kirim WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleCopyWhatsAppText}
                className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors border border-zinc-700 cursor-pointer"
                title="Salin Teks Laporan"
              >
                {copiedWA ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setZeroNotesInput('');
                  setResetActionType('ZERO_BALANCE');
                  setIsResetModalOpen(true);
                }}
                className="py-3 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 hover:text-amber-200 border border-amber-500/40 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
                title="Selesai lapor? 0-kan saldo atau reset buku kas agar tidak penuh"
              >
                <RotateCcw className="w-4 h-4" />
                <span>0-kan / Reset</span>
              </button>
            </div>
          </div>

          {/* Preview Table for Selected Report Period */}
          <div className="bg-[#14151a] rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h4 className="font-industrial text-sm font-bold text-white tracking-wide">
                RINCIAN TRANSAKSI PERIODE: {reportPeriodLabel.toUpperCase()}
              </h4>
              <span className="text-xs font-mono text-zinc-400">
                {reportRecords.length} Data
              </span>
            </div>

            {reportRecords.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                Tidak ada data transaksi pada periode ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#181a20] text-zinc-400 uppercase font-mono border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-4">No</th>
                      <th className="py-2.5 px-4">Tanggal</th>
                      <th className="py-2.5 px-4">Keterangan</th>
                      <th className="py-2.5 px-4">Tipe</th>
                      <th className="py-2.5 px-4 text-right">Nominal</th>
                      <th className="py-2.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-medium">
                    {reportRecords.map((item, idx) => {
                      const isIncome = item.type === 'MASUK';
                      return (
                        <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3 px-4 text-zinc-500 font-mono">{idx + 1}</td>
                          <td className="py-3 px-4 text-zinc-300 font-mono">{item.date}</td>
                          <td className="py-3 px-4 font-bold text-white">{item.description}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                                isIncome
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-rose-500/15 text-rose-400'
                              }`}
                            >
                              {isIncome ? 'MASUK' : 'KELUAR'}
                            </span>
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono font-extrabold ${
                              isIncome ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isIncome ? '+' : '-'} {formatIDR(item.amount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="p-1 text-zinc-400 hover:text-amber-400"
                                title="Edit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(item.id)}
                                className="p-1 text-zinc-400 hover:text-rose-400"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CATAT / EDIT UANG MASUK & KELUAR
      ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#181a20] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div
              className={`p-4 border-b flex items-center justify-between ${
                modalType === 'MASUK'
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {modalType === 'MASUK' ? (
                  <PlusCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <MinusCircle className="w-5 h-5 text-rose-400" />
                )}
                <h3 className="font-industrial text-base font-extrabold text-white tracking-wide">
                  {editingRecordId
                    ? 'EDIT CATATAN KAS'
                    : modalType === 'MASUK'
                    ? 'CATAT UANG MASUK'
                    : 'CATAT UANG KELUAR'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              {/* Type Switcher inside Modal */}
              <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalType('MASUK')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    modalType === 'MASUK'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-emerald-300'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Uang Masuk (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalType('KELUAR')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    modalType === 'KELUAR'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-rose-300'
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  <span>Uang Keluar (-)</span>
                </button>
              </div>

              {/* 1. Tanggal */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Tanggal Transaksi
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, date: todayStr })}
                    className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors shrink-0"
                  >
                    Hari Ini
                  </button>
                </div>
              </div>

              {/* 2. Jumlah Uang */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-zinc-300">
                    Jumlah Uang (Nominal Rp)
                  </label>
                  {formData.amount && (
                    <span className="text-xs font-mono font-extrabold text-amber-400">
                      {formatIDR(parseIDR(formData.amount))}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
                    Rp
                  </span>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="Contoh: 250000"
                    className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-base font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Quick Presets for Amount */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {[50000, 100000, 250000, 500000, 1000000, 2500000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setFormData({ ...formData, amount: amt.toString() })}
                      className="text-[11px] font-mono px-2 py-1 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition-colors"
                    >
                      +{amt >= 1000000 ? `${amt / 1000000}jt` : `${amt / 1000}rb`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Keterangan */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Keterangan Transaksi
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={
                    modalType === 'MASUK'
                      ? 'Contoh: Pembayaran pelanggan, Sisa modal, Pendapatan...'
                      : 'Contoh: Beli bahan, Transport, Makan...'
                  }
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />

                {/* Quick Description Chips */}
                <div className="mt-2 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-semibold">Contoh Cepat:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(modalType === 'MASUK' ? INCOME_EXAMPLES : EXPENSE_EXAMPLES).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setFormData({ ...formData, description: item })}
                        className="text-[10.5px] px-2 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`min-h-[46px] py-2.5 px-6 rounded-xl font-extrabold text-sm text-white shadow-lg transition-all active:scale-95 cursor-pointer ${
                    modalType === 'MASUK'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                  }`}
                >
                  {editingRecordId ? 'SIMPAN PERUBAHAN' : 'SIMPAN CATATAN KAS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: KONFIRMASI HAPUS
      ========================================== */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#181a20] border border-rose-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-white">Hapus Catatan Kas Ini?</h4>
              <p className="text-xs text-zinc-400 mt-1">
                Catatan ini akan langsung terhapus dari buku kas di tampilan Pemilik maupun Admin.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 shadow-md cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: 0-KAN SALDO KAS ATAU RESET BUKU
      ========================================== */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#181a22] border border-amber-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-industrial text-base font-extrabold text-white tracking-wide">
                    0-KAN SALDO ATAU RESET BUKU KAS
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Tersinkronisasi otomatis antara Pemilik dan Admin bengkel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Saldo Banner */}
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10.5px] uppercase tracking-wider text-zinc-400 font-bold block">
                  Saldo Kas Saat Ini
                </span>
                <span
                  className={`font-mono text-xl font-extrabold ${
                    currentTotalBalance >= 0 ? 'text-amber-400' : 'text-rose-400'
                  }`}
                >
                  {formatIDR(currentTotalBalance)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10.5px] uppercase tracking-wider text-zinc-400 font-bold block">
                  Total Riwayat
                </span>
                <span className="font-mono text-base font-bold text-zinc-300">
                  {dailyCashRecords.length} transaksi
                </span>
              </div>
            </div>

            {/* Tab Selection */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => setResetActionType('ZERO_BALANCE')}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  resetActionType === 'ZERO_BALANCE'
                    ? 'bg-amber-500 text-black shadow-md font-extrabold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>1. 0-kan Saldo Kas</span>
                <span className="text-[10px] opacity-80 font-medium">(Tutup Periode)</span>
              </button>
              <button
                type="button"
                onClick={() => setResetActionType('RESET_BOOK')}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  resetActionType === 'RESET_BOOK'
                    ? 'bg-rose-600 text-white shadow-md font-extrabold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>2. Reset Buku Kas</span>
                <span className="text-[10px] opacity-80 font-medium">(Kosongkan Buku)</span>
              </button>
            </div>

            {/* OPTION 1: 0-kan Saldo Kas */}
            {resetActionType === 'ZERO_BALANCE' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5 text-amber-400">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    Penjelasan 0-kan Saldo:
                  </p>
                  <p className="text-zinc-300 leading-relaxed">
                    Sistem akan otomatis mencatat satu transaksi penyeimbang{' '}
                    <strong className="text-white">
                      {currentTotalBalance > 0
                        ? `Uang Keluar (-) sebesar ${formatIDR(currentTotalBalance)}`
                        : currentTotalBalance < 0
                        ? `Uang Masuk (+) sebesar ${formatIDR(Math.abs(currentTotalBalance))}`
                        : 'Rp 0 (saldo saat ini sudah pas nol)'}
                    </strong>{' '}
                    sehingga saldo kas menjadi persis <span className="text-emerald-400 font-bold">Rp 0</span>.
                  </p>
                  <p className="text-zinc-400 text-[11px]">
                    ✓ Riwayat catatan transaksi sebelumnya <strong>tetap tersimpan rapi</strong>.
                    <br />
                    ✓ Sangat cocok saat kas fisik diserahkan ke pemilik atau tutup buku periode harian/mingguan.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    Keterangan Penyeimbang (Opsional)
                  </label>
                  <input
                    type="text"
                    value={zeroNotesInput}
                    onChange={(e) => setZeroNotesInput(e.target.value)}
                    placeholder={
                      currentTotalBalance > 0
                        ? 'Contoh: Tutup Kas / Setor Saldo ke Pemilik'
                        : 'Contoh: Tutup Kas / Tambahan Modal Penyeimbang'
                    }
                    className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="py-2.5 px-4 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteZeroBalance}
                    disabled={currentTotalBalance === 0}
                    className={`min-h-[44px] py-2.5 px-5 rounded-xl font-extrabold text-xs transition-all active:scale-95 cursor-pointer ${
                      currentTotalBalance === 0
                        ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-950/50'
                    }`}
                  >
                    {currentTotalBalance === 0 ? 'Saldo Sudah Rp 0' : 'Ya, 0-kan Saldo Sekarang'}
                  </button>
                </div>
              </div>
            )}

            {/* OPTION 2: Reset Bersih Buku Kas */}
            {resetActionType === 'RESET_BOOK' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5 text-rose-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Penjelasan Reset Buku Kas:
                  </p>
                  <p className="text-zinc-300 leading-relaxed">
                    Tindakan ini akan <strong>MENGOSONGKAN SELURUH CATATAN</strong> di buku kas harian (menjadi 0 transaksi dan saldo Rp 0) sehingga tampilan buku kas tidak penuh.
                  </p>
                  <p className="text-zinc-400 text-[11px]">
                    ✓ Gunakan fitur ini jika Anda sudah mencetak laporan JPG atau membagikannya ke WhatsApp.
                    <br />
                    ✓ Perubahan ini otomatis tersinkronisasi di tampilan Pemilik maupun Admin.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="py-2.5 px-4 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteResetBook}
                    className="min-h-[44px] py-2.5 px-5 rounded-xl font-extrabold text-xs text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950/50 transition-all active:scale-95 cursor-pointer"
                  >
                    Ya, Kosongkan &amp; Reset Buku Kas
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
