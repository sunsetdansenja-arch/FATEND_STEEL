import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { KasbonWorker } from '../types';
import { formatIDR, formatDate } from '../utils/formatters';
import {
  Users,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  DollarSign,
  Phone,
  X,
} from 'lucide-react';

export const WagesAndKasbonView: React.FC = () => {
  const {
    workers,
    projects,
    session,
    addWorker,
    addKasbonTx,
    payLaborWage,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'BORONGAN' | 'KASBON'>('BORONGAN');

  // New Worker Modal
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [workerRole, setWorkerRole] = useState('Tukang Las Konstruksi');
  const [workerPhone, setWorkerPhone] = useState('');

  // Kasbon Action Modal (Pinjam Kasbon vs Bayar Pelunasan)
  const [kasbonModalType, setKasbonModalType] = useState<'PINJAM' | 'BAYAR_CICILAN' | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [kasbonAmount, setKasbonAmount] = useState('');
  const [kasbonNotes, setKasbonNotes] = useState('');

  // Borongan payment state
  const [payWagePrjId, setPayWagePrjId] = useState<string | null>(null);
  const [payWageId, setPayWageId] = useState<string | null>(null);
  const [payWageAmount, setPayWageAmount] = useState('');

  const isPemilik = session?.role === 'PEMILIK';

  // Summaries
  const totalActiveKasbon = workers.reduce((sum, w) => sum + (w.balance ?? 0), 0);

  // All project wages aggregated
  const allProjectWages = projects.flatMap((p) =>
    (p.wages || []).map((w) => ({
      ...w,
      projectId: p.id,
      projectName: p.name,
      clientName: p.clientName,
    }))
  );

  // All kasbon transactions aggregated across workers
  const allKasbonTxs = workers.flatMap((w) =>
    (w.transactions || []).map((tx) => ({
      ...tx,
      workerName: w.name,
    }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName) return;
    addWorker({
      name: workerName,
      role: workerRole,
      phone: workerPhone,
    });
    setWorkerName('');
    setWorkerPhone('');
    setShowAddWorkerModal(false);
  };

  const handleKasbonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId || !kasbonAmount || !kasbonModalType) return;
    const parsed = parseInt(kasbonAmount.replace(/\D/g, ''), 10) || 0;

    addKasbonTx(selectedWorkerId, kasbonModalType, parsed, kasbonNotes);

    setKasbonModalType(null);
    setSelectedWorkerId('');
    setKasbonAmount('');
    setKasbonNotes('');
  };

  const handleConfirmPayWage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payWagePrjId || !payWageId || !payWageAmount) return;
    const parsed = parseInt(payWageAmount.replace(/\D/g, ''), 10) || 0;
    payLaborWage(payWagePrjId, payWageId, parsed);
    setPayWagePrjId(null);
    setPayWageId(null);
    setPayWageAmount('');
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#16181e] p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="font-industrial text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            <span>Upah Borongan & Kasbon Pekerja</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Perhitungan borongan bengkel (Helper 20%, total 1.2×) serta pencatatan kasbon tukang
          </p>
        </div>

        {/* Subtab Buttons */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveSubTab('BORONGAN')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'BORONGAN'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Borongan Proyek
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('KASBON')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'KASBON'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Kasbon Pekerja
          </button>
        </div>
      </div>

      {/* SECTION 1: BORONGAN PROYEK */}
      {activeSubTab === 'BORONGAN' && (
        <div className="space-y-4">
          {/* Rule Card banner */}
          <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-sm">
                1.2×
              </div>
              <div>
                <span className="font-bold text-white text-xs sm:text-sm">
                  Aturan Rumus Borongan CV FATEND STEEL
                </span>
                <p className="text-[11px] text-zinc-300">
                  Helper otomatis dihitung <strong>20%</strong> dari upah tukang. Total beban = Upah Tukang × 1,2.
                </p>
              </div>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-zinc-500 uppercase block">Total Rekap Borongan</span>
              <span className="font-mono-num font-bold text-amber-400 text-sm">
                {formatIDR(allProjectWages.reduce((sum, w) => sum + w.totalWage, 0))}
              </span>
            </div>
          </div>

          {/* Wages List */}
          {allProjectWages.length === 0 ? (
            <div className="p-8 text-center bg-[#16181e] rounded-2xl border border-dashed border-zinc-800 text-zinc-500 text-xs">
              Belum ada data borongan pada proyek yang dibuat.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {allProjectWages.map((w) => (
                <div
                  key={w.id}
                  className="p-4 rounded-2xl bg-[#16181e] border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Project Name & Status */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-amber-400 line-clamp-1">
                        Proyek: {w.projectName}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          w.status === 'LUNAS'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border-amber-800'
                        }`}
                      >
                        {w.status}
                      </span>
                    </div>

                    <h4 className="font-industrial text-base font-bold text-white">
                      {w.tukangName}
                      <span className="text-zinc-400 text-xs font-normal ml-1">
                        + {w.helperName || 'Helper'}
                      </span>
                    </h4>

                    {/* Breakdown Math Box */}
                    <div className="mt-3 p-3 rounded-xl bg-black/40 border border-zinc-800/80 grid grid-cols-3 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Upah Tukang</span>
                        <span className="font-semibold text-zinc-200">{formatIDR(w.baseWage)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Helper (20%)</span>
                        <span className="font-semibold text-amber-400/90">{formatIDR(w.helperWage)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Total (1.2×)</span>
                        <span className="font-bold text-amber-400">{formatIDR(w.totalWage)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-400 mt-3 font-mono">
                      <span>
                        Sudah Dibayar: <strong className="text-emerald-400">{formatIDR(w.paidAmount)}</strong>
                      </span>
                      <span>
                        Sisa: <strong className="text-red-400">{formatIDR(w.totalWage - w.paidAmount)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Payment Button */}
                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-end gap-2">
                    {w.status !== 'LUNAS' && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayWagePrjId(w.projectId);
                          setPayWageId(w.id);
                          setPayWageAmount((w.totalWage - w.paidAmount).toLocaleString('id-ID'));
                        }}
                        className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Bayar Borongan</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: KASBON PEKERJA */}
      {activeSubTab === 'KASBON' && (
        <div className="space-y-4">
          {/* Header Summary & Add Worker */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                Total Kasbon Aktif (Bengkel)
              </span>
              <span className="text-lg sm:text-xl font-bold text-red-400 font-mono-num mt-0.5 block">
                {formatIDR(totalActiveKasbon)}
              </span>
              <span className="text-[10px] text-zinc-400">
                Piutang pinjaman {workers.filter((w) => w.balance > 0).length} pekerja
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                Jumlah Pekerja Terdaftar
              </span>
              <span className="text-lg sm:text-xl font-bold text-white font-mono-num mt-0.5 block">
                {workers.length} Orang
              </span>
              <span className="text-[10px] text-zinc-400">Tukang las, helper & finisher</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Pekerja Baru?</span>
                <span className="text-[10px] text-zinc-400">Daftarkan tenaga las</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWorkerModal(true)}
                className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1 shadow-md shadow-amber-500/20"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Tambah</span>
              </button>
            </div>
          </div>

          {/* Worker Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {workers.map((worker) => (
              <div
                key={worker.id}
                className="p-4 rounded-2xl bg-[#16181e] border border-zinc-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-industrial text-base font-bold text-white">
                        {worker.name}
                      </h4>
                      <p className="text-xs text-amber-400 font-medium mt-0.5">{worker.role}</p>
                      {worker.phone && (
                        <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-zinc-500" />
                          <span>{worker.phone}</span>
                        </p>
                      )}
                    </div>

                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                        worker.balance > 0
                          ? 'bg-red-950 text-red-400 border-red-800'
                          : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      }`}
                    >
                      {worker.balance > 0 ? 'Ada Kasbon' : 'Bersih (0)'}
                    </span>
                  </div>

                  {/* Kasbon Amount Box */}
                  <div className="mt-3 p-3 rounded-xl bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                      Saldo Kasbon Saat Ini
                    </span>
                    <span
                      className={`text-lg font-bold font-mono-num ${
                        worker.balance > 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {formatIDR(worker.balance)}
                    </span>
                  </div>
                </div>

                {/* Actions: Pinjam vs Bayar Kasbon */}
                <div className="mt-4 pt-3 border-t border-zinc-800/80 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWorkerId(worker.id);
                      setKasbonModalType('PINJAM');
                    }}
                    className="py-1.5 px-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-800/60 text-red-300 text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Pinjam Kasbon</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWorkerId(worker.id);
                      setKasbonModalType('BAYAR_CICILAN');
                      setKasbonAmount(worker.balance.toLocaleString('id-ID'));
                    }}
                    className="py-1.5 px-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Cicil / Lunas</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Riwayat Mutasi Kasbon */}
          <div className="mt-6 space-y-3">
            <h3 className="font-industrial text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Riwayat Pinjaman & Pelunasan Kasbon</span>
            </h3>

            <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 text-zinc-400 font-semibold border-b border-zinc-800">
                  <tr>
                    <th className="p-2.5">Tanggal</th>
                    <th className="p-2.5">Nama Pekerja</th>
                    <th className="p-2.5">Jenis Transaksi</th>
                    <th className="p-2.5">Catatan</th>
                    <th className="p-2.5 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {allKasbonTxs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-zinc-500 italic">
                        Belum ada riwayat transaksi kasbon.
                      </td>
                    </tr>
                  ) : (
                    allKasbonTxs.map((tx) => (
                      <tr key={tx.id} className="hover:bg-zinc-800/40">
                        <td className="p-2.5 font-mono text-zinc-400">{formatDate(tx.date)}</td>
                        <td className="p-2.5 font-medium text-white">{tx.workerName}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.type === 'PINJAM'
                                ? 'bg-red-950 text-red-300 border border-red-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {tx.type === 'PINJAM' ? 'PINJAM KASBON' : 'CICIL / PELUNASAN'}
                          </span>
                        </td>
                        <td className="p-2.5 text-zinc-400">{tx.notes || '-'}</td>
                        <td
                          className={`p-2.5 text-right font-mono font-bold ${
                            tx.type === 'PINJAM' ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {tx.type === 'PINJAM' ? `-${formatIDR(tx.amount)}` : `+${formatIDR(tx.amount)}`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PEKERJA */}
      {showAddWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#181a20] border border-amber-500/40 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Tambah Pekerja Bengkel</h3>
              <button
                type="button"
                onClick={() => setShowAddWorkerModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddWorker} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nama Pekerja *
                </label>
                <input
                  type="text"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  placeholder="Contoh: Mas Agus Santoso"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Posisi / Peran
                </label>
                <select
                  value={workerRole}
                  onChange={(e) => setWorkerRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                >
                  <option value="Tukang Las Senior">Tukang Las Senior (Master Welder)</option>
                  <option value="Tukang Las Konstruksi">Tukang Las Konstruksi</option>
                  <option value="Helper Bengkel">Helper / Asisten Las</option>
                  <option value="Finisher / Cat Duco">Finisher / Cat Duco</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  No. Handphone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={workerPhone}
                  onChange={(e) => setWorkerPhone(e.target.value)}
                  placeholder="0813-xxxx-xxxx"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddWorkerModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow"
                >
                  Simpan Pekerja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PINJAM / BAYAR KASBON */}
      {kasbonModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#181a20] border border-amber-500/40 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">
                {kasbonModalType === 'PINJAM' ? 'Catat Pinjaman Kasbon' : 'Catat Pembayaran Kasbon'}
              </h3>
              <button
                type="button"
                onClick={() => setKasbonModalType(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Pekerja:{' '}
              <strong className="text-amber-400">
                {workers.find((w) => w.id === selectedWorkerId)?.name}
              </strong>
            </p>

            <form onSubmit={handleKasbonSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nominal (Rp) *
                </label>
                <input
                  type="text"
                  value={kasbonAmount}
                  onChange={(e) => {
                    const num = e.target.value.replace(/\D/g, '');
                    setKasbonAmount(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                  }}
                  placeholder="Contoh: 200.000"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-amber-400 font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Keterangan / Keperluan
                </label>
                <input
                  type="text"
                  value={kasbonNotes}
                  onChange={(e) => setKasbonNotes(e.target.value)}
                  placeholder={
                    kasbonModalType === 'PINJAM'
                      ? 'Contoh: Kasbon darurat keluarga'
                      : 'Contoh: Potong upah mingguan / setor tunai'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setKasbonModalType(null)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs text-white shadow ${
                    kasbonModalType === 'PINJAM'
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {kasbonModalType === 'PINJAM' ? 'Catat Pinjam' : 'Konfirmasi Bayar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BAYAR BORONGAN */}
      {payWageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#181a20] border border-emerald-500/40 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white text-sm">Pembayaran Upah Borongan</h3>
            <p className="text-xs text-zinc-400">
              Uang yang dibayarkan akan langsung memotong sisa borongan dan tercatat otomatis di Arus Kas.
            </p>

            <form onSubmit={handleConfirmPayWage} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nominal Pembayaran (Rp)
                </label>
                <input
                  type="text"
                  value={payWageAmount}
                  onChange={(e) => {
                    const num = e.target.value.replace(/\D/g, '');
                    setPayWageAmount(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-emerald-400 font-mono font-bold text-sm focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPayWagePrjId(null);
                    setPayWageId(null);
                  }}
                  className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  Konfirmasi Bayar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
