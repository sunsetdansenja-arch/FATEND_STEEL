import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatIDR, formatDate, calculateProjectFinance } from '../utils/formatters';
import {
  Printer,
  FileText,
  Building,
  Calendar,
  Layers,
  Package,
  Users,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from 'lucide-react';

export const PrintReportView: React.FC = () => {
  const { projects, inventory, workers, cashflow, session, globalCashBalance } = useApp();

  const [reportMonth, setReportMonth] = useState('09');
  const [reportYear, setReportYear] = useState('2026');

  const monthNames: Record<string, string> = {
    '01': 'Januari',
    '02': 'Februari',
    '03': 'Maret',
    '04': 'April',
    '05': 'Mei',
    '06': 'Juni',
    '07': 'Juli',
    '08': 'Agustus',
    '09': 'September',
    '10': 'Oktober',
    '11': 'November',
    '12': 'Desember',
  };

  // Financial aggregates
  const totalOmsetKontrak = projects.reduce((acc, p) => acc + p.contractValue, 0);
  const totalUangMasuk = cashflow
    .filter((c) => c.type === 'MASUK' || c.type === 'IN')
    .reduce((acc, c) => acc + c.amount, 0);

  const totalBelanjaMaterial = cashflow
    .filter((c) => c.category === 'BELANJA_MATERIAL' || c.category === 'BELANJA_STOK' || c.category === 'BAHAN_PROYEK')
    .reduce((acc, c) => acc + c.amount, 0);

  const totalUpahBorongan = cashflow
    .filter((c) => c.category === 'UPAH_BORONGAN' || c.category === 'BORONGAN_TUKANG')
    .reduce((acc, c) => acc + c.amount, 0);

  const totalOperasional = cashflow
    .filter((c) => c.category === 'OPERASIONAL_BENGKEL' || c.category === 'OPERASIONAL_LAIN' || c.category === 'LISTRIK_WORKSHOP' || c.category === 'GAS_OKSIGEN' || c.category === 'KONSUMSI_HARIAN')
    .reduce((acc, c) => acc + c.amount, 0);

  const totalBiayaKeseluruhan = totalBelanjaMaterial + totalUpahBorongan + totalOperasional;
  const labaBersihOperasional = totalUangMasuk - totalBiayaKeseluruhan;

  const lowStockItems = inventory.filter((i) => i.currentStock <= i.minStock);
  const totalKasbonPekerja = workers.reduce((sum, w) => sum + (w.balance ?? w.currentKasbon ?? 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Control Bar (Hidden when printing) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#16181e] p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="font-industrial text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Printer className="w-6 h-6 text-amber-400" />
            <span>Laporan Operasional & Keuangan Bulanan</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Format laporan resmi siap cetak / simpan PDF untuk arsip pemilik bengkel
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs font-semibold focus:outline-none"
          >
            {Object.entries(monthNames).map(([key, val]) => (
              <option key={key} value={key}>
                {val}
              </option>
            ))}
          </select>

          <select
            value={reportYear}
            onChange={(e) => setReportYear(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs font-semibold focus:outline-none"
          >
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>

          <button
            type="button"
            onClick={handlePrint}
            className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>

      {/* DOCUMENT PREVIEW CONTAINER (Styled cleanly for both dark preview & A4 clean white print) */}
      <div className="printable-report bg-white text-black p-6 sm:p-10 rounded-2xl shadow-xl max-w-4xl mx-auto border border-zinc-300 print:border-none print:shadow-none print:p-0">
        {/* KOP SURAT RESMI */}
        <div className="border-b-4 border-black pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-black text-amber-400 flex items-center justify-center font-bold text-2xl border-2 border-black">
                <Flame className="w-8 h-8 text-amber-400 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="font-industrial text-2xl sm:text-3xl font-extrabold tracking-wider text-black">
                  CV FATEND STEEL
                </h1>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-700">
                  Bengkel Las & Fabrikasi Konstruksi Baja
                </p>
                <p className="text-[11px] text-zinc-600 font-sans">
                  Spesialis: Kanopi, Pagar Minimalis/Tempa, Railing Tangga, Konstruksi Gudang & Teralis
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-zinc-600 font-sans">
              <p className="font-semibold text-black">Workshop:</p>
              <p>Jl. Raya Industri Logam No. 88</p>
              <p>WhatsApp: 0812-3456-7890</p>
            </div>
          </div>
        </div>

        {/* JUDUL LAPORAN */}
        <div className="text-center mb-6">
          <h2 className="font-industrial text-xl font-bold uppercase tracking-wide text-black">
            LAPORAN OPERASIONAL & KEUANGAN BULANAN
          </h2>
          <p className="text-xs text-zinc-600 font-mono mt-0.5">
            Periode: {monthNames[reportMonth]} {reportYear} • Dicetak Tanggal: {formatDate(new Date().toISOString())}
          </p>
        </div>

        {/* 1. RINGKASAN EKSEKUTIF KEUANGAN */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider bg-zinc-100 p-2 border-l-4 border-black mb-3">
            I. Ringkasan Finansial Bengkel
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 border border-zinc-300 rounded-lg">
              <div className="text-zinc-500 text-[10px] uppercase font-bold">Total Omset SPK</div>
              <div className="text-sm font-bold font-mono mt-1 text-black">
                {formatIDR(totalOmsetKontrak)}
              </div>
            </div>

            <div className="p-2.5 border border-zinc-300 rounded-lg">
              <div className="text-zinc-500 text-[10px] uppercase font-bold">Pemasukan Riil (Masuk)</div>
              <div className="text-sm font-bold font-mono mt-1 text-black">
                {formatIDR(totalUangMasuk)}
              </div>
            </div>

            <div className="p-2.5 border border-zinc-300 rounded-lg">
              <div className="text-zinc-500 text-[10px] uppercase font-bold">Total Beban Operasional</div>
              <div className="text-sm font-bold font-mono mt-1 text-black">
                {formatIDR(totalBiayaKeseluruhan)}
              </div>
            </div>

            <div className="p-2.5 border border-black bg-zinc-50 rounded-lg">
              <div className="text-zinc-700 text-[10px] uppercase font-bold">Laba Bersih Riil</div>
              <div className="text-sm font-bold font-mono mt-1 text-black">
                {formatIDR(labaBersihOperasional)}
              </div>
            </div>
          </div>
        </div>

        {/* 2. REKAP PROYEK BENGKEL */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider bg-zinc-100 p-2 border-l-4 border-black mb-3">
            II. Status Pengerjaan Proyek & Nilai Kontrak
          </h3>
          <table className="w-full text-left text-xs border-collapse border border-zinc-300">
            <thead className="bg-zinc-100 text-black font-bold">
              <tr>
                <th className="p-2 border border-zinc-300">Nama Proyek</th>
                <th className="p-2 border border-zinc-300">Klien</th>
                <th className="p-2 border border-zinc-300 text-center">Status</th>
                <th className="p-2 border border-zinc-300 text-center">Progres</th>
                <th className="p-2 border border-zinc-300 text-right">Nilai SPK</th>
                <th className="p-2 border border-zinc-300 text-right">Sisa Tagihan</th>
                <th className="p-2 border border-zinc-300 text-right">Est. Laba</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const fin = calculateProjectFinance(p);
                return (
                  <tr key={p.id}>
                    <td className="p-2 border border-zinc-300 font-medium">{p.name}</td>
                    <td className="p-2 border border-zinc-300 text-zinc-700">{p.clientName}</td>
                    <td className="p-2 border border-zinc-300 text-center font-bold text-[10px]">
                      {p.status}
                    </td>
                    <td className="p-2 border border-zinc-300 text-center font-mono font-bold">
                      {p.progress}%
                    </td>
                    <td className="p-2 border border-zinc-300 text-right font-mono">
                      {formatIDR(p.contractValue)}
                    </td>
                    <td className="p-2 border border-zinc-300 text-right font-mono font-bold">
                      {formatIDR(fin.remainingBill)}
                    </td>
                    <td className="p-2 border border-zinc-300 text-right font-mono font-bold">
                      {formatIDR(fin.estimatedProfit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 3. REKAP STOK & PERINGATAN STOK MENIPIS */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider bg-zinc-100 p-2 border-l-4 border-black mb-3">
            III. Status Stok Kritis & Kebutuhan Restock
          </h3>
          {lowStockItems.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">Semua stok inventori dalam kondisi aman.</p>
          ) : (
            <table className="w-full text-left text-xs border-collapse border border-zinc-300">
              <thead className="bg-zinc-100 text-black font-bold">
                <tr>
                  <th className="p-2 border border-zinc-300">Kode</th>
                  <th className="p-2 border border-zinc-300">Nama Material / Consumable</th>
                  <th className="p-2 border border-zinc-300">Kategori</th>
                  <th className="p-2 border border-zinc-300 text-center">Stok Fisik</th>
                  <th className="p-2 border border-zinc-300 text-center">Batas Minimum</th>
                  <th className="p-2 border border-zinc-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item) => (
                  <tr key={item.id}>
                    <td className="p-2 border border-zinc-300 font-mono">{item.sku}</td>
                    <td className="p-2 border border-zinc-300 font-medium">{item.name}</td>
                    <td className="p-2 border border-zinc-300 uppercase text-[10px]">
                      {item.category}
                    </td>
                    <td className="p-2 border border-zinc-300 text-center font-mono font-bold text-red-600">
                      {item.currentStock} {item.unit}
                    </td>
                    <td className="p-2 border border-zinc-300 text-center font-mono">
                      {item.minStock} {item.unit}
                    </td>
                    <td className="p-2 border border-zinc-300 font-bold text-[10px] text-red-600">
                      {item.currentStock === 0 ? 'HABIS (0)' : 'PERLU RESTOCK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 4. REKAP KASBON PEKERJA */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider bg-zinc-100 p-2 border-l-4 border-black mb-3">
            IV. Rekap Saldo Kasbon Tenaga Kerja (Total: {formatIDR(totalKasbonPekerja)})
          </h3>
          <table className="w-full text-left text-xs border-collapse border border-zinc-300">
            <thead className="bg-zinc-100 text-black font-bold">
              <tr>
                <th className="p-2 border border-zinc-300">Nama Pekerja</th>
                <th className="p-2 border border-zinc-300">Peran / Keahlian</th>
                <th className="p-2 border border-zinc-300 text-right">Saldo Kasbon Aktif</th>
                <th className="p-2 border border-zinc-300 text-center">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td className="p-2 border border-zinc-300 font-medium">{w.name}</td>
                  <td className="p-2 border border-zinc-300 text-zinc-600">{w.role}</td>
                  <td className="p-2 border border-zinc-300 text-right font-mono font-bold">
                    {formatIDR(w.balance ?? w.currentKasbon ?? 0)}
                  </td>
                  <td className="p-2 border border-zinc-300 text-center text-[10px]">
                    {(w.balance ?? w.currentKasbon ?? 0) > 0 ? 'Wajib Potong Upah Borongan' : 'Lunas (Tidak Ada Hutang)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* LEMBAR PENGESAHAN TANDA TANGAN */}
        <div className="pt-8 border-t border-zinc-300 grid grid-cols-2 text-center text-xs">
          <div>
            <p className="text-zinc-600">Dibuat oleh,</p>
            <p className="font-bold text-black uppercase mt-0.5">Admin Operasional</p>
            <div className="h-16 flex items-end justify-center">
              <div className="border-b border-black w-40 text-center text-[10px] text-zinc-400 pb-0.5">
                ( Tanda Tangan & Nama Terang )
              </div>
            </div>
          </div>

          <div>
            <p className="text-zinc-600">Mengetahui & Menyetujui,</p>
            <p className="font-bold text-black uppercase mt-0.5">Pemilik CV FATEND STEEL</p>
            <div className="h-16 flex items-end justify-center">
              <div className="border-b border-black w-40 text-center text-[10px] text-zinc-400 pb-0.5">
                ( Tanda Tangan & Cap Bengkel )
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
