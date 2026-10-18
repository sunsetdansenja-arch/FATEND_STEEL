import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Project, ProjectStatus } from '../types';
import { formatIDR, formatDate, calculateProjectFinance, generateId } from '../utils/formatters';
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  X,
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  Calendar,
  Phone,
  MapPin,
  Trash2,
  Percent,
  Flame,
  Check,
  Building,
  ScanLine,
  MessageSquare,
  Edit3,
  RotateCcw,
  Sparkles,
  Pencil,
  RefreshCw,
  Cloud,
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface ProjectViewProps {
  initialSelectedProjectId?: string | null;
  onOpenScanForProject?: (projectId: string) => void;
}

export const ProjectView: React.FC<ProjectViewProps> = ({
  initialSelectedProjectId,
  onOpenScanForProject,
}) => {
  const {
    projects,
    inventory,
    session,
    addProject,
    updateProject,
    deleteProject,
    updateProjectProgress,
    addToBuyItem,
    toggleToBuyItem,
    deleteToBuyItem,
    useMaterialInProject,
    deleteUsedMaterial,
    updateUsedMaterial,
    addProjectPayment,
    deleteProjectPayment,
    addLaborWage,
    payLaborWage,
    deleteLaborWage,
    restoreMasterWorkshopData,
    forceDownloadFromCloud,
    cloudStatus,
    lastSyncedAt,
  } = useApp();

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const handleManualSyncCloud = async () => {
    setIsSyncingCloud(true);
    setSyncNotice(null);
    try {
      const ok = await forceDownloadFromCloud();
      if (ok) {
        setSyncNotice('✅ Berhasil menarik data terbaru dari Cloud Firestore!');
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

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialSelectedProjectId || null
  );

  React.useEffect(() => {
    if (initialSelectedProjectId) {
      setSelectedProjectId(initialSelectedProjectId);
    }
  }, [initialSelectedProjectId]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Project Form state
  const [newProjectName, setNewProjectName] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newContractValue, setNewContractValue] = useState<string>('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Edit Project Modal state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editContractValue, setEditContractValue] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('PROSES');
  const [editNotes, setEditNotes] = useState('');

  const handleOpenEditModal = (prj: Project) => {
    setEditingProject(prj);
    setEditName(prj.name);
    setEditClientName(prj.clientName || '');
    setEditClientPhone(prj.clientPhone || '');
    setEditLocation(prj.location || '');
    setEditContractValue(prj.contractValue ? prj.contractValue.toLocaleString('id-ID') : '');
    setEditDeadline(prj.deadline ? prj.deadline.split('T')[0] : '');
    setEditStatus(prj.status);
    setEditNotes(prj.notes || '');
  };

  const handleSaveEditProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim()) return;

    const parsedVal = parseInt(editContractValue.replace(/\D/g, ''), 10) || 0;

    updateProject(editingProject.id, {
      name: editName.trim(),
      clientName: editClientName.trim() || 'Pelanggan Bengkel',
      clientPhone: editClientPhone.trim() || undefined,
      location: editLocation.trim() || undefined,
      deadline: editDeadline || editingProject.deadline,
      status: editStatus,
      notes: editNotes.trim() || undefined,
      ...(isPemilik ? { contractValue: parsedVal } : {}),
    });

    setEditingProject(null);
  };

  // Project Detail Tab state
  const [detailTab, setDetailTab] = useState<'overview' | 'tobuy' | 'materials' | 'wages' | 'payments'>('overview');

  // Sub-forms inside detail modal
  const [toBuyName, setToBuyName] = useState('');
  const [toBuyQty, setToBuyQty] = useState('1');
  const [toBuyUnit, setToBuyUnit] = useState('Batang');
  const [toBuyPrice, setToBuyPrice] = useState('');

  const [selectedStockId, setSelectedStockId] = useState('');
  const [customMatName, setCustomMatName] = useState('');
  const [matQty, setMatQty] = useState('1');
  const [matUnit, setMatUnit] = useState('Batang');
  const [matCost, setMatCost] = useState('');
  const [isFromStock, setIsFromStock] = useState(true);

  // Used Material Edit Price state
  const [editingUsedMat, setEditingUsedMat] = useState<{
    id: string;
    name: string;
    qty: number;
    unit: string;
    costPerUnit: number;
    fromStock?: boolean;
  } | null>(null);
  const [editUsedMatCost, setEditUsedMatCost] = useState('');
  const [editUsedMatQty, setEditUsedMatQty] = useState('');
  const [editUsedMatName, setEditUsedMatName] = useState('');
  const [editUsedMatUnit, setEditUsedMatUnit] = useState('');

  // Stock Picker Catalog (Table/List View, Bukan Grid) state
  const [showStockPickerModal, setShowStockPickerModal] = useState(false);
  const [stockPickerSearch, setStockPickerSearch] = useState('');
  const [stockPickerCategory, setStockPickerCategory] = useState<'ALL' | 'material' | 'consumable' | 'AVAILABLE'>('ALL');

  const handleOpenEditUsedMaterial = (mat: any) => {
    setEditingUsedMat(mat);
    setEditUsedMatCost(mat.costPerUnit ? mat.costPerUnit.toLocaleString('id-ID') : '0');
    setEditUsedMatQty(mat.qty.toString());
    setEditUsedMatName(mat.name);
    setEditUsedMatUnit(mat.unit);
  };

  const handleSaveEditUsedMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !editingUsedMat) return;
    const cleanCost = parseInt(editUsedMatCost.replace(/\D/g, ''), 10) || 0;
    const cleanQty = parseFloat(editUsedMatQty.replace(',', '.')) || editingUsedMat.qty;

    updateUsedMaterial(selectedProject.id, editingUsedMat.id, {
      costPerUnit: cleanCost,
      qty: cleanQty,
      name: editUsedMatName.trim() || editingUsedMat.name,
      unit: editUsedMatUnit.trim() || editingUsedMat.unit,
    });

    setEditingUsedMat(null);
  };

  const handleSelectStockItem = (item: any) => {
    setSelectedStockId(item.id);
    setCustomMatName(item.name);
    setMatUnit(item.unit);
    setMatCost(item.avgPurchasePrice ? item.avgPurchasePrice.toLocaleString('id-ID') : '0');
    setIsFromStock(true);
    setShowStockPickerModal(false);
  };

  // Wage form
  const [tukangName, setTukangName] = useState('');
  const [helperName, setHelperName] = useState('Helper Las');
  const [baseWage, setBaseWage] = useState('');
  const [wageNotes, setWageNotes] = useState('');

  // Payment form
  const [paymentType, setPaymentType] = useState<'PANJAR' | 'TERMIN_1' | 'TERMIN_2' | 'PELUNASAN'>('PANJAR');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Wage Pay form
  const [payingWageId, setPayingWageId] = useState<string | null>(null);
  const [payWageAmount, setPayWageAmount] = useState('');

  // In-app Confirmation Modal state
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

  const handleStockSelectChange = (itemId: string) => {
    setSelectedStockId(itemId);
    if (itemId && itemId !== 'CUSTOM') {
      const inv = inventory.find((i) => i.id === itemId);
      if (inv) {
        setCustomMatName(inv.name);
        setMatUnit(inv.unit);
        setMatCost(inv.avgPurchasePrice.toLocaleString('id-ID'));
      }
    } else if (itemId === 'CUSTOM') {
      setCustomMatName('');
      setMatCost('');
    }
  };

  React.useEffect(() => {
    if (!isPemilik && (detailTab === 'wages' || detailTab === 'payments')) {
      setDetailTab('overview');
    }
  }, [isPemilik, detailTab]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Project Notes & Instructions state (Kolom Keterangan yang dapat dibaca oleh Admin)
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [projectNotesDraft, setProjectNotesDraft] = useState('');
  const [showNotesSaved, setShowNotesSaved] = useState(false);

  React.useEffect(() => {
    if (selectedProject) {
      setProjectNotesDraft(selectedProject.notes || '');
      setIsEditingNotes(false);
    }
  }, [selectedProject?.id, selectedProject?.notes]);

  const handleSaveProjectNotes = () => {
    if (!selectedProject) return;
    updateProject(selectedProject.id, { notes: projectNotesDraft.trim() });
    setIsEditingNotes(false);
    setShowNotesSaved(true);
    setTimeout(() => setShowNotesSaved(false), 3500);
  };

  const handleCancelProjectNotes = () => {
    setProjectNotesDraft(selectedProject?.notes || '');
    setIsEditingNotes(false);
  };

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) return;

    const parsedContract = newContractValue
      ? (parseInt(newContractValue.replace(/\D/g, ''), 10) || 0)
      : 0;

    const newPrj = addProject({
      name: newProjectName,
      clientName: newClientName || 'Pelanggan Bengkel',
      clientPhone: newClientPhone,
      location: newLocation || 'Workshop Bengkel',
      contractValue: parsedContract,
      progress: 0,
      status: 'BERJALAN',
      startDate: new Date().toISOString().split('T')[0],
      deadline: newDeadline || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      notes: newNotes,
    });

    setNewProjectName('');
    setNewClientName('');
    setNewClientPhone('');
    setNewLocation('');
    setNewContractValue('');
    setNewDeadline('');
    setNewNotes('');
    setShowAddModal(false);
    setSelectedProjectId(newPrj.id);
  };

  const handleAddPendingItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !toBuyName) return;
    addToBuyItem(selectedProjectId, {
      name: toBuyName,
      qty: parseFloat(toBuyQty) || 1,
      unit: toBuyUnit,
      estPrice: parseInt(toBuyPrice.replace(/\D/g, ''), 10) || 0,
    });
    setToBuyName('');
    setToBuyQty('1');
    setToBuyPrice('');
  };

  const handleUseMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    if (isFromStock) {
      const invItem = inventory.find((i) => i.id === selectedStockId);
      if (!invItem) return;
      const qty = parseFloat(matQty) || 1;
      useMaterialInProject(selectedProjectId, {
        inventoryItemId: invItem.id,
        name: invItem.name,
        qty,
        unit: invItem.unit,
        costPerUnit: invItem.avgPurchasePrice,
        fromStock: true,
      });
    } else {
      const invItem =
        selectedStockId && selectedStockId !== 'CUSTOM'
          ? inventory.find((i) => i.id === selectedStockId)
          : null;
      const finalName = invItem ? invItem.name : customMatName;
      const finalUnit = invItem ? invItem.unit : (matUnit || 'Batang');
      if (!finalName) return;
      const qty = parseFloat(matQty) || 1;
      const cost =
        parseInt(matCost.replace(/\D/g, ''), 10) || (invItem?.avgPurchasePrice || 0);

      useMaterialInProject(selectedProjectId, {
        name: finalName,
        qty,
        unit: finalUnit,
        costPerUnit: cost,
        fromStock: false,
      });
    }

    setCustomMatName('');
    setMatQty('1');
    setMatCost('');
    setSelectedStockId('');
  };

  const handleAddWage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !tukangName || !baseWage) return;
    const parsedBase = parseInt(baseWage.replace(/\D/g, ''), 10) || 0;
    addLaborWage(selectedProjectId, {
      tukangName,
      helperName: helperName || 'Helper Las (20%)',
      baseWage: parsedBase,
      notes: wageNotes,
    });
    setTukangName('');
    setBaseWage('');
    setWageNotes('');
  };

  const handleConfirmPayWage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !payingWageId || !payWageAmount) return;
    const parsed = parseInt(payWageAmount.replace(/\D/g, ''), 10) || 0;
    payLaborWage(selectedProjectId, payingWageId, parsed);
    setPayingWageId(null);
    setPayWageAmount('');
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !paymentAmount) return;
    const parsed = parseInt(paymentAmount.replace(/\D/g, ''), 10) || 0;
    addProjectPayment(selectedProjectId, {
      date: new Date().toISOString().split('T')[0],
      type: paymentType,
      amount: parsed,
      notes: paymentNotes,
    });
    setPaymentAmount('');
    setPaymentNotes('');
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#16181e] p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="font-industrial text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-amber-400" />
            <span>Manajemen Proyek Bengkel</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Kelola SPK, progres pengerjaan, daftar belanja belum dibeli, material terpakai & borongan
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSyncingCloud}
            onClick={handleManualSyncCloud}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 hover:text-emerald-200 border border-emerald-500/50 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Tarik data terbaru dari Cloud Firestore (Sinkronisasi Antar-PC & HP)"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingCloud ? 'animate-spin' : ''}`} />
            <span>{isSyncingCloud ? 'Menyinkron...' : 'Sinkronkan Cloud'}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const conf = window.confirm('Kembalikan 100% data asli 6 proyek bengkel & seluruh stok CV FATEND STEEL?');
              if (conf) {
                await restoreMasterWorkshopData();
              }
            }}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-bold transition-all cursor-pointer"
            title="Pulihkan Data Asli Bengkel (Jika ter-reset atau hilang)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Pulihkan Data Asli</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs sm:text-sm tracking-wide shadow-md shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Buat Proyek Baru</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <span>{syncNotice}</span>
          <button type="button" onClick={() => setSyncNotice(null)} className="text-zinc-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {projects.length < 6 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Terdeteksi <strong>{projects.length} proyek</strong> di perangkat ini. Ingin memulihkan <strong>6 proyek asli bengkel</strong> (Meja Granit, Tangga Langsa, Pintu Pengaman, dll)?
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (window.confirm('Pulihkan 6 proyek asli bengkel dan seluruh stok sekarang?')) {
                await restoreMasterWorkshopData();
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs whitespace-nowrap shrink-0 shadow-sm transition-all"
          >
            Pulihkan 100% Real
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama proyek, nama klien, atau lokasi..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#14151a] border border-zinc-800 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { key: 'ALL', label: 'Semua' },
            { key: 'BERJALAN', label: 'Berjalan' },
            { key: 'FINISHING', label: 'Finishing' },
            { key: 'SELESAI', label: 'Selesai' },
            { key: 'DRAFT', label: 'Draft' },
          ].map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => setFilterStatus(st.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterStatus === st.key
                  ? 'bg-amber-500 text-black font-bold shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards Grid */}
      {filteredProjects.length === 0 ? (
        <div className="p-8 text-center bg-[#16181e] rounded-2xl border border-dashed border-zinc-800">
          <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-300 font-semibold text-sm">Tidak ada proyek yang ditemukan</p>
          <p className="text-xs text-zinc-500 mt-1">
            Silakan tambahkan proyek baru atau ubah kata kunci pencarian.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredProjects.map((prj) => {
            const fin = calculateProjectFinance(prj);
            const pendingBuyCount = (prj.toBuyItems || []).filter((i) => !i.isPurchased).length;

            return (
              <div
                key={prj.id}
                onClick={() => {
                  setSelectedProjectId(prj.id);
                  setDetailTab('overview');
                }}
                className="group p-4 rounded-2xl bg-[#16181e] hover:bg-[#1a1c24] border border-zinc-800 hover:border-amber-500/50 cursor-pointer transition-all shadow-md flex flex-col justify-between"
              >
                <div>
                  {/* Status & Date */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                        prj.status === 'SELESAI'
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                          : prj.status === 'FINISHING'
                          ? 'bg-purple-950/60 text-purple-400 border-purple-800'
                          : prj.status === 'BERJALAN'
                          ? 'bg-amber-950/60 text-amber-400 border-amber-800'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {prj.status}
                    </span>

                    <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-zinc-500" />
                      {formatDate(prj.deadline)}
                    </span>
                  </div>

                  {/* Project Name */}
                  <h3 className="font-industrial text-base font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                    {prj.name}
                  </h3>

                  {/* Client & Location */}
                  <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1 line-clamp-1">
                    <span className="font-medium text-zinc-300">{prj.clientName}</span>
                    {prj.location && <span className="text-zinc-600">• {prj.location}</span>}
                  </p>

                  {/* Contract Value & Profit (Khusus Pemilik) */}
                  {isPemilik && (
                    <div className="mt-3.5 p-2.5 rounded-xl bg-black/40 border border-zinc-800/80 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-zinc-500">
                          Nilai Kontrak
                        </div>
                        <div className="text-sm font-bold text-amber-400 font-mono-num">
                          {formatIDR(prj.contractValue)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase font-semibold text-zinc-500">
                          Est. Laba
                        </div>
                        <div
                          className={`text-xs font-bold font-mono-num ${
                            fin.estimatedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {formatIDR(fin.estimatedProfit)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Progress Bar Industrial */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-zinc-400 font-medium">Progres Lapangan</span>
                      <span className="font-bold text-amber-400 font-mono-num">{prj.progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-300"
                        style={{ width: `${prj.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Badges */}
                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    {pendingBuyCount > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-red-950/80 border border-red-800 text-red-300 text-[10px] font-bold">
                        {pendingBuyCount} Belum Dibeli
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500">Bahan Lengkap</span>
                    )}
                    <span className="text-[10px] text-zinc-500">
                      {prj.usedMaterials?.length || 0} Terpakai
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(prj);
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                      title="Ubah Nama & Data Proyek"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {isPemilik && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Hapus Proyek',
                            message: `Yakin ingin menghapus proyek "${prj.name}"?`,
                            subMessage:
                              'Semua catatan progres, SPK, bahan terpakai, dan borongan pada proyek ini akan dihapus permanen.',
                            confirmLabel: 'Ya, Hapus Proyek',
                            onConfirm: () => {
                              deleteProject(prj.id);
                              if (selectedProjectId === prj.id) {
                                setSelectedProjectId(null);
                              }
                            },
                          });
                        }}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                        title="Hapus Proyek"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="flex items-center gap-1 text-amber-400 text-xs font-semibold group-hover:translate-x-0.5 transition-transform">
                      <span>Detail</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT PROJECT MODAL */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-[#181a20] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
            <div className="p-4 bg-[#1e2029] border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-industrial text-base font-bold text-white">
                    Ubah Nama & Data Proyek
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Perubahan akan otomatis tersimpan dan disinkronkan ke Cloud
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProject} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nama Proyek *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Contoh: Kanopi Minimalis Bpk. H. Rahmat"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm font-semibold focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Nama Pemesan / Klien *
                  </label>
                  <input
                    type="text"
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    placeholder="Nama Klien"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    No. WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    value={editClientPhone}
                    onChange={(e) => setEditClientPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Lokasi Pemasangan
                  </label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Contoh: Jl. Ahmad Yani No. 5"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Status Proyek
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="DRAFT">DRAFT (RAB)</option>
                    <option value="PROSES">PROSES (Pabrikasi)</option>
                    <option value="FINISHING">FINISHING (Finishing / Cat)</option>
                    <option value="SELESAI">SELESAI (Terpasang)</option>
                    <option value="TERTUNDA">TERTUNDA (Ditunda)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {isPemilik && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Nilai Kontrak (Rp)
                    </label>
                    <input
                      type="text"
                      value={editContractValue}
                      onChange={(e) => {
                        const num = e.target.value.replace(/\D/g, '');
                        setEditContractValue(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-amber-400 font-bold font-mono text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                )}
                <div className={!isPemilik ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Tenggat Selesai
                  </label>
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Catatan Teknis / Spesifikasi
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Catatan tambahan spesifikasi proyek..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW PROJECT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-[#181a20] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="h-1.5 bg-hazard-stripes w-full" />
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold">
                <Layers className="w-5 h-5 text-amber-400" />
                <span>Buat Proyek Baru</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nama Pekerjaan / Proyek *
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Contoh: Kanopi Alderon Carport Bpk. Wahyu"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Nama Klien / Pemesan *
                  </label>
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Contoh: Bpk. Hendra"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    No. WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Lokasi Pemasangan
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Contoh: Cluster Citra Garden Blok C No. 12"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Nilai Kontrak (Rp) <span className="text-zinc-500 font-normal text-[10.5px]">(Opsional - Bisa Menyusul)</span>
                  </label>
                  <input
                    type="text"
                    value={newContractValue}
                    onChange={(e) => {
                      const num = e.target.value.replace(/\D/g, '');
                      setNewContractValue(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                    }}
                    placeholder="Boleh kosong / isi nanti saat ada kesepakatan"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-amber-400 font-bold font-mono text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Tenggat Selesai
                  </label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Spesifikasi / Catatan Teknis
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Contoh: Rangka hollow 40x80 galvanis, atap Alderon RS putih, cat hitam doff primer zinchromate"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-md shadow-amber-500/20"
                >
                  Simpan Proyek
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROJECT DETAIL MODAL / DRAWER */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl bg-[#16181e] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden my-4 max-h-[92dvh] flex flex-col">
            {/* Header */}
            <div className="p-4 bg-[#1a1c24] border-b border-zinc-800 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      selectedProject.status === 'SELESAI'
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                        : selectedProject.status === 'FINISHING'
                        ? 'bg-purple-950 text-purple-400 border-purple-800'
                        : 'bg-amber-950 text-amber-400 border-amber-800'
                    }`}
                  >
                    {selectedProject.status}
                  </span>
                  <span className="text-xs text-zinc-400">Tenggat: {formatDate(selectedProject.deadline)}</span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <h2 className="font-industrial text-lg sm:text-xl font-bold text-white">
                    {selectedProject.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(selectedProject)}
                    className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-amber-500/20 text-zinc-400 hover:text-amber-300 border border-zinc-700 hover:border-amber-500/40 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    title="Ubah Nama & Data Proyek"
                  >
                    <Pencil className="w-3 h-3 text-amber-400" />
                    <span>Ubah Nama</span>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-1">
                  <span className="flex items-center gap-1 text-zinc-300 font-medium">
                    <Building className="w-3.5 h-3.5 text-zinc-500" />
                    {selectedProject.clientName}
                  </span>
                  {selectedProject.clientPhone && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Phone className="w-3.5 h-3.5" />
                      {selectedProject.clientPhone}
                    </span>
                  )}
                  {selectedProject.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                      {selectedProject.location}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {onOpenScanForProject && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(null);
                      onOpenScanForProject(selectedProject.id);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    title="Scan Nota untuk Proyek Ini"
                  >
                    <ScanLine className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Scan Nota AI</span>
                  </button>
                )}
                {isPemilik && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        title: 'Hapus Proyek',
                        message: `Yakin ingin menghapus proyek "${selectedProject.name}"?`,
                        subMessage:
                          'Semua riwayat progres, SPK, catatan bahan terpakai, dan borongan pada proyek ini akan dihapus permanen.',
                        confirmLabel: 'Ya, Hapus Proyek',
                        onConfirm: () => {
                          deleteProject(selectedProject.id);
                          setSelectedProjectId(null);
                        },
                      });
                    }}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-300 transition-colors"
                    title="Hapus Proyek"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedProjectId(null)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Interactive Progress Bar Slider */}
            <div className="px-4 py-3 bg-[#131418] border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-300">Update Progres:</span>
                <span className="font-mono-num font-bold text-base text-amber-400">
                  {selectedProject.progress}%
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  ({selectedProject.progress === 100 ? 'Selesai 100%' : 'Sedang Dikerjakan'})
                </span>
              </div>

              <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={selectedProject.progress}
                  onChange={(e) =>
                    updateProjectProgress(selectedProject.id, parseInt(e.target.value, 10))
                  }
                  className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
                />
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      updateProjectProgress(
                        selectedProject.id,
                        Math.min(100, selectedProject.progress + 10)
                      )
                    }
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold text-amber-400"
                  >
                    +10%
                  </button>
                  <button
                    type="button"
                    onClick={() => updateProjectProgress(selectedProject.id, 100)}
                    className="px-2 py-0.5 rounded bg-emerald-900/60 hover:bg-emerald-800 text-[11px] font-bold text-emerald-300"
                  >
                    100%
                  </button>
                </div>
              </div>
            </div>

            {/* KOLOM KETERANGAN / PESAN & INSTRUKSI PROYEK (DI BAGIAN TENGAH, DAPAT DIBACA OLEH ADMIN) */}
            <div className="px-4 py-3 bg-[#181a22] border-b border-zinc-800/90 transition-all">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-industrial text-xs sm:text-sm font-bold tracking-wide text-white">
                      Kolom Keterangan &amp; Instruksi Proyek
                    </span>
                    <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded">
                      Dapat Dibaca Admin
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {showNotesSaved && (
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-700/60">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Pesan Tersimpan</span>
                    </span>
                  )}

                  {!isEditingNotes && (
                    <button
                      type="button"
                      onClick={() => {
                        setProjectNotesDraft(selectedProject.notes || '');
                        setIsEditingNotes(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-amber-400 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 transition-all cursor-pointer shadow-sm"
                      title="Tulis atau ubah pesan instruksi untuk proyek ini"
                    >
                      <Edit3 className="w-3 h-3 text-amber-400" />
                      <span>{selectedProject.notes ? 'Ubah Pesan' : '+ Tinggalkan Pesan'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Tampilan Isi: Mode Edit vs Mode Baca */}
              {isEditingNotes ? (
                <div className="space-y-2 mt-1">
                  <textarea
                    value={projectNotesDraft}
                    onChange={(e) => setProjectNotesDraft(e.target.value)}
                    placeholder="Tulis pesan atau instruksi pengawasan untuk dibaca Admin (Contoh: PROYEK INI PERLU PENGAWASAN YG LUAR BIASA. Pastikan las matang & siku presisi)..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border-2 border-amber-500/60 text-zinc-100 text-xs sm:text-sm focus:border-amber-400 focus:outline-none placeholder-zinc-500 shadow-inner font-sans leading-relaxed"
                    autoFocus
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                    <span className="text-[10.5px] text-zinc-400 flex items-center gap-1">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>Pesan ini langsung tersimpan dan otomatis dibaca oleh Admin saat membuka proyek ini.</span>
                    </span>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {selectedProject.notes && (
                        <button
                          type="button"
                          onClick={() => {
                            setProjectNotesDraft('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-red-950/40 text-zinc-400 hover:text-red-300 text-xs font-medium transition-colors"
                        >
                          Kosongkan
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleCancelProjectNotes}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProjectNotes}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan Pesan</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : selectedProject.notes ? (
                <div
                  onClick={() => {
                    setProjectNotesDraft(selectedProject.notes || '');
                    setIsEditingNotes(true);
                  }}
                  className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-zinc-900/80 to-zinc-900/60 border border-amber-500/40 hover:border-amber-400/80 cursor-pointer transition-all group"
                  title="Klik untuk mengubah pesan instruksi"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5 border border-amber-500/30">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-amber-200 whitespace-pre-wrap leading-relaxed break-words">
                        {selectedProject.notes}
                      </p>
                      <div className="flex items-center gap-2 mt-2 pt-1 border-t border-amber-500/20">
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          <span className="font-semibold text-zinc-300">Pesan Pengawasan Aktif</span>
                          <span>•</span>
                          <span className="text-amber-400 group-hover:underline font-medium">Klik untuk ubah keterangan</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => {
                    setProjectNotesDraft('');
                    setIsEditingNotes(true);
                  }}
                  className="p-3 rounded-xl bg-zinc-900/50 border border-dashed border-zinc-700/80 hover:border-amber-500/60 cursor-pointer transition-all flex items-center justify-between gap-3 text-zinc-400 hover:text-zinc-200 group"
                  title="Klik untuk meninggalkan pesan"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-colors shrink-0" />
                    <span className="italic text-zinc-400 group-hover:text-zinc-300">
                      Belum ada pesan/keterangan pengawasan. Klik untuk meninggalkan pesan penting bagi Admin...
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-400 shrink-0 group-hover:underline">
                    + Tulis Pesan
                  </span>
                </div>
              )}
            </div>

            {/* Navigation Tabs in Detail Modal */}
            <div className="flex items-center gap-1 px-4 border-b border-zinc-800 bg-[#16181e] overflow-x-auto scrollbar-none">
              {[
                { key: 'overview', label: 'Ringkasan & Biaya', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                {
                  key: 'tobuy',
                  label: `Belum Dibeli (${(selectedProject.toBuyItems || []).filter((i) => !i.isPurchased).length})`,
                  icon: <ShoppingCart className="w-3.5 h-3.5" />,
                },
                {
                  key: 'materials',
                  label: `Bahan Terpakai (${selectedProject.usedMaterials?.length || 0})`,
                  icon: <Package className="w-3.5 h-3.5" />,
                },
                ...(isPemilik
                  ? [
                      {
                        key: 'wages',
                        label: `Borongan Tukang (${selectedProject.wages?.length || 0})`,
                        icon: <Users className="w-3.5 h-3.5" />,
                      },
                      {
                        key: 'payments',
                        label: `Pembayaran Klien (${selectedProject.payments?.length || 0})`,
                        icon: <DollarSign className="w-3.5 h-3.5" />,
                      },
                    ]
                  : []),
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDetailTab(tab.key as any)}
                  className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                    detailTab === tab.key
                      ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {/* TAB 1: OVERVIEW & FINANCE */}
              {detailTab === 'overview' && (
                <div className="space-y-4">
                  {/* Financial KPI Cards (Khusus Pemilik) */}
                  {isPemilik && (() => {
                    const fin = calculateProjectFinance(selectedProject);
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                          <div className="text-[10px] uppercase font-semibold text-zinc-500">
                            Nilai Kontrak (SPK)
                          </div>
                          <div className="text-sm sm:text-base font-bold text-amber-400 font-mono-num mt-0.5">
                            {formatIDR(fin.contractValue)}
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-1">
                            Masuk: {formatIDR(fin.totalPaidIn)}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                          <div className="text-[10px] uppercase font-semibold text-zinc-500">
                            Sisa Tagihan (Piutang)
                          </div>
                          <div className="text-sm sm:text-base font-bold text-red-400 font-mono-num mt-0.5">
                            {formatIDR(fin.remainingBill)}
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-1">
                            {fin.remainingBill === 0 ? '✓ Lunas' : 'Menunggu Pelunasan'}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                          <div className="text-[10px] uppercase font-semibold text-zinc-500">
                            Total Beban Proyek
                          </div>
                          <div className="text-sm sm:text-base font-bold text-zinc-200 font-mono-num mt-0.5">
                            {formatIDR(fin.totalExpense)}
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-1">
                            Mat: {formatIDR(fin.materialsCost)} | Upah: {formatIDR(fin.wagesCost)}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                          <div className="text-[10px] uppercase font-semibold text-zinc-500">
                            Estimasi Laba Bersih
                          </div>
                          <div
                            className={`text-sm sm:text-base font-bold font-mono-num mt-0.5 ${
                              fin.estimatedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {formatIDR(fin.estimatedProfit)}
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-1">
                            Margin: {fin.profitMargin.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Quick Summary Lists */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Belum Dibeli List */}
                    <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
                          <span>Daftar Barang Belum Dibeli</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setDetailTab('tobuy')}
                          className="text-[10px] font-semibold text-amber-400 hover:underline"
                        >
                          Kelola & Tambah
                        </button>
                      </div>

                      {selectedProject.toBuyItems?.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic py-2">Belum ada daftar barang belanja.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {selectedProject.toBuyItems.slice(0, 4).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded bg-black/40 border border-zinc-800/80"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    item.isPurchased ? 'bg-emerald-400' : 'bg-red-400'
                                  }`}
                                />
                                <span className={item.isPurchased ? 'line-through text-zinc-500' : 'text-zinc-200'}>
                                  {item.name}
                                </span>
                              </div>
                              <span className="text-zinc-400 font-mono">
                                {item.qty} {item.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Borongan Summary (Hanya Pemilik) */}
                    {isPemilik && (
                      <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-amber-400" />
                            <span>Borongan Tukang (Helper 20%)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setDetailTab('wages')}
                            className="text-[10px] font-semibold text-amber-400 hover:underline"
                          >
                            Rincian & Bayar
                          </button>
                        </div>

                        {selectedProject.wages?.length === 0 ? (
                          <p className="text-xs text-zinc-500 italic py-2">Belum ada borongan terdaftar.</p>
                        ) : (
                          <div className="space-y-2">
                            {selectedProject.wages.map((w) => (
                              <div
                                key={w.id}
                                className="p-2 rounded-lg bg-black/40 border border-zinc-800/80 text-xs flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-semibold text-zinc-200">{w.tukangName}</div>
                                  <div className="text-[10px] text-zinc-400 font-mono">
                                    Tukang: {formatIDR(w.baseWage)} + Helper (20%): {formatIDR(w.helperWage)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-amber-400 font-mono-num">
                                    {formatIDR(w.totalWage)}
                                  </div>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                      w.status === 'LUNAS'
                                        ? 'bg-emerald-950 text-emerald-300'
                                        : 'bg-amber-950 text-amber-300'
                                    }`}
                                  >
                                    {w.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: DAFTAR BARANG BELUM DIBELI (PROCUREMENT LIST) */}
              {detailTab === 'tobuy' && (
                <div className="space-y-4">
                  {/* Add To-buy Item Form */}
                  <form
                    onSubmit={handleAddPendingItem}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5"
                  >
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Catat Barang yang Harus Dibeli</span>
                    </div>

                    <div className={`grid grid-cols-1 ${isPemilik ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-2`}>
                      <div className={isPemilik ? 'sm:col-span-2' : 'sm:col-span-1'}>
                        <input
                          type="text"
                          value={toBuyName}
                          onChange={(e) => setToBuyName(e.target.value)}
                          placeholder="Nama barang (misal: Atap Alderon, Dynabolt M12)"
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                          required
                        />
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="any"
                          value={toBuyQty}
                          onChange={(e) => setToBuyQty(e.target.value)}
                          placeholder="Qty"
                          className="w-16 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white font-mono"
                          required
                        />
                        <select
                          value={toBuyUnit}
                          onChange={(e) => setToBuyUnit(e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white"
                        >
                          <option value="Batang">Batang</option>
                          <option value="Lembar">Lembar</option>
                          <option value="Kotak">Kotak</option>
                          <option value="Pcs">Pcs</option>
                          <option value="Roll">Roll</option>
                          <option value="Kaleng">Kaleng</option>
                          <option value="Kg">Kg</option>
                        </select>
                      </div>
                      {isPemilik ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={toBuyPrice}
                            onChange={(e) => {
                              const num = e.target.value.replace(/\D/g, '');
                              setToBuyPrice(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                            }}
                            placeholder="Est. Harga (Rp)"
                            className="w-full px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-amber-400 font-mono"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0"
                          >
                            Tambah
                          </button>
                        </div>
                      ) : (
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0"
                        >
                          Tambah ke Daftar
                        </button>
                      )}
                    </div>
                  </form>

                  {/* To-buy Items Table */}
                  <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-900 text-zinc-400 font-semibold border-b border-zinc-800">
                        <tr>
                          <th className="p-2.5 w-10 text-center">Status</th>
                          <th className="p-2.5">Nama Barang</th>
                          <th className="p-2.5">Jumlah</th>
                          {isPemilik && <th className="p-2.5">Est. Harga Satuan</th>}
                          {isPemilik && <th className="p-2.5">Subtotal Est.</th>}
                          <th className="p-2.5 w-10 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {(selectedProject.toBuyItems || []).length === 0 ? (
                          <tr>
                            <td colSpan={isPemilik ? 6 : 4} className="p-4 text-center text-zinc-500 italic">
                              Belum ada item belanja. Tambahkan melalui form di atas.
                            </td>
                          </tr>
                        ) : (
                          selectedProject.toBuyItems.map((item) => (
                            <tr
                              key={item.id}
                              className={item.isPurchased ? 'bg-emerald-950/20 text-zinc-400' : 'hover:bg-zinc-800/40'}
                            >
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleToBuyItem(selectedProject.id, item.id)}
                                  className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                                    item.isPurchased
                                      ? 'bg-emerald-500 border-emerald-400 text-black font-bold'
                                      : 'border-zinc-600 hover:border-amber-400'
                                  }`}
                                  title={item.isPurchased ? 'Tandai belum dibeli' : 'Tandai sudah dibeli'}
                                >
                                  {item.isPurchased && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </button>
                              </td>
                              <td className="p-2.5 font-medium text-zinc-200">
                                <span className={item.isPurchased ? 'line-through text-zinc-400' : ''}>
                                  {item.name}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono">
                                {item.qty} {item.unit}
                              </td>
                              {isPemilik && (
                                <td className="p-2.5 font-mono text-zinc-400">
                                  {formatIDR(item.estPrice)}
                                </td>
                              )}
                              {isPemilik && (
                                <td className="p-2.5 font-mono font-semibold text-amber-400">
                                  {formatIDR(item.qty * item.estPrice)}
                                </td>
                              )}
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => deleteToBuyItem(selectedProject.id, item.id)}
                                  className="text-zinc-500 hover:text-red-400"
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

              {/* TAB 3: BAHAN TERPAKAI (DEDUCT STOCK AUTOMATICALLY) */}
              {detailTab === 'materials' && (
                <div className="space-y-4">
                  {/* Add Used Material Form */}
                  <form
                    onSubmit={handleUseMaterial}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        <span>Catat Pengeluaran Bahan ke Proyek Ini</span>
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        {onOpenScanForProject && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProjectId(null);
                              onOpenScanForProject(selectedProject.id);
                            }}
                            className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm"
                          >
                            <ScanLine className="w-3 h-3 text-amber-400" />
                            <span>Scan Nota AI Otomatis</span>
                          </button>
                        )}

                        {/* Source switcher buttons */}
                        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setIsFromStock(true);
                              if (selectedStockId === 'CUSTOM') setSelectedStockId('');
                            }}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                              isFromStock
                                ? 'bg-amber-500 text-black shadow-sm'
                                : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            📦 Dari Stok Gudang
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsFromStock(false)}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                              !isFromStock
                                ? 'bg-amber-500 text-black shadow-sm'
                                : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            🛒 Beli Langsung (Luar)
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      {/* Item Selector (from Stock Catalog) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-zinc-300">
                            {isFromStock
                              ? 'Pilih Bahan dari Stok Gudang *'
                              : 'Pilih Jenis Bahan dari Stok Gudang (Katalog yang Sama) *'}
                          </label>
                          {isFromStock && (
                            <button
                              type="button"
                              onClick={() => setShowStockPickerModal(true)}
                              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Package className="w-3.5 h-3.5" />
                              <span>Buka Tabel Stok Gudang</span>
                            </button>
                          )}
                        </div>

                        {/* Selected Stock Banner / Big Open Table Button */}
                        {isFromStock && selectedStockId && inventory.find((i) => i.id === selectedStockId) ? (
                          (() => {
                            const selectedStockItem = inventory.find((i) => i.id === selectedStockId)!;
                            return (
                              <div className="p-3 rounded-xl bg-zinc-800/80 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                                    <Package className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-700 text-zinc-300">
                                        {selectedStockItem.sku}
                                      </span>
                                      <span className="font-bold text-white text-xs sm:text-sm truncate">
                                        {selectedStockItem.name}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                                      <span className="font-mono text-emerald-400 font-semibold">
                                        Sisa: {selectedStockItem.currentStock} {selectedStockItem.unit}
                                      </span>
                                      <span className="text-zinc-600">•</span>
                                      <span>Rak: {selectedStockItem.location || 'Gudang'}</span>
                                      {isPemilik && (
                                        <>
                                          <span className="text-zinc-600">•</span>
                                          <span className="text-amber-400 font-mono">
                                            {formatIDR(selectedStockItem.avgPurchasePrice)}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowStockPickerModal(true)}
                                  className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold shrink-0 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <Search className="w-3 h-3 text-amber-400" />
                                  <span>Ganti Bahan</span>
                                </button>
                              </div>
                            );
                          })()
                        ) : isFromStock ? (
                          <div
                            onClick={() => setShowStockPickerModal(true)}
                            className="p-3 rounded-xl bg-zinc-800/60 border border-dashed border-zinc-700 hover:border-amber-500/60 hover:bg-zinc-800 transition-all cursor-pointer flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-zinc-200">
                                  Klik untuk Buka Daftar Tabel Stok Gudang
                                </div>
                                <div className="text-[11px] text-zinc-400">
                                  Tampilan tabel stok lengkap (SKU, nama, sisa stok, rak) — format tabel rapi, bukan grid
                                </div>
                              </div>
                            </div>
                            <span className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shrink-0">
                              Buka Tabel Stok
                            </span>
                          </div>
                        ) : null}

                        {/* Dropdown Selector (Works as quick-select or when not from stock) */}
                        <div className="mt-1.5">
                          <select
                            value={selectedStockId}
                            onChange={(e) => handleStockSelectChange(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                            required={isFromStock || !customMatName}
                          >
                            <option value="">-- Atau Pilih Cepat dari Dropdown --</option>
                            {inventory.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name} ({i.unit}) {isFromStock ? `• Sisa: ${i.currentStock} ${i.unit}` : ''} {isPemilik ? `• ${formatIDR(i.avgPurchasePrice)}` : ''}
                              </option>
                            ))}
                            {!isFromStock && (
                              <option value="CUSTOM">+ Ketik Nama Bahan Baru (Di Luar Stok Gudang)</option>
                            )}
                          </select>
                        </div>
                      </div>

                      {/* If custom material name is selected */}
                      {!isFromStock && selectedStockId === 'CUSTOM' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1">
                              Nama Bahan Luar *
                            </label>
                            <input
                              type="text"
                              value={customMatName}
                              onChange={(e) => setCustomMatName(e.target.value)}
                              placeholder="Contoh: Kawat Las Khusus / Thinner A Super"
                              className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1">
                              Satuan *
                            </label>
                            <input
                              type="text"
                              value={matUnit}
                              onChange={(e) => setMatUnit(e.target.value)}
                              placeholder="Batang / Kg / dsb"
                              className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                              required
                            />
                          </div>
                        </div>
                      )}

                      {/* Quantity, Unit, Price (Pemilik only), Submit */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                        <div className={!isFromStock && isPemilik ? 'sm:col-span-4' : 'sm:col-span-6'}>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Jumlah / Kuantiti ({matUnit || 'Satuan'}) *
                          </label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              step="any"
                              value={matQty}
                              onChange={(e) => setMatQty(e.target.value)}
                              placeholder="Kuantiti"
                              className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white font-mono"
                              required
                            />
                            <div className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 font-mono flex items-center shrink-0">
                              {matUnit || 'Satuan'}
                            </div>
                          </div>
                        </div>

                        {!isFromStock && (
                          <div className="sm:col-span-4">
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Harga Beli Satuan (Rp) {isPemilik ? '' : '(Opsional)'}
                            </label>
                            <input
                              type="text"
                              value={matCost}
                              onChange={(e) => {
                                const num = e.target.value.replace(/\D/g, '');
                                setMatCost(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                              }}
                              placeholder="Harga beli satuan"
                              className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-amber-400 font-mono"
                            />
                          </div>
                        )}

                        <div className={!isFromStock ? 'sm:col-span-4' : 'sm:col-span-6'}>
                          <button
                            type="submit"
                            className={`w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                              isFromStock
                                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                            }`}
                          >
                            {isFromStock ? (
                              <>
                                <Package className="w-3.5 h-3.5" />
                                <span>Ambil dari Gudang (Kurangi Stok)</span>
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="w-3.5 h-3.5" />
                                <span>Catat Beli Langsung (Luar)</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Informational Status Badge */}
                      <div className="text-[11px] text-zinc-400 flex items-center gap-2 pt-0.5">
                        {isFromStock ? (
                          <span className="inline-flex items-center gap-1 text-amber-400/90">
                            ℹ️ Stok fisik di gudang akan otomatis terpotong saat tombol diklik.
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400/90">
                            ℹ️ Barang dibeli langsung di luar untuk proyek ini (Stok fisik gudang aman tidak terpotong).
                          </span>
                        )}
                      </div>
                    </div>
                  </form>

                  {/* Materials Table */}
                  <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-900 text-zinc-400 font-semibold border-b border-zinc-800">
                        <tr>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Nama Bahan</th>
                          <th className="p-2.5">Sumber</th>
                          <th className="p-2.5">Kuantiti</th>
                          {isPemilik && <th className="p-2.5">Biaya Satuan</th>}
                          {isPemilik && <th className="p-2.5">Total Biaya</th>}
                          <th className="p-2.5 w-10 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {(selectedProject.usedMaterials || []).length === 0 ? (
                          <tr>
                            <td colSpan={isPemilik ? 7 : 5} className="p-4 text-center text-zinc-500 italic">
                              Belum ada bahan tercatat untuk proyek ini.
                            </td>
                          </tr>
                        ) : (
                          selectedProject.usedMaterials.map((mat) => (
                            <tr key={mat.id} className="hover:bg-zinc-800/40">
                              <td className="p-2.5 font-mono text-zinc-400">{formatDate(mat.date)}</td>
                              <td className="p-2.5 font-medium text-zinc-200">{mat.name}</td>
                              <td className="p-2.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    mat.fromStock
                                      ? 'bg-blue-950 text-blue-400 border border-blue-800'
                                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  }`}
                                >
                                  {mat.fromStock ? 'Stok Gudang' : 'Beli Langsung'}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono">
                                {mat.qty} {mat.unit}
                              </td>
                              {isPemilik && (
                                <td className="p-2.5 font-mono text-zinc-300">
                                  <div className="flex items-center gap-1.5">
                                    <span>{formatIDR(mat.costPerUnit)}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditUsedMaterial(mat)}
                                      className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                                      title="Ubah Biaya Satuan Bahan Ini"
                                    >
                                      <Pencil className="w-3 h-3 text-amber-400" />
                                    </button>
                                  </div>
                                </td>
                              )}
                              {isPemilik && (
                                <td className="p-2.5 font-mono font-bold text-amber-400">
                                  {formatIDR(mat.totalCost)}
                                </td>
                              )}
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditUsedMaterial(mat)}
                                    className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                                    title="Ubah Harga / Kuantiti Bahan"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const isFromInv = Boolean(mat.fromStock);
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: 'Hapus Pemakaian Bahan',
                                        message: `Hapus catatan pemakaian bahan "${mat.name}" (${mat.qty} ${mat.unit})?`,
                                        subMessage: isFromInv
                                          ? `Stok gudang akan otomatis dikembalikan (+${mat.qty} ${mat.unit}) ke kartu stok.`
                                          : undefined,
                                        confirmLabel: 'Ya, Hapus',
                                        onConfirm: () => {
                                          deleteUsedMaterial(selectedProject.id, mat.id);
                                        },
                                      });
                                    }}
                                    className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                                    title="Hapus Pemakaian Bahan"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: BORONGAN TUKANG & HELPER 20% */}
              {detailTab === 'wages' && (
                <div className="space-y-4">
                  {/* Add Wage Form */}
                  <form
                    onSubmit={handleAddWage}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5"
                  >
                    <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>Form Upah Borongan (Helper Otomatis 20%)</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        Rumus: Total = Upah Tukang × 1,2
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <input
                          type="text"
                          value={tukangName}
                          onChange={(e) => setTukangName(e.target.value)}
                          placeholder="Nama Tukang Las (misal: Mas Joko)"
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white"
                          required
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={helperName}
                          onChange={(e) => setHelperName(e.target.value)}
                          placeholder="Nama Helper (misal: Rian)"
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white"
                        />
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={baseWage}
                          onChange={(e) => {
                            const num = e.target.value.replace(/\D/g, '');
                            setBaseWage(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                          }}
                          placeholder="Upah Tukang (Rp)"
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-amber-400 font-mono font-bold"
                          required
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0"
                        >
                          Hitung & Catat
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Wages Cards */}
                  <div className="space-y-3">
                    {(selectedProject.wages || []).length === 0 ? (
                      <p className="p-4 text-center text-zinc-500 italic bg-zinc-900/40 rounded-xl border border-zinc-800">
                        Belum ada data borongan pada proyek ini.
                      </p>
                    ) : (
                      selectedProject.wages.map((wage) => (
                        <div
                          key={wage.id}
                          className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{wage.tukangName}</span>
                              <span className="text-zinc-400 text-xs">+ {wage.helperName || 'Helper'}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  wage.status === 'LUNAS'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                                }`}
                              >
                                {wage.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3 mt-2 text-xs font-mono">
                              <div>
                                <span className="text-[10px] text-zinc-500 block">Upah Tukang</span>
                                <span className="text-zinc-300">{formatIDR(wage.baseWage)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-zinc-500 block">Helper (20%)</span>
                                <span className="text-amber-400/90">{formatIDR(wage.helperWage)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-zinc-500 block">Total Borongan (1.2×)</span>
                                <span className="font-bold text-amber-400">{formatIDR(wage.totalWage)}</span>
                              </div>
                            </div>

                            <div className="text-[11px] text-zinc-400 mt-1.5 font-mono">
                              Sudah Dibayar: <strong className="text-emerald-400">{formatIDR(wage.paidAmount)}</strong> •
                              Sisa: <strong className="text-red-400">{formatIDR(wage.totalWage - wage.paidAmount)}</strong>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {wage.status !== 'LUNAS' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPayingWageId(wage.id);
                                  setPayWageAmount(
                                    (wage.totalWage - wage.paidAmount).toLocaleString('id-ID')
                                  );
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow"
                              >
                                Bayar Upah
                              </button>
                            )}

                            {isPemilik && (
                              <button
                                type="button"
                                onClick={() => deleteLaborWage(selectedProject.id, wage.id)}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: PEMBAYARAN KLIEN (TERMIN & PANJAR) */}
              {detailTab === 'payments' && (
                <div className="space-y-4">
                  {/* Add Payment Form */}
                  <form
                    onSubmit={handleAddPayment}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5"
                  >
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Catat Uang Masuk dari Klien (DP / Termin / Pelunasan)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <select
                          value={paymentType}
                          onChange={(e) => setPaymentType(e.target.value as any)}
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white"
                        >
                          <option value="PANJAR">Uang Muka / DP</option>
                          <option value="TERMIN_1">Termin 1</option>
                          <option value="TERMIN_2">Termin 2</option>
                          <option value="PELUNASAN">Pelunasan Akhir</option>
                        </select>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={paymentAmount}
                          onChange={(e) => {
                            const num = e.target.value.replace(/\D/g, '');
                            setPaymentAmount(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                          }}
                          placeholder="Nominal Pembayaran (Rp)"
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-emerald-400 font-mono font-bold"
                          required
                        />
                      </div>

                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          placeholder="Catatan / Bukti transfer"
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Payment List Table */}
                  <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-900 text-zinc-400 font-semibold border-b border-zinc-800">
                        <tr>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Tipe Pembayaran</th>
                          <th className="p-2.5">Keterangan</th>
                          <th className="p-2.5">Nominal</th>
                          <th className="p-2.5 w-10 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {(selectedProject.payments || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-zinc-500 italic">
                              Belum ada pembayaran masuk dari klien.
                            </td>
                          </tr>
                        ) : (
                          selectedProject.payments.map((p) => (
                            <tr key={p.id} className="hover:bg-zinc-800/40">
                              <td className="p-2.5 font-mono text-zinc-400">{formatDate(p.date)}</td>
                              <td className="p-2.5 font-bold text-amber-400">{p.type}</td>
                              <td className="p-2.5 text-zinc-300">{p.notes || '-'}</td>
                              <td className="p-2.5 font-mono font-bold text-emerald-400">
                                {formatIDR(p.amount)}
                              </td>
                              <td className="p-2.5 text-center">
                                {isPemilik && (
                                  <button
                                    type="button"
                                    onClick={() => deleteProjectPayment(selectedProject.id, p.id)}
                                    className="text-zinc-500 hover:text-red-400"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL BAYAR UPAH BORONGAN */}
      {payingWageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#181a20] border border-emerald-500/40 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white text-sm">Pembayaran Upah Borongan</h3>
            <p className="text-xs text-zinc-400">
              Uang yang dibayarkan akan langsung otomatis memotong sisa borongan dan tercatat di Arus Kas.
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
                  onClick={() => setPayingWageId(null)}
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

      {/* MODAL UBAH BIAYA SATUAN & RINCIAN BAHAN TERPAKAI */}
      {editingUsedMat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#16181f] border border-amber-500/40 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Ubah Biaya Satuan Bahan</h3>
                  <p className="text-[11px] text-zinc-400">Sesuaikan harga satuan atau rincian bahan proyek</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUsedMat(null)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUsedMaterial} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nama Bahan
                </label>
                <input
                  type="text"
                  value={editUsedMatName}
                  onChange={(e) => setEditUsedMatName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Kuantiti
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editUsedMatQty}
                    onChange={(e) => setEditUsedMatQty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Satuan
                  </label>
                  <input
                    type="text"
                    value={editUsedMatUnit}
                    onChange={(e) => setEditUsedMatUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Biaya Satuan (Rp) *
                </label>
                <input
                  type="text"
                  value={editUsedMatCost}
                  onChange={(e) => {
                    const num = e.target.value.replace(/\D/g, '');
                    setEditUsedMatCost(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                  }}
                  placeholder="Contoh: 85.000"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-amber-400 font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              {/* Live Preview Subtotal */}
              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium">Subtotal Biaya Baru:</span>
                <span className="font-bold font-mono text-amber-400 text-sm">
                  {formatIDR(
                    (parseFloat(editUsedMatQty.replace(',', '.')) || 0) *
                      (parseInt(editUsedMatCost.replace(/\D/g, ''), 10) || 0)
                  )}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUsedMat(null)}
                  className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors shadow-sm"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PILIH BAHAN DARI STOK GUDANG (TABLE LIST SEPERTI TAMPILAN STOK, BUKAN GRID) */}
      {showStockPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-4xl bg-[#14161d] border border-amber-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-[#1c1e27] via-[#161821] to-[#14161d] border-b border-zinc-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-industrial text-base font-bold text-white flex items-center gap-2">
                    <span>Pilih Bahan dari Stok Gudang</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      Format Tabel Stok
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Klik baris barang atau tombol "Pilih" untuk memakai bahan dari gudang
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStockPickerModal(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-3 bg-[#111217] border-b border-zinc-800 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={stockPickerSearch}
                  onChange={(e) => setStockPickerSearch(e.target.value)}
                  placeholder="Cari nama bahan, kode SKU, atau lokasi rak..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  autoFocus
                />
                {stockPickerSearch && (
                  <button
                    type="button"
                    onClick={() => setStockPickerSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto p-0.5 bg-zinc-900 rounded-xl border border-zinc-800 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setStockPickerCategory('ALL')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                    stockPickerCategory === 'ALL'
                      ? 'bg-amber-500 text-black font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Semua ({inventory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStockPickerCategory('material')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                    stockPickerCategory === 'material'
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Material ({inventory.filter((i) => i.category === 'material').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStockPickerCategory('consumable')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                    stockPickerCategory === 'consumable'
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Consumable ({inventory.filter((i) => i.category === 'consumable').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStockPickerCategory('AVAILABLE')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                    stockPickerCategory === 'AVAILABLE'
                      ? 'bg-purple-600 text-white font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Ada Stok Saja
                </button>
              </div>
            </div>

            {/* Table View (Format Tabel Stok Rapi, Bukan Grid) */}
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const filtered = inventory.filter((item) => {
                  const matchCat =
                    stockPickerCategory === 'ALL' ||
                    (stockPickerCategory === 'AVAILABLE'
                      ? item.currentStock > 0
                      : item.category === stockPickerCategory);
                  const q = stockPickerSearch.toLowerCase();
                  const matchSearch =
                    item.name.toLowerCase().includes(q) ||
                    item.sku.toLowerCase().includes(q) ||
                    (item.location || '').toLowerCase().includes(q);
                  return matchCat && matchSearch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center text-zinc-500 italic">
                      Tidak ada barang di gudang yang sesuai dengan pencarian atau filter.
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#161821] text-zinc-400 font-semibold border-b border-zinc-800 z-10 shadow-sm">
                      <tr>
                        <th className="p-3 w-28">Kode SKU</th>
                        <th className="p-3">Nama Material & Spesifikasi</th>
                        <th className="p-3 w-24">Kategori</th>
                        <th className="p-3 w-28">Lokasi Rak</th>
                        <th className="p-3 w-32">Sisa Stok Fisik</th>
                        {isPemilik && <th className="p-3 w-28 text-right">Harga Satuan</th>}
                        <th className="p-3 w-24 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {filtered.map((item) => {
                        const isSelected = selectedStockId === item.id;
                        const isZero = item.currentStock === 0;
                        const isLow = item.currentStock <= item.minStock;

                        return (
                          <tr
                            key={item.id}
                            onClick={() => handleSelectStockItem(item)}
                            className={`transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/15 border-l-2 border-amber-500'
                                : 'hover:bg-zinc-800/60'
                            }`}
                          >
                            <td className="p-3 font-mono font-medium text-zinc-400">
                              {item.sku}
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                <span>{item.name}</span>
                                {isSelected && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500 text-black">
                                    Terpilih
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
                            <td className="p-3">
                              <div className="flex items-center gap-1.5 font-mono">
                                <span
                                  className={`font-bold ${
                                    isZero
                                      ? 'text-red-400'
                                      : isLow
                                      ? 'text-amber-400'
                                      : 'text-emerald-400'
                                  }`}
                                >
                                  {item.currentStock} {item.unit}
                                </span>
                                {isZero && (
                                  <span className="text-[9px] font-bold px-1 rounded bg-red-500/20 text-red-300">
                                    Habis
                                  </span>
                                )}
                              </div>
                            </td>
                            {isPemilik && (
                              <td className="p-3 font-mono text-zinc-300 font-medium text-right">
                                {formatIDR(item.avgPurchasePrice)}
                              </td>
                            )}
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleSelectStockItem(item)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-500 text-black shadow-sm'
                                    : 'bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-200 border border-zinc-700'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="w-3 h-3 stroke-[3]" />
                                    <span>Dipilih</span>
                                  </>
                                ) : (
                                  <span>Pilih</span>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#111217] border-t border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-500">
                Format tabel stok rapi — klik baris untuk memilih material.
              </span>
              <button
                type="button"
                onClick={() => setShowStockPickerModal(false)}
                className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
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
    </div>
  );
};
