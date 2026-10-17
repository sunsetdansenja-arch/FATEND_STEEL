import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { InventoryItem, StockCategory } from '../types';
import { formatIDR, formatDate } from '../utils/formatters';
import {
  Package,
  Plus,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  X,
  Clock,
  CheckCircle2,
  Trash2,
  FileSpreadsheet,
  Building,
  RotateCcw,
  Edit3,
  PenLine,
  Layers,
  Sparkles,
  Boxes,
  Check,
  Table,
  RefreshCw,
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export const StockView: React.FC = () => {
  const {
    inventory,
    mutations,
    session,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    restockItem,
    adjustStock,
    forceDownloadFromCloud,
  } = useApp();

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const handleManualSyncCloud = async () => {
    setIsSyncingCloud(true);
    setSyncNotice(null);
    try {
      const ok = await forceDownloadFromCloud();
      if (ok) {
        setSyncNotice('✅ Data stok berhasil disinkronkan dengan Cloud Firestore!');
      } else {
        setSyncNotice('⚠️ Tidak dapat terhubung ke Cloud. Pastikan koneksi internet stabil.');
      }
    } catch (e: any) {
      setSyncNotice('❌ Gagal sinkronisasi: ' + (e?.message || 'Error'));
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setSyncNotice(null), 4000);
    }
  };

  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'material' | 'consumable' | 'LOW_STOCK'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [restockItemId, setRestockItemId] = useState<string | null>(null);
  const [adjustItemId, setAdjustItemId] = useState<string | null>(null);
  const [stockCardItemId, setStockCardItemId] = useState<string | null>(null);

  // Edit Item form state
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemSku, setEditItemSku] = useState('');
  const [editItemCategory, setEditItemCategory] = useState<StockCategory>('material');
  const [editItemUnit, setEditItemUnit] = useState('Batang');
  const [editItemMinStock, setEditItemMinStock] = useState('2');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemLocation, setEditItemLocation] = useState('Gudang Utama');

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setEditItem(item);
    setEditItemName(item.name);
    setEditItemSku(item.sku || '');
    setEditItemCategory(item.category);
    setEditItemUnit(item.unit || 'Batang');
    setEditItemMinStock(item.minStock?.toString() || '2');
    setEditItemPrice(item.avgPurchasePrice ? item.avgPurchasePrice.toLocaleString('id-ID') : '0');
    setEditItemLocation(item.location || 'Gudang Utama');
  };

  const handleSaveEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !editItemName.trim()) return;

    const parsedPrice = parseInt(editItemPrice.replace(/\D/g, ''), 10) || 0;
    const parsedMinStock = parseFloat(editItemMinStock) || 1;

    updateInventoryItem(editItem.id, {
      name: editItemName.trim(),
      category: editItemCategory,
      unit: editItemUnit,
      sku: editItemSku.trim() || editItem.sku,
      minStock: parsedMinStock,
      avgPurchasePrice: isPemilik ? parsedPrice : editItem.avgPurchasePrice,
      location: editItemLocation.trim() || 'Gudang Utama',
    });

    setEditItem(null);
    showToast(`Data barang "${editItemName.trim()}" berhasil diperbarui.`);
  };

  // Add Item form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemSku, setNewItemSku] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<StockCategory>('material');
  const [newItemUnit, setNewItemUnit] = useState('Batang');
  const [newItemStock, setNewItemStock] = useState('0');
  const [newItemMinStock, setNewItemMinStock] = useState('3');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemLocation, setNewItemLocation] = useState('Gudang Utama');

  // Restock form state
  const [restockQty, setRestockQty] = useState('');
  const [restockPrice, setRestockPrice] = useState('');
  const [restockNotes, setRestockNotes] = useState('');
  const [recordCashflow, setRecordCashflow] = useState(true);

  // Adjust form state
  const [adjustNewStock, setAdjustNewStock] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    subMessage?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const isPemilik = session?.role === 'PEMILIK';

  // Filtered inventory
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'LOW_STOCK') return item.currentStock <= item.minStock;
    return item.category === categoryFilter;
  });

  const lowStockItems = inventory.filter((i) => i.currentStock <= i.minStock);
  const materialCount = inventory.filter((i) => i.category === 'material').length;
  const consumableCount = inventory.filter((i) => i.category === 'consumable').length;

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) return;

    addInventoryItem({
      sku: newItemSku || (newItemCategory === 'material' ? `MAT-${Date.now().toString().slice(-3)}` : `CON-${Date.now().toString().slice(-3)}`),
      name: newItemName,
      category: newItemCategory,
      unit: newItemUnit,
      currentStock: parseFloat(newItemStock) || 0,
      minStock: parseFloat(newItemMinStock) || 2,
      avgPurchasePrice: parseInt(newItemPrice.replace(/\D/g, ''), 10) || 0,
      location: newItemLocation || 'Gudang Utama',
    });

    setNewItemName('');
    setNewItemSku('');
    setNewItemStock('0');
    setNewItemPrice('');
    setShowAddModal(false);
  };

  const handleConfirmRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItemId || !restockQty) return;
    const qty = parseFloat(restockQty) || 0;
    const existingItem = inventory.find((i) => i.id === restockItemId);
    const cost = isPemilik
      ? (parseInt(restockPrice.replace(/\D/g, ''), 10) || 0)
      : (existingItem?.avgPurchasePrice || 0);

    restockItem(restockItemId, qty, cost, restockNotes, isPemilik ? recordCashflow : false);

    setRestockItemId(null);
    setRestockQty('');
    setRestockPrice('');
    setRestockNotes('');
  };

  const handleConfirmAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItemId || adjustNewStock === '') return;
    const newStock = parseFloat(adjustNewStock) || 0;
    adjustStock(adjustItemId, newStock, adjustReason);

    setAdjustItemId(null);
    setAdjustNewStock('');
    setAdjustReason('');
  };

  const selectedStockCardItem = inventory.find((i) => i.id === stockCardItemId);
  const selectedMutations = mutations.filter((m) => m.inventoryItemId === stockCardItemId);

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#16181e] p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="font-industrial text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-400" />
            <span>Inventori & Kartu Stok</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Material konstruksi & consumable bengkel las, restock masuk gudang, dan mutasi kartu stok
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSyncingCloud}
            onClick={handleManualSyncCloud}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 hover:text-emerald-200 border border-emerald-500/50 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Tarik data terbaru & sinkronkan stok gudang dengan Cloud Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingCloud ? 'animate-spin' : ''}`} />
            <span>{isSyncingCloud ? 'Menyinkron...' : 'Sinkronkan Cloud'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs sm:text-sm tracking-wide shadow-md shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tambah Barang Baru</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center justify-between">
          <span>{syncNotice}</span>
          <button type="button" onClick={() => setSyncNotice(null)} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Critical Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/50 flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-black shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                <span>Peringatan: {lowStockItems.length} Barang Menipis / Stok 0</span>
              </div>
              <p className="text-[11px] text-zinc-300 mt-0.5">
                Segera lakukan restock kawat las, gas, atau material sebelum pengerjaan proyek terhambat.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCategoryFilter('LOW_STOCK')}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shrink-0"
          >
            Lihat Barang
          </button>
        </div>
      )}

      {/* Grid Kategori Jenis Bahan & Consumable Stok - Simple & Compact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Card 1: Semua Stok */}
        <button
          type="button"
          onClick={() => setCategoryFilter('ALL')}
          className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer relative overflow-hidden group ${
            categoryFilter === 'ALL'
              ? 'bg-zinc-800/95 border-amber-500 ring-1 ring-amber-500/50 shadow-sm'
              : 'bg-[#16181e] border-zinc-800 hover:border-zinc-700 hover:bg-[#1a1d24]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                categoryFilter === 'ALL'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-800/80 text-zinc-400 group-hover:text-zinc-200'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div
                className={`font-bold text-xs truncate ${
                  categoryFilter === 'ALL' ? 'text-amber-400' : 'text-zinc-200'
                }`}
              >
                Semua Stok
              </div>
              <div className="text-[10px] text-zinc-500 truncate">Katalog Gudang</div>
            </div>
          </div>
          <span
            className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md shrink-0 ${
              categoryFilter === 'ALL'
                ? 'bg-amber-500 text-black font-extrabold'
                : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {inventory.length}
          </span>
        </button>

        {/* Card 2: Material Konstruksi */}
        <button
          type="button"
          onClick={() => setCategoryFilter('material')}
          className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer relative overflow-hidden group ${
            categoryFilter === 'material'
              ? 'bg-blue-950/50 border-blue-500 ring-1 ring-blue-500/50 shadow-sm'
              : 'bg-[#16181e] border-zinc-800 hover:border-blue-800/60 hover:bg-[#1a1d24]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                categoryFilter === 'material'
                  ? 'bg-blue-500/25 text-blue-300 border border-blue-500/40'
                  : 'bg-zinc-800/80 text-blue-400 group-hover:bg-blue-950/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div
                className={`font-bold text-xs truncate ${
                  categoryFilter === 'material' ? 'text-blue-300' : 'text-zinc-200'
                }`}
              >
                Jenis Bahan (Material)
              </div>
              <div className="text-[10px] text-zinc-500 truncate">Besi, Pipa, Plat</div>
            </div>
          </div>
          <span
            className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md shrink-0 ${
              categoryFilter === 'material'
                ? 'bg-blue-500 text-black font-extrabold'
                : 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
            }`}
          >
            {materialCount}
          </span>
        </button>

        {/* Card 3: Consumable Bengkel */}
        <button
          type="button"
          onClick={() => setCategoryFilter('consumable')}
          className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer relative overflow-hidden group ${
            categoryFilter === 'consumable'
              ? 'bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500/50 shadow-sm'
              : 'bg-[#16181e] border-zinc-800 hover:border-emerald-800/60 hover:bg-[#1a1d24]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                categoryFilter === 'consumable'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'bg-zinc-800/80 text-emerald-400 group-hover:bg-emerald-950/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div
                className={`font-bold text-xs truncate ${
                  categoryFilter === 'consumable' ? 'text-emerald-300' : 'text-zinc-200'
                }`}
              >
                Consumable Bengkel
              </div>
              <div className="text-[10px] text-zinc-500 truncate">Kawat, Batu, Cat</div>
            </div>
          </div>
          <span
            className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md shrink-0 ${
              categoryFilter === 'consumable'
                ? 'bg-emerald-500 text-black font-extrabold'
                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
            }`}
          >
            {consumableCount}
          </span>
        </button>

        {/* Card 4: Stok Menipis */}
        <button
          type="button"
          onClick={() => setCategoryFilter('LOW_STOCK')}
          className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer relative overflow-hidden group ${
            categoryFilter === 'LOW_STOCK'
              ? 'bg-amber-950/60 border-amber-500 ring-1 ring-amber-500/50 shadow-sm'
              : lowStockItems.length > 0
              ? 'bg-amber-950/20 border-amber-800/60 hover:border-amber-500 hover:bg-amber-950/30'
              : 'bg-[#16181e] border-zinc-800 hover:border-zinc-700 hover:bg-[#1a1d24]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                categoryFilter === 'LOW_STOCK'
                  ? 'bg-amber-500 text-black font-bold'
                  : lowStockItems.length > 0
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-800/80 text-zinc-400'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${lowStockItems.length > 0 ? 'text-amber-400' : ''}`} />
            </div>
            <div className="min-w-0">
              <div
                className={`font-bold text-xs truncate ${
                  categoryFilter === 'LOW_STOCK'
                    ? 'text-amber-400'
                    : lowStockItems.length > 0
                    ? 'text-amber-300'
                    : 'text-zinc-200'
                }`}
              >
                Stok Menipis
              </div>
              <div className="text-[10px] text-zinc-500 truncate">
                {lowStockItems.length > 0 ? 'Perlu Restock' : 'Semua Aman'}
              </div>
            </div>
          </div>
          <span
            className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md shrink-0 ${
              categoryFilter === 'LOW_STOCK'
                ? 'bg-amber-500 text-black font-extrabold'
                : lowStockItems.length > 0
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {lowStockItems.length}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama material, kode SKU, atau lokasi rak..."
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-[#14151a] border border-zinc-800 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {categoryFilter !== 'ALL' && (
          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
            title="Reset filter ke Semua Barang"
          >
            <span>Reset Kategori</span>
            <X className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        )}

        {/* View Mode Toggle: Tabel Rapi (Default) vs Grid Kartu */}
        <div className="flex items-center p-0.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Tampilan Tabel Stok Rapi"
          >
            <Table className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tabel Rapi</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Tampilan Grid Kartu"
          >
            <Boxes className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid Kartu</span>
          </button>
        </div>
      </div>

      {/* Inventory Items - Table View or Grid View */}
      {filteredInventory.length === 0 ? (
        <div className="p-8 text-center bg-[#16181e] rounded-2xl border border-dashed border-zinc-800">
          <Package className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-300 font-semibold text-sm">Tidak ada barang inventori</p>
          <p className="text-xs text-zinc-500 mt-1">
            Gunakan tombol Tambah Barang Baru untuk mendaftarkan barang pertama.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-[#16181e] shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1a1c24] text-zinc-400 font-semibold border-b border-zinc-800">
                <tr>
                  <th className="p-3 w-28">Kode SKU</th>
                  <th className="p-3">Nama Material & Spesifikasi</th>
                  <th className="p-3 w-24">Kategori</th>
                  <th className="p-3 w-28">Lokasi Rak</th>
                  <th className="p-3 w-28">Sisa Stok Fisik</th>
                  <th className="p-3 w-20">Min.</th>
                  {isPemilik && <th className="p-3 w-28 text-right">Harga Beli</th>}
                  <th className="p-3 w-44 text-center">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredInventory.map((item) => {
                  const isLow = item.currentStock <= item.minStock;
                  const isZero = item.currentStock === 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-zinc-800/40 transition-colors ${
                        isZero
                          ? 'bg-red-950/10'
                          : isLow
                          ? 'bg-amber-950/10'
                          : ''
                      }`}
                    >
                      <td className="p-3 font-mono font-medium text-zinc-400">
                        {item.sku}
                      </td>
                      <td className="p-3 font-semibold text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {isLow && (
                            <span
                              className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded ${
                                isZero ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {isZero ? 'Habis' : 'Menipis'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${
                            item.category === 'material'
                              ? 'bg-blue-950/60 text-blue-400 border-blue-800/80'
                              : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                          }`}
                        >
                          {item.category === 'material' ? 'Material' : 'Consumable'}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-400 flex items-center gap-1">
                        <Building className="w-3 h-3 text-zinc-500 shrink-0" />
                        <span>{item.location || 'Gudang'}</span>
                      </td>
                      <td className="p-3 font-mono">
                        <span
                          className={`font-bold text-sm ${
                            isZero
                              ? 'text-red-400'
                              : isLow
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {item.currentStock}
                        </span>{' '}
                        <span className="text-zinc-400 text-[11px]">{item.unit}</span>
                      </td>
                      <td className="p-3 font-mono text-zinc-500">
                        {item.minStock} {item.unit}
                      </td>
                      {isPemilik && (
                        <td className="p-3 font-mono text-zinc-300 font-semibold text-right">
                          {formatIDR(item.avgPurchasePrice)}
                        </td>
                      )}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setRestockItemId(item.id);
                              setRestockPrice(item.avgPurchasePrice.toLocaleString('id-ID'));
                            }}
                            className="p-1 px-1.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-0.5 transition-all cursor-pointer"
                            title="Catat Stok Masuk"
                          >
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>Masuk</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setStockCardItemId(item.id)}
                            className="p-1 px-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold flex items-center gap-0.5 transition-all cursor-pointer"
                            title="Kartu Riwayat Stok"
                          >
                            <FileSpreadsheet className="w-3 h-3 text-amber-400" />
                            <span>Kartu</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustItemId(item.id);
                              setAdjustNewStock(item.currentStock.toString());
                            }}
                            className="p-1 px-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold flex items-center gap-0.5 transition-all cursor-pointer"
                            title="Opname / Koreksi Fisik"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Opname</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                            title="Ubah Data Bahan"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {isPemilik && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDialog({
                                  isOpen: true,
                                  title: 'Hapus Item Gudang',
                                  message: `Yakin ingin menghapus "${item.name}" dari gudang?`,
                                  subMessage: `Kode SKU: ${item.sku} (${item.currentStock} ${item.unit} tersisa).`,
                                  confirmLabel: 'Ya, Hapus Barang',
                                  onConfirm: () => {
                                    deleteInventoryItem(item.id);
                                    showToast(`Barang "${item.name}" berhasil dihapus.`);
                                  },
                                });
                              }}
                              className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                              title="Hapus Material"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5">
          {filteredInventory.map((item) => {
            const isLow = item.currentStock <= item.minStock;
            const isZero = item.currentStock === 0;

            return (
              <div
                key={item.id}
                className={`p-2.5 sm:p-3 rounded-xl bg-[#16181e] border transition-all flex flex-col justify-between hover:border-zinc-700 ${
                  isZero
                    ? 'border-red-800/70 bg-red-950/10'
                    : isLow
                    ? 'border-amber-500/50 bg-amber-950/10'
                    : 'border-zinc-800'
                }`}
              >
                <div>
                  {/* Category, SKU & Quick Action */}
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                          item.category === 'material'
                            ? 'bg-blue-950/60 text-blue-400 border-blue-800/80'
                            : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                        }`}
                      >
                        {item.category === 'material' ? 'Material' : 'Consumable'}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 font-medium truncate">
                        {item.sku}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                        title="Ubah Nama & Data Bahan"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {isPemilik && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Hapus Item Gudang',
                              message: `Yakin ingin menghapus "${item.name}" dari gudang?`,
                              subMessage: `Kode SKU: ${item.sku} (${item.currentStock} ${item.unit} tersisa). Data barang ini akan dihapus dari katalog master stok.`,
                              confirmLabel: 'Ya, Hapus Barang',
                              onConfirm: () => {
                                deleteInventoryItem(item.id);
                                showToast(`Barang "${item.name}" berhasil dihapus.`);
                              },
                            });
                          }}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                          title="Hapus Material dari Gudang"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Item Name */}
                  <h3
                    className="font-industrial text-xs sm:text-[13.5px] font-bold text-white line-clamp-1 leading-snug"
                    title={item.name}
                  >
                    {item.name}
                  </h3>

                  {/* Location & Min Stock */}
                  <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1 truncate">
                    <Building className="w-3 h-3 text-zinc-500 shrink-0" />
                    <span className="truncate">{item.location || 'Gudang'}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500 shrink-0">Min: {item.minStock} {item.unit}</span>
                  </div>

                  {/* Simple & Compact Stock & Price Display */}
                  <div className="mt-2 py-1.5 px-2 rounded-lg bg-black/40 border border-zinc-800/80 flex items-center justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`text-sm sm:text-base font-bold font-mono ${
                          isZero
                            ? 'text-red-400'
                            : isLow
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {item.currentStock}
                      </span>
                      <span className="text-[11px] text-zinc-400">{item.unit}</span>
                      {isLow && (
                        <span
                          className={`text-[8.5px] font-bold px-1 py-0.2 rounded leading-tight ${
                            isZero ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {isZero ? 'Habis' : 'Menipis'}
                        </span>
                      )}
                    </div>

                    {isPemilik && item.avgPurchasePrice > 0 && (
                      <div className="text-right">
                        <div className="text-[10.5px] font-bold text-zinc-300 font-mono">
                          {formatIDR(item.avgPurchasePrice)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons - Compact & Sleek */}
                <div className="mt-2 pt-1.5 border-t border-zinc-800/60 grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRestockItemId(item.id);
                      setRestockPrice(item.avgPurchasePrice.toLocaleString('id-ID'));
                    }}
                    className="py-1 px-0.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer"
                    title="Catat Stok Masuk"
                  >
                    <ArrowDownLeft className="w-3 h-3 shrink-0" />
                    <span>Masuk</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStockCardItemId(item.id);
                    }}
                    className="py-1 px-0.5 rounded-md bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold flex items-center justify-center gap-0.5 transition-all cursor-pointer"
                    title="Buka Kartu Riwayat Stok"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Kartu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustItemId(item.id);
                      setAdjustNewStock(item.currentStock.toString());
                    }}
                    className="py-1 px-0.5 rounded-md bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold flex items-center justify-center gap-0.5 transition-all cursor-pointer"
                    title="Opname / Koreksi Fisik"
                  >
                    <RotateCcw className="w-3 h-3 shrink-0" />
                    <span>Opname</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(item)}
                    className="py-1 px-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer"
                    title="Ubah Nama & Data Bahan / Consumable"
                  >
                    <Edit3 className="w-3 h-3 shrink-0" />
                    <span>Ubah</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL KARTU STOK (MUTATION HISTORY) */}
      {selectedStockCardItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl bg-[#16181e] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden my-4 max-h-[90vh] flex flex-col">
            <div className="p-4 bg-[#1a1c24] border-b border-zinc-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-400 font-bold font-mono">
                    {selectedStockCardItem.sku}
                  </span>
                  <span className="text-xs uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold">
                    {selectedStockCardItem.category}
                  </span>
                </div>
                <h3 className="font-industrial text-lg font-bold text-white mt-0.5">
                  Kartu Stok: {selectedStockCardItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStockCardItemId(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Summary */}
            <div className={`p-4 bg-[#131418] border-b border-zinc-800 grid ${isPemilik ? 'grid-cols-3' : 'grid-cols-2'} gap-3 text-xs font-mono`}>
              <div>
                <span className="text-zinc-500 block">Sisa Stok Terkini:</span>
                <span className="text-base font-bold text-emerald-400">
                  {selectedStockCardItem.currentStock} {selectedStockCardItem.unit}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Batas Menipis:</span>
                <span className="text-base font-bold text-amber-400">
                  {selectedStockCardItem.minStock} {selectedStockCardItem.unit}
                </span>
              </div>
              {isPemilik && (
                <div>
                  <span className="text-zinc-500 block">Harga Acuan:</span>
                  <span className="text-base font-bold text-zinc-200">
                    {formatIDR(selectedStockCardItem.avgPurchasePrice)}
                  </span>
                </div>
              )}
            </div>

            {/* Mutation Log Table */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900 text-zinc-400 font-semibold border-b border-zinc-800">
                    <tr>
                      <th className="p-2.5">Tanggal</th>
                      <th className="p-2.5">Tipe Mutasi</th>
                      <th className="p-2.5">Keterangan / Referensi</th>
                      <th className="p-2.5 text-center">Stok Awal</th>
                      <th className="p-2.5 text-center">Mutasi (+/-)</th>
                      <th className="p-2.5 text-center">Stok Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {selectedMutations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-zinc-500 italic">
                          Belum ada catatan mutasi kartu stok untuk barang ini.
                        </td>
                      </tr>
                    ) : (
                      selectedMutations.map((mut) => (
                        <tr key={mut.id} className="hover:bg-zinc-800/40">
                          <td className="p-2.5 font-mono text-zinc-400">{formatDate(mut.date)}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                mut.type === 'MASUK'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : mut.type === 'KELUAR_PROYEK'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-blue-950 text-blue-300 border border-blue-800'
                              }`}
                            >
                              {mut.type === 'MASUK'
                                ? 'MASUK'
                                : mut.type === 'KELUAR_PROYEK'
                                ? 'TERPAKAI PROYEK'
                                : 'PENYESUAIAN'}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="font-medium text-zinc-200">{mut.referenceLabel}</div>
                            {mut.notes && <div className="text-[11px] text-zinc-500">{mut.notes}</div>}
                          </td>
                          <td className="p-2.5 text-center font-mono text-zinc-400">
                            {mut.previousStock}
                          </td>
                          <td
                            className={`p-2.5 text-center font-mono font-bold ${
                              mut.type === 'MASUK' ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {mut.type === 'MASUK' ? `+${mut.qty}` : `-${mut.qty}`}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-zinc-100">
                            {mut.currentStock}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESTOCK STOK MASUK */}
      {restockItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#181a20] border border-emerald-500/40 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                <span>Restock Barang Masuk Gudang</span>
              </h3>
              <button
                type="button"
                onClick={() => setRestockItemId(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Barang:{' '}
              <strong className="text-amber-400">
                {inventory.find((i) => i.id === restockItemId)?.name}
              </strong>
            </p>

            <form onSubmit={handleConfirmRestock} className="space-y-3">
              {isPemilik ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Jumlah Masuk *
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={restockQty}
                      onChange={(e) => setRestockQty(e.target.value)}
                      placeholder="Contoh: 10"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono font-bold text-sm focus:border-emerald-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Harga Beli Satuan (Rp)
                    </label>
                    <input
                      type="text"
                      value={restockPrice}
                      onChange={(e) => {
                        const num = e.target.value.replace(/\D/g, '');
                        setRestockPrice(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                      }}
                      placeholder="Harga beli"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-amber-400 font-mono font-bold text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Jumlah Masuk (Mutasi Tambah Stok) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                    placeholder="Contoh: 10"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono font-bold text-sm focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Catatan / Supplier
                </label>
                <input
                  type="text"
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  placeholder="Contoh: Beli di Toko Besi Abadi (No. Nota 123)"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {isPemilik && (
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={recordCashflow}
                    onChange={(e) => setRecordCashflow(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4 rounded"
                  />
                  <span>Catat otomatis sebagai pengeluaran kas belanja stok</span>
                </label>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockItemId(null)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
                >
                  Konfirmasi Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL STOCK OPNAME / PENYESUAIAN */}
      {adjustItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#181a20] border border-blue-500/40 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-blue-400" />
                <span>Stock Opname / Penyesuaian Fisik</span>
              </h3>
              <button
                type="button"
                onClick={() => setAdjustItemId(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Koreksi jumlah fisik aktual untuk:{' '}
              <strong className="text-amber-400">
                {inventory.find((i) => i.id === adjustItemId)?.name}
              </strong>
            </p>

            <form onSubmit={handleConfirmAdjust} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Stok Fisik Sebenarnya (Boleh 0) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={adjustNewStock}
                  onChange={(e) => setAdjustNewStock(e.target.value)}
                  placeholder="Jumlah stok aktual di bengkel"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono font-bold text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Alasan Koreksi *
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Contoh: Opname fisik akhir pekan / sisa potongan / rusak"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustItemId(null)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md"
                >
                  Simpan Penyesuaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH BARANG BARU */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-[#181a20] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="h-1.5 bg-hazard-stripes w-full" />
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <span>Tambah Barang Inventori Bengkel</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nama Barang *
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Contoh: Besi Hollow 40x40 1.4mm / Kawat Las RD-260"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              {/* Jenis Bahan atau Consumable Grid */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Jenis / Kategori Barang *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setNewItemCategory('material')}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      newItemCategory === 'material'
                        ? 'bg-blue-950/50 border-blue-500 text-white ring-1 ring-blue-500/50 shadow-md shadow-blue-950/40'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        newItemCategory === 'material'
                          ? 'bg-blue-500/25 text-blue-300 border border-blue-500/40'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-zinc-100 flex items-center justify-between">
                        <span>Material Konstruksi</span>
                        {newItemCategory === 'material' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">Besi Hollow, Pipa, Plat, UNP</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewItemCategory('consumable')}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      newItemCategory === 'consumable'
                        ? 'bg-emerald-950/50 border-emerald-500 text-white ring-1 ring-emerald-500/50 shadow-md shadow-emerald-950/40'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        newItemCategory === 'consumable'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-zinc-100 flex items-center justify-between">
                        <span>Consumable Bengkel</span>
                        {newItemCategory === 'consumable' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">Kawat Las, Batu, Cat, Gas</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Satuan Tetap *
                </label>
                <select
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                >
                  <option value="Batang">Batang</option>
                  <option value="Lembar">Lembar</option>
                  <option value="Kotak (5kg)">Kotak (5kg)</option>
                  <option value="Kotak (25 pcs)">Kotak (25 pcs)</option>
                  <option value="Kaleng (5kg)">Kaleng (5kg)</option>
                  <option value="Kaleng (5L)">Kaleng (5L)</option>
                  <option value="Tabung">Tabung</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Roll">Roll</option>
                  <option value="Kg">Kg</option>
                </select>
              </div>

              <div className={`grid ${isPemilik ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Stok Awal (Boleh 0)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newItemStock}
                    onChange={(e) => setNewItemStock(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Batas Menipis
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newItemMinStock}
                    onChange={(e) => setNewItemMinStock(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
                {isPemilik && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Harga Satuan (Rp)
                    </label>
                    <input
                      type="text"
                      value={newItemPrice}
                      onChange={(e) => {
                        const num = e.target.value.replace(/\D/g, '');
                        setNewItemPrice(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                      }}
                      placeholder="Rp"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-amber-400 font-mono text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Lokasi Rak / Gudang
                  </label>
                  <input
                    type="text"
                    value={newItemLocation}
                    onChange={(e) => setNewItemLocation(e.target.value)}
                    placeholder="Contoh: Rak Pipa A / Lemari 1"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Kode SKU (Opsional)
                  </label>
                  <input
                    type="text"
                    value={newItemSku}
                    onChange={(e) => setNewItemSku(e.target.value)}
                    placeholder="Otomatis terisi jika kosong"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-400 font-mono text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
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
                  Simpan Barang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        subMessage={confirmDialog.subMessage}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* MODAL UBAH NAMA & DATA BAHAN / CONSUMABLE */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-[#181a20] border border-amber-500/50 rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="h-1.5 bg-hazard-stripes w-full" />
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <PenLine className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Ubah Data Bahan / Consumable</h3>
                  <p className="text-xs text-zinc-400 font-mono">Kode SKU: {editItem.sku}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditItem} className="p-5 space-y-3.5">
              {/* Nama Bahan / Consumable */}
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1 flex items-center justify-between">
                  <span>Nama Bahan / Consumable *</span>
                  <span className="text-[10px] text-zinc-400 font-normal">Edit Nama Barang</span>
                </label>
                <input
                  type="text"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  placeholder="Contoh: Besi Hollow 40x40 1.4mm / Kawat Las RD-260"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-amber-500/50 text-white font-semibold text-sm focus:border-amber-400 focus:outline-none shadow-inner"
                  required
                  autoFocus
                />
              </div>

              {/* Jenis Bahan atau Consumable Grid */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Jenis / Kategori Barang *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditItemCategory('material')}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      editItemCategory === 'material'
                        ? 'bg-blue-950/50 border-blue-500 text-white ring-1 ring-blue-500/50 shadow-md shadow-blue-950/40'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        editItemCategory === 'material'
                          ? 'bg-blue-500/25 text-blue-300 border border-blue-500/40'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-zinc-100 flex items-center justify-between">
                        <span>Material Konstruksi</span>
                        {editItemCategory === 'material' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">Besi Hollow, Pipa, Plat, UNP</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditItemCategory('consumable')}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      editItemCategory === 'consumable'
                        ? 'bg-emerald-950/50 border-emerald-500 text-white ring-1 ring-emerald-500/50 shadow-md shadow-emerald-950/40'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        editItemCategory === 'consumable'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-zinc-100 flex items-center justify-between">
                        <span>Consumable Bengkel</span>
                        {editItemCategory === 'consumable' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">Kawat Las, Batu, Cat, Gas</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Satuan *
                </label>
                <select
                  value={editItemUnit}
                  onChange={(e) => setEditItemUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                >
                  <option value="Batang">Batang</option>
                  <option value="Lembar">Lembar</option>
                  <option value="Kotak (5kg)">Kotak (5kg)</option>
                  <option value="Kotak (25 pcs)">Kotak (25 pcs)</option>
                  <option value="Kaleng (5kg)">Kaleng (5kg)</option>
                  <option value="Kaleng (5L)">Kaleng (5L)</option>
                  <option value="Tabung">Tabung</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Roll">Roll</option>
                  <option value="Kg">Kg</option>
                  <option value="Meter">Meter</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Batas Minimum Menipis *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editItemMinStock}
                    onChange={(e) => setEditItemMinStock(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Kode SKU
                  </label>
                  <input
                    type="text"
                    value={editItemSku}
                    onChange={(e) => setEditItemSku(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className={`grid ${isPemilik ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Lokasi Rak / Gudang
                  </label>
                  <input
                    type="text"
                    value={editItemLocation}
                    onChange={(e) => setEditItemLocation(e.target.value)}
                    placeholder="Contoh: Rak Pipa A / Lemari 1"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
                {isPemilik && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Harga Beli Rata-Rata (Rp)
                    </label>
                    <input
                      type="text"
                      value={editItemPrice}
                      onChange={(e) => {
                        const num = e.target.value.replace(/\D/g, '');
                        setEditItemPrice(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                      }}
                      placeholder="Rp"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-amber-400 font-mono text-xs font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
                <span>Stok Fisik Saat Ini:</span>
                <span className="font-bold text-white font-mono">
                  {editItem.currentStock} {editItem.unit}
                </span>
              </div>

              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
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
    </div>
  );
};
