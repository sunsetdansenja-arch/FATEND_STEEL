import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CashflowRecord, CashflowCategory } from '../types';
import { formatIDR, formatDate, calculateProjectFinance } from '../utils/formatters';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Plus,
  Search,
  Lock,
  X,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export const CashflowView: React.FC = () => {
  const {
    cashflow,
    projects,
    session,
    addCashflowRecord,
    deleteCashflowRecord,
    clearAllCashflow,
    closePeriodAndZeroCash,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'GLOBAL' | 'PROJECTS'>('GLOBAL');
  const [filterType, setFilterType] = useState<'ALL' | 'MASUK' | 'KELUAR'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // New Transaction modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [txType, setTxType] = useState<'MASUK' | 'KELUAR'>('KELUAR');
  const [txCategory, setTxCategory] = useState<CashflowCategory>('OPERASIONAL_LAIN');
  const [txAmount, setTxAmount] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [txProjectId, setTxProjectId] = useState('');

  // Zero Cashflow / Tutup Buku Modal
  const [showZeroModal, setShowZeroModal] = useState(false);
  const [zeroMethod, setZeroMethod] = useState<'WITHDRAWAL' | 'CLEAR_ALL'>('WITHDRAWAL');
  const [zeroNotes, setZeroNotes] = useState('');
  const [zeroNotice, setZeroNotice] = useState<string | null>(null);

  // In-App Deletion and Toast
  const [recordToDelete, setRecordToDelete] = useState<CashflowRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const isPemilik = session?.role === 'PEMILIK';

  // Calculations
  const totalIncome = cashflow
    .filter((tx) => tx.type === 'MASUK')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpense = cashflow
    .filter((tx) => tx.type === 'KELUAR')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Filtered transactions
  const filteredTransactions = cashflow.filter((tx) => {
    const matchesType = filterType === 'ALL' || tx.type === filterType;
    const matchesSearch =
      (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tx.referenceProjectName && tx.referenceProjectName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      tx.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || !txNotes) return;
    const parsed = parseInt(txAmount.replace(/\D/g, ''), 10) || 0;

    const targetPrj = txProjectId ? projects.find((p) => p.id === txProjectId) : null;

    addCashflowRecord({
      date: new Date().toISOString().split('T')[0],
      type: txType,
      category: txCategory,
      amount: parsed,
      referenceProjectId: txProjectId || undefined,
      referenceProjectName: targetPrj?.name,
      notes: txNotes,
    });

    setTxAmount('');
    setTxNotes('');
    setTxProjectId('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#16181e] p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="font-industrial text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-amber-400" />
            <span>Arus Kas & Finansial Bengkel</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Laporan uang masuk termin klien, belanja bahan, upah borongan, serta biaya operasional bengkel
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Subtabs */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('GLOBAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'GLOBAL'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Kas Global
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PROJECTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'PROJECTS'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Per Proyek
            </button>
          </div>

            <button
              type="button"
              onClick={() => {
                setZeroNotice(null);
                setShowZeroModal(true);
              }}
              className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="Tutup Buku Periode & Nolkan Saldo Kas (Rp 0)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Tutup Buku / Nolkan Kas</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">Catat Kas</span>
            </button>
        </div>
      </div>

      {/* Admin Privacy Alert Notice */}
      {!isPemilik && (
        <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-blue-300">
            <Lock className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Anda login sebagai <strong>Admin Operasional</strong>. Laba bersih dan saldo kas global disamarkan untuk privasi pemilik.
            </span>
          </div>
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[#16181e] border border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
              Total Uang Masuk (Pemasukan)
            </span>
            <span className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono-num mt-0.5 block">
              {formatIDR(totalIncome)}
            </span>
            <span className="text-[10px] text-zinc-400">Termin SPK & Pemasukan Bengkel</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-400 flex items-center justify-center">
            <ArrowDownLeft className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#16181e] border border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
              Total Uang Keluar (Beban)
            </span>
            <span className="text-xl sm:text-2xl font-bold text-red-400 font-mono-num mt-0.5 block">
              {formatIDR(totalExpense)}
            </span>
            <span className="text-[10px] text-zinc-400">Material, Borongan & Operasional</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center">
            <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#16181e] border border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
              Saldo Kas Aktif (Net Cash)
            </span>
            <span
              className={`text-xl sm:text-2xl font-bold font-mono-num mt-0.5 block ${
                !isPemilik
                  ? 'text-zinc-500 filter blur-[2px]'
                  : netBalance >= 0
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              {isPemilik ? formatIDR(netBalance) : 'Rp ••••••••'}
            </span>
            <span className="text-[10px] text-zinc-400">
              {isPemilik ? 'Likuiditas Kas Bengkel' : 'Terkunci (Akses Pemilik)'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* VIEW 1: KAS GLOBAL LOG */}
      {activeTab === 'GLOBAL' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari transaksi kas, proyek, atau keterangan..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#14151a] border border-zinc-800 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1">
              {[
                { key: 'ALL', label: 'Semua Kas' },
                { key: 'MASUK', label: 'Pemasukan (+)' },
                { key: 'KELUAR', label: 'Pengeluaran (-)' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterType(tab.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterType === tab.key
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions Table */}
          <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-[#16181e]">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 text-zinc-400 font-semibold border-b border-zinc-800">
                <tr>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Deskripsi Transaksi</th>
                  <th className="p-3">Terkait Proyek</th>
                  <th className="p-3 text-right">Nominal (Rp)</th>
                  <th className="p-3 text-center w-12">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-zinc-500 italic">
                      Tidak ada transaksi kas yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-zinc-800/30">
                      <td className="p-3 font-mono text-zinc-400">{formatDate(tx.date)}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.type === 'MASUK'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-red-950 text-red-300 border border-red-800'
                          }`}
                        >
                          {tx.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-white">{tx.notes || '-'}</td>
                      <td className="p-3 text-zinc-400">
                        {tx.referenceProjectName ? (
                          <span className="text-amber-400/90 font-medium">{tx.referenceProjectName}</span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td
                        className={`p-3 text-right font-mono font-bold ${
                          tx.type === 'MASUK' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {tx.type === 'MASUK' ? `+${formatIDR(tx.amount)}` : `-${formatIDR(tx.amount)}`}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setRecordToDelete(tx)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/15 transition-all cursor-pointer"
                          title="Hapus Transaksi Kas Ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: ARUS KAS PER PROYEK */}
      {activeTab === 'PROJECTS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {projects.map((prj) => {
              const fin = calculateProjectFinance(prj);

              return (
                <div
                  key={prj.id}
                  className="p-4 rounded-2xl bg-[#16181e] border border-zinc-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {prj.status}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        Progres: {prj.progress}%
                      </span>
                    </div>

                    <h4 className="font-industrial text-base font-bold text-white line-clamp-1">
                      {prj.name}
                    </h4>
                    <p className="text-xs text-zinc-400">{prj.clientName}</p>

                    {/* Breakdown table */}
                    <div className="mt-3.5 space-y-1.5 text-xs font-mono bg-black/40 p-3 rounded-xl border border-zinc-800/80">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Nilai Kontrak:</span>
                        <span className="font-bold text-amber-400">{formatIDR(fin.contractValue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Uang Masuk (DP/Termin):</span>
                        <span className="font-bold text-emerald-400">{formatIDR(fin.totalPaidIn)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Sisa Tagihan:</span>
                        <span className="font-bold text-red-400">{formatIDR(fin.remainingBill)}</span>
                      </div>
                      <div className="border-t border-zinc-800 pt-1 flex justify-between">
                        <span className="text-zinc-400">Beban Bahan:</span>
                        <span className="text-zinc-300">{formatIDR(fin.materialsCost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Beban Borongan (1.2×):</span>
                        <span className="text-zinc-300">{formatIDR(fin.wagesCost)}</span>
                      </div>
                      <div className="border-t border-zinc-800 pt-1 flex justify-between font-bold">
                        <span className="text-zinc-300">Estimasi Laba:</span>
                        <span
                          className={
                            !isPemilik
                              ? 'text-zinc-500 filter blur-[2px]'
                              : fin.estimatedProfit >= 0
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }
                        >
                          {isPemilik ? formatIDR(fin.estimatedProfit) : 'Rp ••••••••'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL CATAT TRANSAKSI KAS BARU */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#181a20] border border-amber-500/40 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-400" />
                <span>Catat Transaksi Kas Baru</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-3">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Jenis Arus Kas *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('MASUK');
                      setTxCategory('PEMBAYARAN_PROYEK');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      txType === 'MASUK'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>Pemasukan (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTxType('KELUAR');
                      setTxCategory('OPERASIONAL_LAIN');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      txType === 'KELUAR'
                        ? 'bg-red-500/20 border-red-500 text-red-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Pengeluaran (-)</span>
                  </button>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Kategori Transaksi *
                </label>
                <select
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                >
                  {txType === 'MASUK' ? (
                    <>
                      <option value="PEMBAYARAN_PROYEK">Pemasukan Proyek (Termin/DP)</option>
                      <option value="MODAL_PEMILIK">Modal Masuk Pemilik</option>
                      <option value="PENDAPATAN_LAIN">Pendapatan Lain / Scrap Besi</option>
                    </>
                  ) : (
                    <>
                      <option value="OPERASIONAL_LAIN">Operasional Umum Bengkel</option>
                      <option value="LISTRIK_WORKSHOP">Listrik & Air Workshop</option>
                      <option value="GAS_OKSIGEN">Gas Oksigen & Argon</option>
                      <option value="KONSUMSI_HARIAN">Konsumsi / Snack Lembur</option>
                      <option value="PERAWATAN_MESIN">Perawatan & Sparepart Mesin Las</option>
                      <option value="SEWA_BENGKEL">Sewa Tempat Bengkel</option>
                      <option value="BELANJA_STOK">Belanja Stok Gudang</option>
                      <option value="BAHAN_PROYEK">Bahan Proyek Luar</option>
                      <option value="BORONGAN_TUKANG">Upah Borongan & Helper</option>
                      <option value="KASBON_PEKERJA">Kasbon Pekerja</option>
                      <option value="PENARIKAN_LABA_PEMILIK">Penarikan Laba Pemilik / Prive</option>
                      <option value="TUTUP_BUKU">Tutup Buku Kas Periode</option>
                    </>
                  )}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nominal (Rp) *
                </label>
                <input
                  type="text"
                  value={txAmount}
                  onChange={(e) => {
                    const num = e.target.value.replace(/\D/g, '');
                    setTxAmount(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                  }}
                  placeholder="Contoh: 350.000"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-amber-400 font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Deskripsi / Keterangan *
                </label>
                <input
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="Contoh: Pembelian gas Argon 1 tabung & konsumsi lembur"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              {/* Project association (optional) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Hubungkan ke Proyek (Opsional)
                </label>
                <select
                  value={txProjectId}
                  onChange={(e) => setTxProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Tidak Terikat Proyek Spesifik --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md shadow-amber-500/20"
                >
                  Simpan Kas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2.5 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl font-bold text-xs border border-emerald-400/40 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PER BARIS */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#181a20] border border-red-500/40 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-red-400">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Hapus Transaksi Kas?</h3>
                  <p className="text-xs text-zinc-400">Tindakan ini akan menghapus catatan kas terpilih</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Detail Transaksi yang akan dihapus */}
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Tanggal:</span>
                <span className="font-semibold text-zinc-200">{formatDate(recordToDelete.date)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Kategori:</span>
                <span className="font-semibold text-amber-400">{recordToDelete.category.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Nominal:</span>
                <span
                  className={`font-mono font-bold ${
                    recordToDelete.type === 'MASUK' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {recordToDelete.type === 'MASUK'
                    ? `+${formatIDR(recordToDelete.amount)}`
                    : `-${formatIDR(recordToDelete.amount)}`}
                </span>
              </div>
              {recordToDelete.referenceProjectName && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Proyek Terkait:</span>
                  <span className="font-medium text-amber-400/90">{recordToDelete.referenceProjectName}</span>
                </div>
              )}
              {recordToDelete.notes && (
                <div className="pt-2 border-t border-zinc-800">
                  <span className="text-zinc-400 block mb-0.5">Keterangan:</span>
                  <p className="text-zinc-300 italic">{recordToDelete.notes}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCashflowRecord(recordToDelete.id);
                  setRecordToDelete(null);
                  showToast('Transaksi kas berhasil dihapus.');
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30 transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TUTUP BUKU & NOLKAN KAS (RP 0) */}
      {showZeroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#181a20] border border-amber-500/40 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Tutup Buku & Nolkan Kas</h3>
                  <p className="text-xs text-zinc-400">Reset saldo kas aktif menjadi Rp 0 untuk periode baru</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowZeroModal(false);
                  setZeroNotice(null);
                }}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Balance Summary Box */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                  Saldo Kas Aktif Saat Ini
                </span>
                <span className={`text-2xl font-black font-mono-num ${netBalance >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {formatIDR(netBalance)}
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">
                  Masuk: <strong className="text-emerald-400">{formatIDR(totalIncome)}</strong> | Keluar: <strong className="text-red-400">{formatIDR(totalExpense)}</strong>
                </span>
              </div>
              <div className="text-right text-xs text-zinc-400">
                <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 font-mono text-[11px] font-bold">
                  {cashflow.length} Transaksi
                </span>
              </div>
            </div>

            {/* Method Choice Tabs */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-300">
                Pilih Cara Penolkan Kas:
              </label>

              {/* Option 1: Accounting withdrawal (Recommended) */}
              <div
                onClick={() => setZeroMethod('WITHDRAWAL')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  zeroMethod === 'WITHDRAWAL'
                    ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/30'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="zeroMethod"
                    checked={zeroMethod === 'WITHDRAWAL'}
                    onChange={() => setZeroMethod('WITHDRAWAL')}
                    className="mt-0.5 text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        Opsi 1: Tarik Sisa Saldo ke Rp 0 (Tutup Buku)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Disarankan
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      Sisa saldo kas sebesar <strong>{formatIDR(Math.abs(netBalance))}</strong> dicatat keluar sebagai <em>"Penarikan Laba Pemilik / Tutup Buku Periode"</em>.
                    </p>
                    <p className="text-[11px] text-emerald-400/90 mt-1 font-medium">
                      ✓ Saldo kas otomatis menjadi <strong>Rp 0</strong>, dan semua riwayat belanja/nota lalu <strong>tetap tersimpan utuh</strong> sebagai arsip resmi.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 2: Clear all history */}
              <div
                onClick={() => setZeroMethod('CLEAR_ALL')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  zeroMethod === 'CLEAR_ALL'
                    ? 'bg-red-500/10 border-red-500/60 ring-1 ring-red-500/30'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="zeroMethod"
                    checked={zeroMethod === 'CLEAR_ALL'}
                    onChange={() => setZeroMethod('CLEAR_ALL')}
                    className="mt-0.5 text-red-500 focus:ring-red-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        Opsi 2: Kosongkan Seluruh Riwayat Kas
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400">
                        Reset Total
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      Menghapus seluruh daftar transaksi kas yang ada di tabel. Saldo kas langsung kembali Rp 0 dan tabel kas kosong bersih.
                    </p>
                    <p className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Gunakan ini jika Anda ingin memulai lembaran kas baru dari awal tanpa catatan periode sebelumnya.</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Notes for Method 1 */}
            {zeroMethod === 'WITHDRAWAL' && (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Keterangan Tutup Buku (Opsional)
                </label>
                <input
                  type="text"
                  value={zeroNotes}
                  onChange={(e) => setZeroNotes(e.target.value)}
                  placeholder={`Contoh: Tutup Buku & Penarikan Laba Periode ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
            )}

            {/* Actions (NO window.confirm, 100% reliable inside iframes) */}
            <div className="flex gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setShowZeroModal(false);
                  setZeroNotice(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (zeroMethod === 'WITHDRAWAL') {
                    if (netBalance === 0) {
                      setShowZeroModal(false);
                      showToast('Saldo kas Anda saat ini sudah tepat Rp 0.');
                      return;
                    }
                    const noteText =
                      zeroNotes.trim() ||
                      `Tutup Buku Periode: Penarikan Sisa Saldo Kas (${new Date().toLocaleDateString('id-ID', {
                        month: 'long',
                        year: 'numeric',
                      })})`;
                    const res = closePeriodAndZeroCash(noteText);
                    setShowZeroModal(false);
                    setZeroNotes('');
                    showToast(
                      `Tutup buku sukses! Saldo kas sebesar ${formatIDR(
                        Math.abs(res.amount)
                      )} telah ditarik dan saldo kini tepat Rp 0.`
                    );
                  } else {
                    // Opsi 2: Kosongkan seluruh riwayat kas
                    clearAllCashflow();
                    setShowZeroModal(false);
                    showToast('Sukses! Seluruh riwayat transaksi kas telah dikosongkan. Saldo kas kembali Rp 0.');
                  }
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95 ${
                  zeroMethod === 'WITHDRAWAL'
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>
                  {zeroMethod === 'WITHDRAWAL' ? 'Tutup Buku & Nolkan Saldo (Rp 0)' : 'Kosongkan Riwayat Kas Sekarang'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
