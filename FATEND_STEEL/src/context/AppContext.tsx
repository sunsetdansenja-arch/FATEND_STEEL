import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserRole,
  UserSession,
  PinConfig,
  Project,
  InventoryItem,
  StockMutation,
  ReceiptScan,
  KasbonWorker,
  CashflowRecord,
  ToBuyItem,
  UsedMaterial,
  ProjectPayment,
  LaborWage,
  ProjectExpense,
  StockCategory,
  DailyCashRecord,
} from '../types';
import {
  DEFAULT_PIN_CONFIG,
  INITIAL_INVENTORY,
  INITIAL_MUTATIONS,
  INITIAL_PROJECTS,
  INITIAL_KASBON_WORKERS,
  INITIAL_RECEIPTS,
  INITIAL_CASHFLOW,
  INITIAL_DAILY_CASH,
  INITIAL_DELETED_PROJECT_IDS,
  INITIAL_DELETED_DAILY_CASH_IDS,
} from '../data/initialData';
import { generateId } from '../utils/formatters';
import { matchScannedItemToInventory } from '../utils/stockMatcher';
import {
  pushToCloud,
  pullFromCloud,
  subscribeToCloudChanges,
  getIsRemoteSyncInProgress,
  WorkshopCloudData,
} from '../services/cloudSync';

interface AppContextType {
  session: UserSession | null;
  pinConfig: PinConfig;
  projects: Project[];
  inventory: InventoryItem[];
  mutations: StockMutation[];
  receipts: ReceiptScan[];
  workers: KasbonWorker[];
  cashflow: CashflowRecord[];
  
  // Cloud Sync
  cloudStatus: 'connected' | 'connecting' | 'error' | 'syncing';
  lastSyncedAt: string | null;
  forceUploadToCloud: () => Promise<boolean>;
  forceDownloadFromCloud: () => Promise<boolean>;
  restoreMasterWorkshopData: () => Promise<{ success: boolean; projectCount: number; stockCount: number; mutationCount: number; workerCount: number; dailyCashCount: number }>;
  restoreDailyCashFromWorkshop: () => Promise<{ success: boolean; count: number; balance: number }>;
  importMasterPayload: (payloadData: any) => Promise<{
    success: boolean;
    projectCount: number;
    stockCount: number;
    mutationCount: number;
    dailyCashCount: number;
    workerCount: number;
    cashflowCount: number;
    receiptCount: number;
  }>;
  
  // Auth
  loginWithPin: (pin: string) => { success: boolean; role?: UserRole; message: string };
  logout: () => void;
  updatePin: (role: UserRole, oldPin: string, newPin: string) => boolean;

  // Project Actions
  addProject: (data: Omit<Project, 'id' | 'createdAt' | 'toBuyItems' | 'usedMaterials' | 'payments' | 'wages' | 'otherExpenses'>) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  updateProjectProgress: (id: string, progress: number) => void;
  addToBuyItem: (projectId: string, item: Omit<ToBuyItem, 'id' | 'isPurchased'>) => void;
  toggleToBuyItem: (projectId: string, itemId: string) => void;
  deleteToBuyItem: (projectId: string, itemId: string) => void;
  useMaterialInProject: (
    projectId: string,
    material: {
      inventoryItemId?: string;
      name: string;
      qty: number;
      unit: string;
      costPerUnit: number;
      fromStock: boolean;
      date?: string;
    }
  ) => void;
  deleteUsedMaterial: (projectId: string, materialId: string) => void;
  updateUsedMaterial: (
    projectId: string,
    materialId: string,
    updates: {
      costPerUnit?: number;
      qty?: number;
      name?: string;
      unit?: string;
    }
  ) => void;
  addProjectPayment: (projectId: string, payment: Omit<ProjectPayment, 'id'>) => void;
  deleteProjectPayment: (projectId: string, paymentId: string) => void;
  addLaborWage: (projectId: string, wage: { tukangName: string; helperName?: string; baseWage: number; notes?: string }) => void;
  payLaborWage: (projectId: string, wageId: string, amount: number, notes?: string) => void;
  deleteLaborWage: (projectId: string, wageId: string) => void;
  addProjectExpense: (projectId: string, expense: Omit<ProjectExpense, 'id'>) => void;
  deleteProjectExpense: (projectId: string, expenseId: string) => void;

  // Inventory & Stock
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'updatedAt'>) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  restockItem: (itemId: string, qty: number, unitCost: number, notes?: string, recordCashflow?: boolean) => void;
  adjustStock: (itemId: string, newStock: number, reason: string) => void;

  // Receipts
  processScannedReceipt: (
    receipt: Omit<ReceiptScan, 'id' | 'createdAt'>,
    autoAllocate: 'GUDANG' | 'PROYEK',
    targetProjectId?: string
  ) => void;
  deleteReceipt: (id: string) => void;
  clearAllReceipts: () => void;

  // Kasbon
  addWorker: (worker: Omit<KasbonWorker, 'id' | 'totalBorrowed' | 'totalPaid' | 'balance' | 'transactions'>) => void;
  updateWorker: (id: string, updates: Partial<KasbonWorker>) => void;
  deleteWorker: (id: string) => void;
  addKasbonTx: (workerId: string, type: 'PINJAM' | 'BAYAR_CICILAN', amount: number, notes?: string, date?: string) => void;

  // Cashflow
  addCashflowRecord: (record: Omit<CashflowRecord, 'id' | 'createdAt'>) => void;
  deleteCashflowRecord: (id: string) => void;
  clearAllCashflow: () => void;
  closePeriodAndZeroCash: (notes?: string) => { success: boolean; amount: number };

  // Buku Kas Harian (Independent / Personal - Accessible by Pemilik & Admin)
  dailyCashRecords: DailyCashRecord[];
  addDailyCashRecord: (record: Omit<DailyCashRecord, 'id' | 'createdAt'>) => void;
  updateDailyCashRecord: (id: string, updates: Partial<DailyCashRecord>) => void;
  deleteDailyCashRecord: (id: string) => void;
  clearAllDailyCash: () => void;
  zeroOutDailyCashBalance: (notes?: string) => { success: boolean; amount: number; type: 'MASUK' | 'KELUAR' };
  resetDailyCashBook: () => void;

  // Reset
  resetDataToDefault: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Persistence state
  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('fatend_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [pinConfig, setPinConfig] = useState<PinConfig>(() => {
    const saved = localStorage.getItem('fatend_pins');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Normalize if was previous default
        const pPin = parsed.pemilikPin === '1988' ? '1234' : (parsed.pemilikPin || '1234');
        const aPin = parsed.adminPin === '4321' ? '5678' : (parsed.adminPin || '5678');
        return { pemilikPin: pPin, adminPin: aPin };
      } catch {
        return DEFAULT_PIN_CONFIG;
      }
    }
    return DEFAULT_PIN_CONFIG;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('fatend_projects');
    if (saved) {
      try {
        const parsed: Project[] = JSON.parse(saved);
        // Clean out prj_4 and any tombstoned project IDs
        return parsed.filter((p) => p.id !== 'prj_4' && !INITIAL_DELETED_PROJECT_IDS.includes(p.id));
      } catch {
        return INITIAL_PROJECTS.filter((p) => !INITIAL_DELETED_PROJECT_IDS.includes(p.id));
      }
    }
    return INITIAL_PROJECTS.filter((p) => !INITIAL_DELETED_PROJECT_IDS.includes(p.id));
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('fatend_inventory');
    return saved ? JSON.parse(saved) : INITIAL_INVENTORY;
  });

  const [mutations, setMutations] = useState<StockMutation[]>(() => {
    const saved = localStorage.getItem('fatend_mutations');
    return saved ? JSON.parse(saved) : INITIAL_MUTATIONS;
  });

  const [receipts, setReceipts] = useState<ReceiptScan[]>(() => {
    const saved = localStorage.getItem('fatend_receipts');
    return saved ? JSON.parse(saved) : INITIAL_RECEIPTS;
  });

  const [workers, setWorkers] = useState<KasbonWorker[]>(() => {
    const saved = localStorage.getItem('fatend_workers');
    return saved ? JSON.parse(saved) : INITIAL_KASBON_WORKERS;
  });

  const [cashflow, setCashflow] = useState<CashflowRecord[]>(() => {
    const saved = localStorage.getItem('fatend_cashflow');
    return saved ? JSON.parse(saved) : INITIAL_CASHFLOW;
  });

  const [dailyCashRecords, setDailyCashRecords] = useState<DailyCashRecord[]>(() => {
    const saved = localStorage.getItem('fatend_daily_cash');
    if (saved) {
      try {
        const parsed: DailyCashRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter((d) => !INITIAL_DELETED_DAILY_CASH_IDS.includes(d.id));
          if (filtered.length > 0) return filtered;
        }
      } catch {
        return INITIAL_DAILY_CASH;
      }
    }
    return INITIAL_DAILY_CASH;
  });

  // Sync to LocalStorage
  useEffect(() => {
    if (session) {
      localStorage.setItem('fatend_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('fatend_session');
    }
  }, [session]);

  useEffect(() => {
    localStorage.setItem('fatend_pins', JSON.stringify(pinConfig));
  }, [pinConfig]);

  useEffect(() => {
    localStorage.setItem('fatend_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('fatend_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('fatend_mutations', JSON.stringify(mutations));
  }, [mutations]);

  useEffect(() => {
    localStorage.setItem('fatend_receipts', JSON.stringify(receipts));
  }, [receipts]);

  useEffect(() => {
    localStorage.setItem('fatend_workers', JSON.stringify(workers));
  }, [workers]);

  useEffect(() => {
    localStorage.setItem('fatend_cashflow', JSON.stringify(cashflow));
  }, [cashflow]);

  useEffect(() => {
    localStorage.setItem('fatend_daily_cash', JSON.stringify(dailyCashRecords));
  }, [dailyCashRecords]);

  // Cloud Synchronization (Firestore)
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'connecting' | 'error' | 'syncing'>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const isInitialMountRef = React.useRef(true);
  const hasLoadedRemoteRef = React.useRef(false);

  const deletedProjectIdsRef = React.useRef<Set<string>>((() => {
    try {
      const saved = localStorage.getItem('fatend_deleted_projects');
      const parsed = saved ? JSON.parse(saved) : INITIAL_DELETED_PROJECT_IDS;
      return new Set(Array.isArray(parsed) ? parsed : INITIAL_DELETED_PROJECT_IDS);
    } catch {
      return new Set(INITIAL_DELETED_PROJECT_IDS);
    }
  })());

  const deletedInventoryIdsRef = React.useRef<Set<string>>((() => {
    try {
      const saved = localStorage.getItem('fatend_deleted_inventory');
      const parsed = saved ? JSON.parse(saved) : [];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  })());

  const deletedDailyCashIdsRef = React.useRef<Set<string>>((() => {
    try {
      const saved = localStorage.getItem('fatend_deleted_daily_cash');
      const parsed = saved ? JSON.parse(saved) : [];
      const set = new Set(Array.isArray(parsed) ? parsed : []);
      INITIAL_DAILY_CASH.forEach((dc) => set.delete(dc.id));
      return set;
    } catch {
      return new Set();
    }
  })());

  const deletedSubItemIdsRef = React.useRef<Set<string>>((() => {
    try {
      const saved = localStorage.getItem('fatend_deleted_subitems');
      const parsed = saved ? JSON.parse(saved) : [];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  })());

  // =========================================================================
  // SMART MERGE HELPER FUNCTIONS (Prevent any newly inputted item from being lost)
  // =========================================================================

  function mergeSubArray<T extends { id: string }>(
    localList: T[] = [],
    remoteList: T[] = [],
    deletedSubIds: Set<string>,
    resolveConflict?: (localItem: T, remoteItem: T) => T
  ): T[] {
    const map = new Map<string, T>();

    // 1. Ingest remote sub-items
    for (const item of remoteList || []) {
      if (item && item.id && !deletedSubIds.has(item.id)) {
        map.set(item.id, item);
      }
    }

    // 2. Ingest local sub-items (preserving local additions!)
    for (const item of localList || []) {
      if (!item || !item.id || deletedSubIds.has(item.id)) continue;

      if (map.has(item.id)) {
        const existing = map.get(item.id)!;
        if (resolveConflict) {
          map.set(item.id, resolveConflict(item, existing));
        } else {
          map.set(item.id, { ...existing, ...item });
        }
      } else {
        // Local addition that Cloud did not have yet: KEEP IT!
        map.set(item.id, item);
      }
    }

    return Array.from(map.values());
  }

  function mergeProjectsList(
    localProjects: Project[] = [],
    remoteProjects: Project[] = [],
    deletedProjectIds: Set<string>,
    deletedSubIds: Set<string>
  ): { merged: Project[]; hasLocalAdditions: boolean } {
    let hasLocalAdditions = false;
    const projectMap = new Map<string, Project>();

    // 1. Ingest remote projects
    for (const rp of remoteProjects || []) {
      if (rp && rp.id && !deletedProjectIds.has(rp.id) && rp.id !== 'prj_4') {
        projectMap.set(rp.id, rp);
      }
    }

    // 2. Merge local projects with remote projects
    for (const lp of localProjects || []) {
      if (!lp || !lp.id || deletedProjectIds.has(lp.id) || lp.id === 'prj_4') continue;

      if (!projectMap.has(lp.id)) {
        // Local-only project: KEEP IT!
        projectMap.set(lp.id, lp);
        hasLocalAdditions = true;
      } else {
        // Project exists on both sides: DEEP-MERGE ALL SUB-ARRAYS!
        const rp = projectMap.get(lp.id)!;

        const mergedUsedMaterials = mergeSubArray(lp.usedMaterials || [], rp.usedMaterials || [], deletedSubIds);
        if (mergedUsedMaterials.length > (rp.usedMaterials || []).length) {
          hasLocalAdditions = true;
        }

        const mergedToBuyItems = mergeSubArray(
          lp.toBuyItems || [],
          rp.toBuyItems || [],
          deletedSubIds,
          (localItem, remoteItem) => ({
            ...remoteItem,
            ...localItem,
            isPurchased: Boolean(localItem.isPurchased || remoteItem.isPurchased),
          })
        );
        if (mergedToBuyItems.length > (rp.toBuyItems || []).length) {
          hasLocalAdditions = true;
        }

        const mergedPayments = mergeSubArray(lp.payments || [], rp.payments || [], deletedSubIds);
        if (mergedPayments.length > (rp.payments || []).length) {
          hasLocalAdditions = true;
        }

        const mergedWages = mergeSubArray(lp.wages || [], rp.wages || [], deletedSubIds);
        if (mergedWages.length > (rp.wages || []).length) {
          hasLocalAdditions = true;
        }

        const mergedOtherExpenses = mergeSubArray(lp.otherExpenses || [], rp.otherExpenses || [], deletedSubIds);
        if (mergedOtherExpenses.length > (rp.otherExpenses || []).length) {
          hasLocalAdditions = true;
        }

        const mergedProject: Project = {
          ...rp,
          ...lp,
          contractValue: lp.contractValue || rp.contractValue || 0,
          name: lp.name || rp.name,
          clientName: lp.clientName || rp.clientName,
          clientPhone: lp.clientPhone || rp.clientPhone,
          location: lp.location || rp.location,
          status: (lp.status === 'SELESAI' || rp.status === 'SELESAI') ? 'SELESAI' : (lp.status || rp.status),
          progress: Math.max(lp.progress || 0, rp.progress || 0),
          notes: lp.notes ? (rp.notes && rp.notes !== lp.notes ? `${lp.notes}\n${rp.notes}` : lp.notes) : (rp.notes || ''),
          usedMaterials: mergedUsedMaterials,
          toBuyItems: mergedToBuyItems,
          payments: mergedPayments,
          wages: mergedWages,
          otherExpenses: mergedOtherExpenses,
        };

        projectMap.set(lp.id, mergedProject);
      }
    }

    return {
      merged: Array.from(projectMap.values()),
      hasLocalAdditions,
    };
  }

  function mergeInventoryList(
    localInventory: InventoryItem[] = [],
    remoteInventory: InventoryItem[] = [],
    deletedInventoryIds: Set<string>
  ): { merged: InventoryItem[]; hasLocalAdditions: boolean } {
    let hasLocalAdditions = false;
    const map = new Map<string, InventoryItem>();

    for (const ri of remoteInventory || []) {
      if (ri && ri.id && !deletedInventoryIds.has(ri.id)) {
        map.set(ri.id, ri);
      }
    }

    for (const li of localInventory || []) {
      if (!li || !li.id || deletedInventoryIds.has(li.id)) continue;

      if (!map.has(li.id)) {
        map.set(li.id, li);
        hasLocalAdditions = true;
      } else {
        const ri = map.get(li.id)!;
        const liTime = li.updatedAt ? new Date(li.updatedAt).getTime() : 0;
        const riTime = ri.updatedAt ? new Date(ri.updatedAt).getTime() : 0;
        if (liTime > riTime) {
          map.set(li.id, { ...ri, ...li });
          hasLocalAdditions = true;
        } else {
          map.set(li.id, { ...li, ...ri });
        }
      }
    }

    return {
      merged: Array.from(map.values()),
      hasLocalAdditions,
    };
  }

  function mergeMutationsList(
    localMutations: StockMutation[] = [],
    remoteMutations: StockMutation[] = []
  ): { merged: StockMutation[]; hasLocalAdditions: boolean } {
    let hasLocalAdditions = false;
    const map = new Map<string, StockMutation>();

    for (const rm of remoteMutations || []) {
      if (rm && rm.id) map.set(rm.id, rm);
    }

    for (const lm of localMutations || []) {
      if (!lm || !lm.id) continue;
      if (!map.has(lm.id)) {
        map.set(lm.id, lm);
        hasLocalAdditions = true;
      }
    }

    const merged = Array.from(map.values()).sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    return { merged, hasLocalAdditions };
  }

  function mergeWorkersList(
    localWorkers: KasbonWorker[] = [],
    remoteWorkers: KasbonWorker[] = []
  ): { merged: KasbonWorker[]; hasLocalAdditions: boolean } {
    let hasLocalAdditions = false;
    const map = new Map<string, KasbonWorker>();

    for (const rw of remoteWorkers || []) {
      if (rw && rw.id) map.set(rw.id, rw);
    }

    for (const lw of localWorkers || []) {
      if (!lw || !lw.id) continue;
      if (!map.has(lw.id)) {
        map.set(lw.id, lw);
        hasLocalAdditions = true;
      } else {
        const rw = map.get(lw.id)!;
        const historyMap = new Map<string, any>();
        for (const t of rw.transactions || []) {
          if (t && t.id) historyMap.set(t.id, t);
        }
        for (const t of lw.transactions || []) {
          if (t && t.id) {
            if (!historyMap.has(t.id)) hasLocalAdditions = true;
            historyMap.set(t.id, t);
          }
        }
        const mergedTransactions = Array.from(historyMap.values()).sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return db - da;
        });

        const totalBorrowed = mergedTransactions
          .filter((t: any) => t.type === 'PINJAM')
          .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        const totalPaid = mergedTransactions
          .filter((t: any) => t.type === 'BAYAR')
          .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        const balance = Math.max(0, totalBorrowed - totalPaid);

        map.set(lw.id, {
          ...rw,
          ...lw,
          transactions: mergedTransactions,
          totalBorrowed,
          totalPaid,
          balance,
        });
      }
    }

    return { merged: Array.from(map.values()), hasLocalAdditions };
  }

  function mergeDailyCashList(
    localDaily: DailyCashRecord[] = [],
    remoteDaily: DailyCashRecord[] = [],
    deletedDailyCashIds: Set<string>
  ): { merged: DailyCashRecord[]; hasLocalAdditions: boolean } {
    let hasLocalAdditions = false;
    const map = new Map<string, DailyCashRecord>();

    for (const rd of remoteDaily || []) {
      if (rd && rd.id && !deletedDailyCashIds.has(rd.id)) {
        map.set(rd.id, rd);
      }
    }

    for (const ld of localDaily || []) {
      if (!ld || !ld.id || deletedDailyCashIds.has(ld.id)) continue;
      if (!map.has(ld.id)) {
        map.set(ld.id, ld);
        hasLocalAdditions = true;
      } else {
        const rd = map.get(ld.id)!;
        map.set(ld.id, { ...rd, ...ld });
      }
    }

    const merged = Array.from(map.values()).sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    return { merged, hasLocalAdditions };
  }

  function mergeRecordsById<T extends { id: string }>(
    localList: T[] = [],
    remoteList: T[] = []
  ): { merged: T[]; hasLocalAdditions: boolean } {
    let hasLocalAdditions = false;
    const map = new Map<string, T>();
    for (const r of remoteList || []) {
      if (r && r.id) map.set(r.id, r);
    }
    for (const l of localList || []) {
      if (l && l.id) {
        if (!map.has(l.id)) hasLocalAdditions = true;
        map.set(l.id, { ...(map.get(l.id) || {}), ...l });
      }
    }
    return { merged: Array.from(map.values()), hasLocalAdditions };
  }

  // Centralized robust function to ingest cloud state into local app state and cache with SMART MERGE
  const applyCloudState = (remoteData: WorkshopCloudData) => {
    hasLoadedRemoteRef.current = true;

    // 1. Ingest tombstones
    if (Array.isArray(remoteData.deletedProjectIds)) {
      remoteData.deletedProjectIds.forEach((id) => deletedProjectIdsRef.current.add(id));
      try {
        localStorage.setItem('fatend_deleted_projects', JSON.stringify(Array.from(deletedProjectIdsRef.current)));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }
    if (Array.isArray(remoteData.deletedInventoryIds)) {
      remoteData.deletedInventoryIds.forEach((id) => deletedInventoryIdsRef.current.add(id));
      try {
        localStorage.setItem('fatend_deleted_inventory', JSON.stringify(Array.from(deletedInventoryIdsRef.current)));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }
    if (Array.isArray(remoteData.deletedDailyCashIds)) {
      remoteData.deletedDailyCashIds.forEach((id) => deletedDailyCashIdsRef.current.add(id));
      try {
        localStorage.setItem('fatend_deleted_daily_cash', JSON.stringify(Array.from(deletedDailyCashIdsRef.current)));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }
    if (Array.isArray(remoteData.deletedSubItemIds)) {
      remoteData.deletedSubItemIds.forEach((id) => deletedSubItemIdsRef.current.add(id));
      try {
        localStorage.setItem('fatend_deleted_subitems', JSON.stringify(Array.from(deletedSubItemIdsRef.current)));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }

    let needsCloudPush = false;
    let latestMergedProjects: Project[] = [];
    let latestMergedInventory: InventoryItem[] = [];
    let latestMergedDailyCash: DailyCashRecord[] = [];
    let latestMergedMutations: StockMutation[] = [];
    let latestMergedWorkers: KasbonWorker[] = [];

    // 2. Projects (Smart Deep Merge: preserve all sub-items, usedMaterials, toBuyItems, payments, wages, expenses)
    if (Array.isArray(remoteData.projects)) {
      setProjects((currentLocal) => {
        const { merged, hasLocalAdditions } = mergeProjectsList(
          currentLocal || [],
          remoteData.projects,
          deletedProjectIdsRef.current,
          deletedSubItemIdsRef.current
        );
        if (hasLocalAdditions) needsCloudPush = true;
        latestMergedProjects = merged;

        try {
          localStorage.setItem('fatend_projects', JSON.stringify(merged));
        } catch (e) {
          console.warn('LocalStorage save error:', e);
        }

        return merged;
      });
    }

    // 3. Inventory (Smart Merge: keep any local items added, never wipe)
    if (Array.isArray(remoteData.inventory)) {
      setInventory((currentLocal) => {
        const { merged, hasLocalAdditions } = mergeInventoryList(
          currentLocal || [],
          remoteData.inventory,
          deletedInventoryIdsRef.current
        );
        if (hasLocalAdditions) needsCloudPush = true;
        latestMergedInventory = merged;

        try {
          localStorage.setItem('fatend_inventory', JSON.stringify(merged));
        } catch (e) {
          console.warn('LocalStorage save error:', e);
        }

        return merged;
      });
    }

    // 4. Mutations
    if (Array.isArray(remoteData.mutations)) {
      setMutations((currentLocal) => {
        const { merged, hasLocalAdditions } = mergeMutationsList(currentLocal || [], remoteData.mutations);
        if (hasLocalAdditions) needsCloudPush = true;
        latestMergedMutations = merged;

        try {
          localStorage.setItem('fatend_mutations', JSON.stringify(merged));
        } catch (e) {
          console.warn('LocalStorage save error:', e);
        }

        return merged;
      });
    }

    // 5. Receipts
    if (Array.isArray(remoteData.receipts)) {
      setReceipts((currentLocal) => {
        const { merged } = mergeRecordsById(currentLocal || [], remoteData.receipts);
        try {
          localStorage.setItem('fatend_receipts', JSON.stringify(merged));
        } catch (e) {
          console.warn('LocalStorage save error:', e);
        }
        return merged;
      });
    }

    // 6. Workers & Kasbon History
    if (Array.isArray(remoteData.workers)) {
      setWorkers((currentLocal) => {
        const { merged, hasLocalAdditions } = mergeWorkersList(currentLocal || [], remoteData.workers);
        if (hasLocalAdditions) needsCloudPush = true;
        latestMergedWorkers = merged;

        try {
          localStorage.setItem('fatend_workers', JSON.stringify(merged));
        } catch (e) {
          console.warn('LocalStorage save error:', e);
        }

        return merged;
      });
    }

    // 7. Cashflow
    if (Array.isArray(remoteData.cashflow)) {
      setCashflow((currentLocal) => {
        const { merged } = mergeRecordsById(currentLocal || [], remoteData.cashflow);
        try {
          localStorage.setItem('fatend_cashflow', JSON.stringify(merged));
        } catch (e) {
          console.warn('LocalStorage save error:', e);
        }
        return merged;
      });
    }

    // 8. Daily Cash (Smart Merge: keep any local transactions, never wipe)
    if (remoteData.dailyCash !== undefined) {
      setDailyCashRecords((currentLocal) => {
        const remoteList = Array.isArray(remoteData.dailyCash) ? remoteData.dailyCash : [];
        const { merged, hasLocalAdditions } = mergeDailyCashList(
          currentLocal || [],
          remoteList,
          deletedDailyCashIdsRef.current
        );
        if (hasLocalAdditions) needsCloudPush = true;
        latestMergedDailyCash = merged;

        try {
          localStorage.setItem('fatend_daily_cash', JSON.stringify(merged));
        } catch (e) {
          console.warn('LocalStorage save error:', e);
        }

        return merged;
      });
    }

    // 9. PIN config
    if (remoteData.pinConfig) {
      setPinConfig(remoteData.pinConfig);
      try {
        localStorage.setItem('fatend_pins', JSON.stringify(remoteData.pinConfig));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }

    const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastSyncedAt(nowStr);
    setCloudStatus('connected');

    // CRITICAL: If local state had items that were not yet in Cloud, immediately push merged data to Cloud
    if (needsCloudPush) {
      setTimeout(() => {
        pushToCloud({
          projects: latestMergedProjects.length > 0 ? latestMergedProjects : undefined,
          inventory: latestMergedInventory.length > 0 ? latestMergedInventory : undefined,
          mutations: latestMergedMutations.length > 0 ? latestMergedMutations : undefined,
          workers: latestMergedWorkers.length > 0 ? latestMergedWorkers : undefined,
          dailyCash: latestMergedDailyCash.length > 0 ? latestMergedDailyCash : undefined,
          deletedProjectIds: Array.from(deletedProjectIdsRef.current),
          deletedInventoryIds: Array.from(deletedInventoryIdsRef.current),
          deletedDailyCashIds: Array.from(deletedDailyCashIdsRef.current),
          deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
        }).catch(console.error);
      }, 350);
    }
  };

  // 1. Listen in real-time to changes from other PCs / HPs and immediately pull on mount
  useEffect(() => {
    const unsubscribe = subscribeToCloudChanges(
      (remoteData) => {
        applyCloudState(remoteData);
      },
      (status) => {
        setCloudStatus(status);
      }
    );

    // Initial check: pull latest complete workshop document directly
    pullFromCloud().then((existing) => {
      if (existing) {
        applyCloudState(existing);
      } else {
        hasLoadedRemoteRef.current = true;
        pushToCloud({
          projects,
          inventory,
          mutations,
          receipts,
          workers,
          cashflow,
          pinConfig,
          dailyCash: dailyCashRecords,
          deletedProjectIds: Array.from(deletedProjectIdsRef.current),
          deletedInventoryIds: Array.from(deletedInventoryIdsRef.current),
          deletedDailyCashIds: Array.from(deletedDailyCashIdsRef.current),
          deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
        }).then(() => {
          const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastSyncedAt(nowStr);
          setCloudStatus('connected');
        });
      }
    }).catch((err) => {
      console.warn('Initial cloud seed check notice:', err);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 2. Debounced push to Cloud whenever local data is modified
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    // CRITICAL: NEVER push to cloud until remote data has been loaded from cloud!
    if (!hasLoadedRemoteRef.current) {
      return;
    }
    // Prevent feedback loop if this state change was incoming from Firestore snapshot
    if (getIsRemoteSyncInProgress()) {
      return;
    }

    const timer = setTimeout(() => {
      setCloudStatus('syncing');
      pushToCloud({
        projects,
        inventory,
        mutations,
        receipts,
        workers,
        cashflow,
        pinConfig,
        dailyCash: dailyCashRecords,
        deletedProjectIds: Array.from(deletedProjectIdsRef.current),
        deletedInventoryIds: Array.from(deletedInventoryIdsRef.current),
        deletedDailyCashIds: Array.from(deletedDailyCashIdsRef.current),
        deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
      }).then((success) => {
        if (success) {
          setCloudStatus('connected');
          const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastSyncedAt(nowStr);
        } else {
          setCloudStatus('error');
        }
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [projects, inventory, mutations, receipts, workers, cashflow, pinConfig, dailyCashRecords]);

  const forceUploadToCloud = async () => {
    setCloudStatus('syncing');
    const ok = await pushToCloud({
      projects,
      inventory,
      mutations,
      receipts,
      workers,
      cashflow,
      pinConfig,
      dailyCash: dailyCashRecords,
      deletedProjectIds: Array.from(deletedProjectIdsRef.current),
      deletedInventoryIds: Array.from(deletedInventoryIdsRef.current),
      deletedDailyCashIds: Array.from(deletedDailyCashIdsRef.current),
      deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
    });
    if (ok) {
      setCloudStatus('connected');
      setLastSyncedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } else {
      setCloudStatus('error');
    }
    return ok;
  };

  // TRUE BIDIRECTIONAL SYNC: Pull latest cloud data, smart-merge with local, and push combined result back!
  const forceDownloadFromCloud = async (): Promise<boolean> => {
    setCloudStatus('syncing');
    try {
      const data = await pullFromCloud();
      if (!data) {
        // Still push current state to cloud so local changes aren't orphaned
        await pushToCloud({
          projects,
          inventory,
          mutations,
          receipts,
          workers,
          cashflow,
          pinConfig,
          dailyCash: dailyCashRecords,
          deletedProjectIds: Array.from(deletedProjectIdsRef.current),
          deletedInventoryIds: Array.from(deletedInventoryIdsRef.current),
          deletedDailyCashIds: Array.from(deletedDailyCashIdsRef.current),
          deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
        });
        setCloudStatus('error');
        return false;
      }

      applyCloudState(data);

      // Read back newly merged state from localStorage
      const savedProjects = localStorage.getItem('fatend_projects');
      const savedInventory = localStorage.getItem('fatend_inventory');
      const savedDailyCash = localStorage.getItem('fatend_daily_cash');
      const savedMutations = localStorage.getItem('fatend_mutations');
      const savedWorkers = localStorage.getItem('fatend_workers');

      const pushOk = await pushToCloud({
        projects: savedProjects ? JSON.parse(savedProjects) : projects,
        inventory: savedInventory ? JSON.parse(savedInventory) : inventory,
        mutations: savedMutations ? JSON.parse(savedMutations) : mutations,
        receipts,
        workers: savedWorkers ? JSON.parse(savedWorkers) : workers,
        cashflow,
        pinConfig,
        dailyCash: savedDailyCash ? JSON.parse(savedDailyCash) : dailyCashRecords,
        deletedProjectIds: Array.from(deletedProjectIdsRef.current),
        deletedInventoryIds: Array.from(deletedInventoryIdsRef.current),
        deletedDailyCashIds: Array.from(deletedDailyCashIdsRef.current),
        deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
      });

      setCloudStatus(pushOk ? 'connected' : 'connected');
      setLastSyncedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      return true;
    } catch (err) {
      console.error('Bidirectional sync error:', err);
      setCloudStatus('error');
      return false;
    }
  };

  // Auth Functions
  const loginWithPin = (pin: string) => {
    const trimmed = pin.trim();
    const isPemilik = trimmed === pinConfig.pemilikPin;
    const isAdmin = trimmed === pinConfig.adminPin;

    if (isPemilik) {
      const sess: UserSession = {
        role: 'PEMILIK',
        name: 'Pemilik (Owner)',
        loggedInAt: new Date().toISOString(),
      };
      setSession(sess);
      return { success: true, role: 'PEMILIK' as UserRole, message: 'Berhasil login sebagai Pemilik (Akses Penuh).' };
    }
    if (isAdmin) {
      const sess: UserSession = {
        role: 'ADMIN',
        name: 'Admin Bengkel',
        loggedInAt: new Date().toISOString(),
      };
      setSession(sess);
      return { success: true, role: 'ADMIN' as UserRole, message: 'Berhasil login sebagai Admin (Operasional & Stok).' };
    }
    return { success: false, message: 'PIN yang Anda masukkan salah. Silakan coba lagi.' };
  };

  const logout = () => {
    setSession(null);
  };

  const updatePin = (role: UserRole, oldPin: string, newPin: string) => {
    if (newPin.length < 4) return false;
    if (role === 'PEMILIK') {
      if (oldPin !== pinConfig.pemilikPin) return false;
      setPinConfig((prev) => ({ ...prev, pemilikPin: newPin }));
      return true;
    } else {
      if (oldPin !== pinConfig.adminPin && oldPin !== pinConfig.pemilikPin) return false;
      setPinConfig((prev) => ({ ...prev, adminPin: newPin }));
      return true;
    }
  };

  // Projects
  const addProject = (data: Omit<Project, 'id' | 'createdAt' | 'toBuyItems' | 'usedMaterials' | 'payments' | 'wages' | 'otherExpenses'>) => {
    const newPrj: Project = {
      ...data,
      id: generateId('prj'),
      createdAt: new Date().toISOString(),
      toBuyItems: [],
      usedMaterials: [],
      payments: [],
      wages: [],
      otherExpenses: [],
    };
    deletedProjectIdsRef.current.delete(newPrj.id);
    setProjects((prev) => {
      const updated = [newPrj, ...prev];
      try {
        localStorage.setItem('fatend_projects', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      pushToCloud({ projects: updated }).catch((e) =>
        console.error('Cloud push failed on addProject:', e)
      );
      return updated;
    });
    return newPrj;
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      try {
        localStorage.setItem('fatend_projects', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      pushToCloud({ projects: updated }).catch((e) =>
        console.error('Cloud push failed on updateProject:', e)
      );
      return updated;
    });
  };

  const deleteProject = (id: string) => {
    deletedProjectIdsRef.current.add(id);
    const updatedDeleted: string[] = Array.from(deletedProjectIdsRef.current);
    setProjects((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('fatend_projects', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      pushToCloud({
        projects: updated,
        deletedProjectIds: updatedDeleted,
      }).catch((e) =>
        console.error('Cloud push failed on deleteProject:', e)
      );
      return updated;
    });
  };

  const updateProjectProgress = (id: string, progress: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    let newStatus: Project['status'] = 'BERJALAN';
    if (clamped === 100) newStatus = 'SELESAI';
    else if (clamped >= 80) newStatus = 'FINISHING';
    else if (clamped === 0) newStatus = 'DRAFT';

    const updated = projects.map((p) =>
      p.id === id ? { ...p, progress: clamped, status: newStatus } : p
    );
    setProjects(updated);
    pushToCloud({ projects: updated }).catch((e) =>
      console.error('Cloud push failed on updateProjectProgress:', e)
    );
  };

  const addToBuyItem = (projectId: string, item: Omit<ToBuyItem, 'id' | 'isPurchased'>) => {
    const newItem: ToBuyItem = {
      ...item,
      id: generateId('tbi'),
      isPurchased: false,
    };
    deletedSubItemIdsRef.current.delete(newItem.id);
    const updated = projects.map((p) =>
      p.id === projectId ? { ...p, toBuyItems: [...(p.toBuyItems || []), newItem] } : p
    );
    setProjects(updated);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
    pushToCloud({
      projects: updated,
      deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
    }).catch((e) => console.error('Cloud push failed on addToBuyItem:', e));
  };

  const toggleToBuyItem = (projectId: string, itemId: string) => {
    const updated = projects.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        toBuyItems: (p.toBuyItems || []).map((item) =>
          item.id === itemId ? { ...item, isPurchased: !item.isPurchased } : item
        ),
      };
    });
    setProjects(updated);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
    pushToCloud({ projects: updated }).catch((e) =>
      console.error('Cloud push failed on toggleToBuyItem:', e)
    );
  };

  const deleteToBuyItem = (projectId: string, itemId: string) => {
    deletedSubItemIdsRef.current.add(itemId);
    try {
      localStorage.setItem('fatend_deleted_subitems', JSON.stringify(Array.from(deletedSubItemIdsRef.current)));
    } catch (e) {
      console.warn(e);
    }
    const updated = projects.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        toBuyItems: (p.toBuyItems || []).filter((item) => item.id !== itemId),
      };
    });
    setProjects(updated);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
    pushToCloud({
      projects: updated,
      deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
    }).catch((e) => console.error('Cloud push failed on deleteToBuyItem:', e));
  };

  // Material used in project - automates inventory deduction, mutation card & cloud sync!
  const useMaterialInProject = (
    projectId: string,
    material: {
      inventoryItemId?: string;
      name: string;
      qty: number;
      unit: string;
      costPerUnit: number;
      fromStock: boolean;
      date?: string;
    }
  ) => {
    const totalCost = material.qty * material.costPerUnit;
    const dateStr = material.date || new Date().toISOString().split('T')[0];
    const project = projects.find((p) => p.id === projectId);
    const projectName = project ? project.name : 'Proyek Bengkel';

    const newUsedMat: UsedMaterial = {
      id: generateId('um'),
      inventoryItemId: material.inventoryItemId,
      name: material.name,
      qty: material.qty,
      unit: material.unit,
      costPerUnit: material.costPerUnit,
      totalCost,
      date: dateStr,
      fromStock: material.fromStock,
    };
    deletedSubItemIdsRef.current.delete(newUsedMat.id);

    let updatedInventory = inventory;
    let updatedMutations = mutations;

    // If material is from inventory stock, reduce stock and record mutation
    if (material.fromStock && material.inventoryItemId) {
      const invItem = inventory.find((i) => i.id === material.inventoryItemId);
      if (invItem) {
        const prevStock = invItem.currentStock;
        const newStock = Math.max(0, prevStock - material.qty);

        // Update inventory
        updatedInventory = inventory.map((i) =>
          i.id === material.inventoryItemId
            ? { ...i, currentStock: newStock, updatedAt: new Date().toISOString() }
            : i
        );
        setInventory(updatedInventory);

        // Record stock mutation
        const newMutation: StockMutation = {
          id: generateId('mut'),
          inventoryItemId: invItem.id,
          itemName: invItem.name,
          type: 'KELUAR_PROYEK',
          qty: material.qty,
          previousStock: prevStock,
          currentStock: newStock,
          date: dateStr,
          referenceId: projectId,
          referenceLabel: projectName,
          notes: `Dipakai pada proyek ${projectName} (${material.qty} ${material.unit})`,
        };
        updatedMutations = [newMutation, ...mutations];
        setMutations(updatedMutations);
      }
    }

    // Add to project usedMaterials
    const updatedProjects = projects.map((p) =>
      p.id === projectId
        ? { ...p, usedMaterials: [...(p.usedMaterials || []), newUsedMat] }
        : p
    );
    setProjects(updatedProjects);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updatedProjects));
      if (material.fromStock && material.inventoryItemId) {
        localStorage.setItem('fatend_inventory', JSON.stringify(updatedInventory));
        localStorage.setItem('fatend_mutations', JSON.stringify(updatedMutations));
      }
    } catch (e) {
      console.warn(e);
    }

    // CRITICAL: Push immediately to Cloud Firestore so data NEVER gets lost!
    pushToCloud({
      projects: updatedProjects,
      deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
      ...(material.fromStock && material.inventoryItemId
        ? { inventory: updatedInventory, mutations: updatedMutations }
        : {}),
    }).catch((e) => console.error('Cloud push failed on useMaterialInProject:', e));
  };

  const deleteUsedMaterial = (projectId: string, materialId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const matToDelete = (project?.usedMaterials || []).find((m) => m.id === materialId);
    deletedSubItemIdsRef.current.add(materialId);
    try {
      localStorage.setItem('fatend_deleted_subitems', JSON.stringify(Array.from(deletedSubItemIdsRef.current)));
    } catch (e) {
      console.warn(e);
    }

    let updatedInventory = inventory;
    let updatedMutations = mutations;

    // If material was taken from inventory stock, restore stock and record mutation
    if (matToDelete && matToDelete.fromStock && matToDelete.inventoryItemId) {
      const invItem = inventory.find((i) => i.id === matToDelete.inventoryItemId);
      if (invItem) {
        const prevStock = invItem.currentStock;
        const newStock = prevStock + matToDelete.qty;
        updatedInventory = inventory.map((i) =>
          i.id === matToDelete.inventoryItemId
            ? { ...i, currentStock: newStock, updatedAt: new Date().toISOString() }
            : i
        );
        setInventory(updatedInventory);

        const newMutation: StockMutation = {
          id: generateId('mut'),
          inventoryItemId: invItem.id,
          itemName: invItem.name,
          type: 'PENYESUAIAN',
          qty: matToDelete.qty,
          previousStock: prevStock,
          currentStock: newStock,
          date: new Date().toISOString().split('T')[0],
          referenceId: projectId,
          referenceLabel: project?.name || 'Proyek',
          notes: `Batal pemakaian / hapus bahan dari proyek ${project?.name || ''} (+${matToDelete.qty} ${matToDelete.unit})`,
        };
        updatedMutations = [newMutation, ...mutations];
        setMutations(updatedMutations);
      }
    }

    const updatedProjects = projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            usedMaterials: (p.usedMaterials || []).filter((m) => m.id !== materialId),
          }
        : p
    );
    setProjects(updatedProjects);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updatedProjects));
      if (matToDelete?.fromStock && matToDelete?.inventoryItemId) {
        localStorage.setItem('fatend_inventory', JSON.stringify(updatedInventory));
        localStorage.setItem('fatend_mutations', JSON.stringify(updatedMutations));
      }
    } catch (e) {
      console.warn(e);
    }

    pushToCloud({
      projects: updatedProjects,
      deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
      ...(matToDelete?.fromStock && matToDelete?.inventoryItemId
        ? { inventory: updatedInventory, mutations: updatedMutations }
        : {}),
    }).catch((e) => console.error('Cloud push failed on deleteUsedMaterial:', e));
  };

  const updateUsedMaterial = (
    projectId: string,
    materialId: string,
    updates: {
      costPerUnit?: number;
      qty?: number;
      name?: string;
      unit?: string;
    }
  ) => {
    let updatedInventory = inventory;
    let updatedMutations = mutations;

    const updatedProjects = projects.map((p) => {
      if (p.id !== projectId) return p;
      const updatedMaterials = (p.usedMaterials || []).map((m) => {
        if (m.id !== materialId) return m;

        const newCostPerUnit = updates.costPerUnit !== undefined ? updates.costPerUnit : m.costPerUnit;
        const newQty = updates.qty !== undefined ? updates.qty : m.qty;
        const newName = updates.name !== undefined ? updates.name : m.name;
        const newUnit = updates.unit !== undefined ? updates.unit : m.unit;
        const newTotalCost = newQty * newCostPerUnit;

        // If qty changed and item is from inventory stock, adjust stock delta
        if (m.fromStock && m.inventoryItemId && updates.qty !== undefined && updates.qty !== m.qty) {
          const delta = updates.qty - m.qty;
          const invItem = inventory.find((i) => i.id === m.inventoryItemId);
          if (invItem) {
            const prevStock = invItem.currentStock;
            const newStock = Math.max(0, prevStock - delta);
            updatedInventory = updatedInventory.map((i) =>
              i.id === m.inventoryItemId
                ? { ...i, currentStock: newStock, updatedAt: new Date().toISOString() }
                : i
            );
            setInventory(updatedInventory);

            const newMutation: StockMutation = {
              id: generateId('mut'),
              inventoryItemId: invItem.id,
              itemName: invItem.name,
              type: delta > 0 ? 'KELUAR_PROYEK' : 'PENYESUAIAN',
              qty: Math.abs(delta),
              previousStock: prevStock,
              currentStock: newStock,
              date: new Date().toISOString().split('T')[0],
              referenceId: projectId,
              referenceLabel: p.name,
              notes: `Koreksi kuantiti bahan proyek ${p.name} (${delta > 0 ? '-' : '+'}${Math.abs(delta)} ${newUnit})`,
            };
            updatedMutations = [newMutation, ...updatedMutations];
            setMutations(updatedMutations);
          }
        }

        return {
          ...m,
          name: newName,
          unit: newUnit,
          qty: newQty,
          costPerUnit: newCostPerUnit,
          totalCost: newTotalCost,
        };
      });

      return {
        ...p,
        usedMaterials: updatedMaterials,
      };
    });

    setProjects(updatedProjects);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updatedProjects));
    } catch (e) {
      console.warn(e);
    }

    pushToCloud({
      projects: updatedProjects,
      ...(updatedInventory !== inventory ? { inventory: updatedInventory, mutations: updatedMutations } : {}),
    }).catch((e) => console.error('Cloud push failed on updateUsedMaterial:', e));
  };

  const addProjectPayment = (projectId: string, payment: Omit<ProjectPayment, 'id'>) => {
    const newPayment: ProjectPayment = {
      ...payment,
      id: generateId('pay'),
    };
    deletedSubItemIdsRef.current.delete(newPayment.id);
    const prj = projects.find((p) => p.id === projectId);
    const prjName = prj ? prj.name : 'Proyek';

    const updatedProjects = projects.map((p) =>
      p.id === projectId ? { ...p, payments: [...(p.payments || []), newPayment] } : p
    );
    setProjects(updatedProjects);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updatedProjects));
    } catch (e) {
      console.warn(e);
    }

    // Also record into Global Cashflow
    const newCashflow: CashflowRecord = {
      id: generateId('cf'),
      date: payment.date,
      type: 'MASUK',
      category: 'PEMBAYARAN_PROYEK',
      amount: payment.amount,
      referenceProjectId: projectId,
      referenceProjectName: prjName,
      notes: `${payment.type} ${prjName}${payment.notes ? ' - ' + payment.notes : ''}`,
      createdAt: new Date().toISOString(),
    };
    const updatedCashflow = [newCashflow, ...cashflow];
    setCashflow(updatedCashflow);
    try {
      localStorage.setItem('fatend_cashflow', JSON.stringify(updatedCashflow));
    } catch (e) {
      console.warn(e);
    }

    pushToCloud({
      projects: updatedProjects,
      cashflow: updatedCashflow,
      deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
    }).catch((e) => console.error('Cloud push failed on addProjectPayment:', e));
  };

  const deleteProjectPayment = (projectId: string, paymentId: string) => {
    deletedSubItemIdsRef.current.add(paymentId);
    try {
      localStorage.setItem('fatend_deleted_subitems', JSON.stringify(Array.from(deletedSubItemIdsRef.current)));
    } catch (e) {
      console.warn(e);
    }
    const updatedProjects = projects.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        payments: (p.payments || []).filter((pay) => pay.id !== paymentId),
      };
    });
    setProjects(updatedProjects);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updatedProjects));
    } catch (e) {
      console.warn(e);
    }
    pushToCloud({
      projects: updatedProjects,
      deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
    }).catch((e) => console.error('Cloud push failed on deleteProjectPayment:', e));
  };

  // Labor wage - Helper 20% calculation rule
  const addLaborWage = (
    projectId: string,
    wage: { tukangName: string; helperName?: string; baseWage: number; notes?: string }
  ) => {
    const helperRate = 0.2;
    const helperWage = Math.round(wage.baseWage * helperRate);
    const totalWage = Math.round(wage.baseWage * 1.2);

    const newWage: LaborWage = {
      id: generateId('wage'),
      tukangName: wage.tukangName,
      helperName: wage.helperName || 'Helper Bengkel (20%)',
      baseWage: wage.baseWage,
      helperRate,
      helperWage,
      totalWage,
      status: 'BELUM_BAYAR',
      paidAmount: 0,
      notes: wage.notes,
    };
    deletedSubItemIdsRef.current.delete(newWage.id);

    const updatedProjects = projects.map((p) =>
      p.id === projectId ? { ...p, wages: [...(p.wages || []), newWage] } : p
    );
    setProjects(updatedProjects);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updatedProjects));
    } catch (e) {
      console.warn(e);
    }
    pushToCloud({
      projects: updatedProjects,
      deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
    }).catch((e) => console.error('Cloud push failed on addLaborWage:', e));
  };

  const payLaborWage = (projectId: string, wageId: string, amount: number, notes?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const prj = projects.find((p) => p.id === projectId);
    const prjName = prj ? prj.name : 'Proyek';

    let wageTukangName = 'Tukang';

    const updatedProjects = projects.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        wages: (p.wages || []).map((w) => {
          if (w.id !== wageId) return w;
          wageTukangName = w.tukangName;
          const newPaid = (w.paidAmount || 0) + amount;
          let status: LaborWage['status'] = 'DICICIL';
          if (newPaid >= w.totalWage) status = 'LUNAS';
          return {
            ...w,
            paidAmount: newPaid,
            status,
            paidDate: today,
            notes: notes || w.notes,
          };
        }),
      };
    });
    setProjects(updatedProjects);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updatedProjects));
    } catch (e) {
      console.warn(e);
    }

    // Record cashflow expense
    const newCashflow: CashflowRecord = {
      id: generateId('cf'),
      date: today,
      type: 'KELUAR',
      category: 'BORONGAN_TUKANG',
      amount,
      referenceProjectId: projectId,
      referenceProjectName: prjName,
      notes: `Bayar Borongan ${wageTukangName} (${prjName})${notes ? ' - ' + notes : ''}`,
      createdAt: new Date().toISOString(),
    };
    const updatedCashflow = [newCashflow, ...cashflow];
    setCashflow(updatedCashflow);
    try {
      localStorage.setItem('fatend_cashflow', JSON.stringify(updatedCashflow));
    } catch (e) {
      console.warn(e);
    }

    pushToCloud({
      projects: updatedProjects,
      cashflow: updatedCashflow,
      deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
    }).catch((e) => console.error('Cloud push failed on payLaborWage:', e));
  };

  const deleteLaborWage = (projectId: string, wageId: string) => {
    deletedSubItemIdsRef.current.add(wageId);
    try {
      localStorage.setItem('fatend_deleted_subitems', JSON.stringify(Array.from(deletedSubItemIdsRef.current)));
    } catch (e) {
      console.warn(e);
    }
    const updatedProjects = projects.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        wages: (p.wages || []).filter((w) => w.id !== wageId),
      };
    });
    setProjects(updatedProjects);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updatedProjects));
    } catch (e) {
      console.warn(e);
    }
    pushToCloud({
      projects: updatedProjects,
      deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
    }).catch((e) => console.error('Cloud push failed on deleteLaborWage:', e));
  };

  const addProjectExpense = (projectId: string, expense: Omit<ProjectExpense, 'id'>) => {
    const newExp: ProjectExpense = {
      ...expense,
      id: generateId('exp'),
    };
    deletedSubItemIdsRef.current.delete(newExp.id);
    const prj = projects.find((p) => p.id === projectId);
    const prjName = prj ? prj.name : 'Proyek';

    const updatedProjects = projects.map((p) =>
      p.id === projectId ? { ...p, otherExpenses: [...(p.otherExpenses || []), newExp] } : p
    );
    setProjects(updatedProjects);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updatedProjects));
    } catch (e) {
      console.warn(e);
    }

    // Cashflow expense
    const newCashflow: CashflowRecord = {
      id: generateId('cf'),
      date: expense.date,
      type: 'KELUAR',
      category: 'OPERASIONAL_LAIN',
      amount: expense.amount,
      referenceProjectId: projectId,
      referenceProjectName: prjName,
      notes: `Biaya Proyek ${prjName}: ${expense.name}`,
      createdAt: new Date().toISOString(),
    };
    const updatedCashflow = [newCashflow, ...cashflow];
    setCashflow(updatedCashflow);
    try {
      localStorage.setItem('fatend_cashflow', JSON.stringify(updatedCashflow));
    } catch (e) {
      console.warn(e);
    }

    pushToCloud({
      projects: updatedProjects,
      cashflow: updatedCashflow,
      deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
    }).catch((e) => console.error('Cloud push failed on addProjectExpense:', e));
  };

  const deleteProjectExpense = (projectId: string, expenseId: string) => {
    deletedSubItemIdsRef.current.add(expenseId);
    try {
      localStorage.setItem('fatend_deleted_subitems', JSON.stringify(Array.from(deletedSubItemIdsRef.current)));
    } catch (e) {
      console.warn(e);
    }
    const updatedProjects = projects.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        otherExpenses: (p.otherExpenses || []).filter((e) => e.id !== expenseId),
      };
    });
    setProjects(updatedProjects);
    try {
      localStorage.setItem('fatend_projects', JSON.stringify(updatedProjects));
    } catch (e) {
      console.warn(e);
    }
    pushToCloud({
      projects: updatedProjects,
      deletedSubItemIds: Array.from(deletedSubItemIdsRef.current),
    }).catch((e) => console.error('Cloud push failed on deleteProjectExpense:', e));
  };

  // Inventory & Stock
  const addInventoryItem = (item: Omit<InventoryItem, 'id' | 'updatedAt'>) => {
    const newItem: InventoryItem = {
      ...item,
      id: generateId('inv'),
      updatedAt: new Date().toISOString(),
    };
    deletedInventoryIdsRef.current.delete(newItem.id);

    setInventory((prev) => {
      const updatedInv = [...prev, newItem];
      try {
        localStorage.setItem('fatend_inventory', JSON.stringify(updatedInv));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }

      let updatedMut = mutations;
      if (item.currentStock > 0) {
        const mut: StockMutation = {
          id: generateId('mut'),
          inventoryItemId: newItem.id,
          itemName: newItem.name,
          type: 'MASUK',
          qty: item.currentStock,
          previousStock: 0,
          currentStock: item.currentStock,
          date: new Date().toISOString().split('T')[0],
          referenceLabel: 'Stok Awal Sistem',
          notes: `Input item baru ke gudang (${item.category.toUpperCase()})`,
        };
        updatedMut = [mut, ...mutations];
        setMutations(updatedMut);
        try {
          localStorage.setItem('fatend_mutations', JSON.stringify(updatedMut));
        } catch (e) {
          console.warn('LocalStorage save error:', e);
        }
      }

      pushToCloud({ inventory: updatedInv, mutations: updatedMut }).catch(console.error);
      return updatedInv;
    });
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
      );
      try {
        localStorage.setItem('fatend_inventory', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      pushToCloud({ inventory: updated }).catch(console.error);
      return updated;
    });
  };

  const deleteInventoryItem = (id: string) => {
    deletedInventoryIdsRef.current.add(id);
    const updatedDeleted: string[] = Array.from(deletedInventoryIdsRef.current);
    setInventory((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      try {
        localStorage.setItem('fatend_inventory', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      pushToCloud({
        inventory: updated,
        deletedInventoryIds: updatedDeleted,
      }).catch(console.error);
      return updated;
    });
  };

  const restockItem = (itemId: string, qty: number, unitCost: number, notes?: string, recordCashflow = true) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item || qty <= 0) return;

    const prevStock = item.currentStock;
    const newStock = prevStock + qty;
    const today = new Date().toISOString().split('T')[0];

    // Update item stock
    const updatedInv = inventory.map((i) =>
      i.id === itemId
        ? {
            ...i,
            currentStock: newStock,
            avgPurchasePrice: unitCost > 0 ? unitCost : i.avgPurchasePrice,
            updatedAt: new Date().toISOString(),
          }
        : i
    );
    setInventory(updatedInv);
    try {
      localStorage.setItem('fatend_inventory', JSON.stringify(updatedInv));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // Record Mutation
    const newMutation: StockMutation = {
      id: generateId('mut'),
      inventoryItemId: item.id,
      itemName: item.name,
      type: 'MASUK',
      qty,
      previousStock: prevStock,
      currentStock: newStock,
      date: today,
      referenceLabel: 'Restock Gudang',
      notes: notes || `Restock barang masuk gudang +${qty} ${item.unit}`,
    };
    const updatedMut = [newMutation, ...mutations];
    setMutations(updatedMut);
    try {
      localStorage.setItem('fatend_mutations', JSON.stringify(updatedMut));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // Record Cashflow
    let updatedCf = cashflow;
    if (recordCashflow && unitCost > 0) {
      const totalCost = qty * unitCost;
      const newCf: CashflowRecord = {
        id: generateId('cf'),
        date: today,
        type: 'KELUAR',
        category: 'BELANJA_STOK',
        amount: totalCost,
        notes: `Restock ${item.name} (${qty} ${item.unit} @ Rp ${unitCost.toLocaleString('id-ID')})`,
        createdAt: new Date().toISOString(),
      };
      updatedCf = [newCf, ...cashflow];
      setCashflow(updatedCf);
      try {
        localStorage.setItem('fatend_cashflow', JSON.stringify(updatedCf));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }
    pushToCloud({ inventory: updatedInv, mutations: updatedMut, cashflow: updatedCf }).catch(console.error);
  };

  const adjustStock = (itemId: string, newStock: number, reason: string) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;

    const prevStock = item.currentStock;
    const diff = newStock - prevStock;
    const today = new Date().toISOString().split('T')[0];

    const updatedInv = inventory.map((i) =>
      i.id === itemId ? { ...i, currentStock: Math.max(0, newStock), updatedAt: new Date().toISOString() } : i
    );
    setInventory(updatedInv);
    try {
      localStorage.setItem('fatend_inventory', JSON.stringify(updatedInv));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    const newMutation: StockMutation = {
      id: generateId('mut'),
      inventoryItemId: item.id,
      itemName: item.name,
      type: 'PENYESUAIAN',
      qty: Math.abs(diff),
      previousStock: prevStock,
      currentStock: Math.max(0, newStock),
      date: today,
      referenceLabel: 'Penyesuaian Fisik / Opname',
      notes: reason || `Penyesuaian stok dari ${prevStock} menjadi ${newStock} (${diff >= 0 ? '+' : ''}${diff})`,
    };
    const updatedMut = [newMutation, ...mutations];
    setMutations(updatedMut);
    try {
      localStorage.setItem('fatend_mutations', JSON.stringify(updatedMut));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
    pushToCloud({ inventory: updatedInv, mutations: updatedMut }).catch(console.error);
  };

  // Receipts Process
  const processScannedReceipt = (
    receiptData: Omit<ReceiptScan, 'id' | 'createdAt'>,
    autoAllocate: 'GUDANG' | 'PROYEK',
    targetProjectId?: string
  ) => {
    const newReceiptId = generateId('rec');
    const today = receiptData.date || new Date().toISOString().split('T')[0];

    let targetPrjName = '';
    if (autoAllocate === 'PROYEK' && targetProjectId) {
      const p = projects.find((x) => x.id === targetProjectId);
      targetPrjName = p ? p.name : 'Proyek Bengkel';
    }

    const savedReceipt: ReceiptScan = {
      ...receiptData,
      id: newReceiptId,
      allocatedTo: autoAllocate,
      targetProjectId,
      targetProjectName: targetPrjName,
      createdAt: new Date().toISOString(),
    };

    setReceipts((prev) => [savedReceipt, ...prev]);

    if (autoAllocate === 'GUDANG') {
      // 1. Tambah stok gudang untuk tiap item secara batch/atomik
      const currentInvList: InventoryItem[] = [...inventory];
      const newMutationsList: StockMutation[] = [];

      receiptData.items.forEach((item, itemIdx) => {
        const itemQty = Number(item.quantity || item.qty || 1);
        const itemUnitPrice = Number(item.unitPrice || 0);

        // Cari kecocokan di inventori:
        let targetIndex = -1;
        if (item.matchedInventoryId && item.matchedInventoryId !== 'NEW') {
          targetIndex = currentInvList.findIndex((inv) => inv.id === item.matchedInventoryId);
        }

        if (targetIndex === -1 && item.matchedInventoryId !== 'NEW') {
          // Cari dengan pencocokan nama pintar
          const matchResult = matchScannedItemToInventory(item.name, currentInvList);
          if (matchResult) {
            targetIndex = currentInvList.findIndex((inv) => inv.id === matchResult.item.id);
          }
        }

        if (targetIndex !== -1) {
          // Barang sudah ada di gudang -> TAMBAH STOK
          const existing = currentInvList[targetIndex];
          const prevStock = Number(existing.currentStock) || 0;
          const newStock = prevStock + itemQty;

          currentInvList[targetIndex] = {
            ...existing,
            currentStock: newStock,
            avgPurchasePrice: itemUnitPrice > 0 ? itemUnitPrice : existing.avgPurchasePrice,
            updatedAt: new Date().toISOString(),
          };

          newMutationsList.push({
            id: generateId('mut'),
            inventoryItemId: existing.id,
            itemName: existing.name,
            type: 'MASUK',
            qty: itemQty,
            previousStock: prevStock,
            currentStock: newStock,
            date: today,
            referenceId: newReceiptId,
            referenceLabel: `Nota ${receiptData.storeName}`,
            notes: `Scan Nota masuk stok: +${itemQty} ${existing.unit || item.unit}`,
          });
        } else {
          // Barang belum ada -> TAMBAH SEBAGAI ITEM BARU
          const cat: StockCategory = item.category === 'consumable' ? 'consumable' : 'material';
          const skuIndex = currentInvList.length + itemIdx + 1;
          const skuCode = cat === 'material' ? `MAT-${skuIndex.toString().padStart(2, '0')}` : `CON-${skuIndex.toString().padStart(2, '0')}`;
          
          const newInvItem: InventoryItem = {
            id: generateId('inv'),
            sku: skuCode,
            name: item.name.trim(),
            category: cat,
            unit: item.unit || 'Pcs',
            currentStock: itemQty,
            minStock: 2,
            avgPurchasePrice: itemUnitPrice,
            location: 'Gudang Utama',
            updatedAt: new Date().toISOString(),
          };

          currentInvList.push(newInvItem);

          newMutationsList.push({
            id: generateId('mut'),
            inventoryItemId: newInvItem.id,
            itemName: newInvItem.name,
            type: 'MASUK',
            qty: itemQty,
            previousStock: 0,
            currentStock: itemQty,
            date: today,
            referenceId: newReceiptId,
            referenceLabel: `Nota ${receiptData.storeName}`,
            notes: `Item baru dari scan nota: +${itemQty} ${item.unit}`,
          });
        }
      });

      // Simpan perubahan ke State
      setInventory(currentInvList);
      setMutations((prev) => [...newMutationsList, ...prev]);

      // Catat pengeluaran kas belanja stok
      const newCf: CashflowRecord = {
        id: generateId('cf'),
        date: today,
        type: 'KELUAR',
        category: 'BELANJA_STOK',
        amount: receiptData.totalAmount,
        notes: `Belanja stok via Scan Nota (${receiptData.storeName})`,
        createdAt: new Date().toISOString(),
      };
      setCashflow((prev) => [newCf, ...prev]);

      // Langsung sinkronkan secara seketika ke Cloud Firestore
      pushToCloud({
        inventory: currentInvList,
        mutations: [...newMutationsList, ...mutations],
        receipts: [savedReceipt, ...receipts],
        cashflow: [newCf, ...cashflow],
      }).catch((e) => console.error('Cloud push failed on scan receipt (GUDANG):', e));
    } else if (autoAllocate === 'PROYEK' && targetProjectId) {
      // 2. Alokasikan langsung ke proyek sebagai bahan terpakai
      const usedMatItems: UsedMaterial[] = receiptData.items.map((it) => ({
        id: generateId('um'),
        name: it.name,
        qty: Number(it.quantity || it.qty || 1),
        unit: it.unit,
        costPerUnit: Number(it.unitPrice || 0),
        totalCost: Number(it.totalPrice || 0),
        date: today,
        fromStock: false,
      }));

      const updatedProjects = projects.map((p) => {
        if (p.id !== targetProjectId) return p;

        // Mark matching toBuyItems as purchased
        const updatedToBuy = (p.toBuyItems || []).map((tbi) => {
          const isMatch = receiptData.items.some(
            (it) =>
              it.name.toLowerCase().includes(tbi.name.toLowerCase()) ||
              tbi.name.toLowerCase().includes(it.name.toLowerCase())
          );
          return isMatch ? { ...tbi, isPurchased: true } : tbi;
        });

        return {
          ...p,
          toBuyItems: updatedToBuy,
          usedMaterials: [...(p.usedMaterials || []), ...usedMatItems],
        };
      });

      setProjects(updatedProjects);

      // Catat pengeluaran kas proyek
      const newCf: CashflowRecord = {
        id: generateId('cf'),
        date: today,
        type: 'KELUAR',
        category: 'BAHAN_PROYEK',
        amount: receiptData.totalAmount,
        referenceProjectId: targetProjectId,
        referenceProjectName: targetPrjName,
        notes: `Bahan proyek via Scan Nota ${receiptData.storeName} (${targetPrjName})`,
        createdAt: new Date().toISOString(),
      };
      setCashflow((prev) => [newCf, ...prev]);

      // Langsung sinkronkan ke Cloud Firestore
      pushToCloud({
        projects: updatedProjects,
        receipts: [savedReceipt, ...receipts],
        cashflow: [newCf, ...cashflow],
      }).catch((e) => console.error('Cloud push failed on scan receipt (PROYEK):', e));
    }
  };

  const deleteReceipt = (id: string) => {
    setReceipts((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      pushToCloud({ receipts: updated }).catch((e) => console.error('Cloud push failed:', e));
      return updated;
    });
  };

  const clearAllReceipts = () => {
    setReceipts([]);
    pushToCloud({ receipts: [] }).catch((e) => console.error('Cloud push failed:', e));
  };

  // Kasbon Workers
  const addWorker = (worker: Omit<KasbonWorker, 'id' | 'totalBorrowed' | 'totalPaid' | 'balance' | 'transactions'>) => {
    const newWkr: KasbonWorker = {
      ...worker,
      id: generateId('wkr'),
      totalBorrowed: 0,
      totalPaid: 0,
      balance: 0,
      transactions: [],
    };
    setWorkers((prev) => [...prev, newWkr]);
  };

  const updateWorker = (id: string, updates: Partial<KasbonWorker>) => {
    setWorkers((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  };

  const deleteWorker = (id: string) => {
    setWorkers((prev) => prev.filter((w) => w.id !== id));
  };

  const addKasbonTx = (
    workerId: string,
    type: 'PINJAM' | 'BAYAR_CICILAN',
    amount: number,
    notes?: string,
    date?: string
  ) => {
    const today = date || new Date().toISOString().split('T')[0];
    const worker = workers.find((w) => w.id === workerId);
    if (!worker || amount <= 0) return;

    const txId = generateId('kt');
    const newTx = {
      id: txId,
      workerId,
      type,
      amount,
      date: today,
      notes: notes || (type === 'PINJAM' ? 'Pinjaman Kasbon Baru' : 'Pelunasan Cicilan Kasbon'),
    };

    setWorkers((prev) =>
      prev.map((w) => {
        if (w.id !== workerId) return w;
        const newBorrowed = type === 'PINJAM' ? w.totalBorrowed + amount : w.totalBorrowed;
        const newPaid = type === 'BAYAR_CICILAN' ? w.totalPaid + amount : w.totalPaid;
        const newBalance = Math.max(0, newBorrowed - newPaid);
        return {
          ...w,
          totalBorrowed: newBorrowed,
          totalPaid: newPaid,
          balance: newBalance,
          transactions: [newTx, ...w.transactions],
        };
      })
    );

    // Arus kas
    if (type === 'PINJAM') {
      const newCf: CashflowRecord = {
        id: generateId('cf'),
        date: today,
        type: 'KELUAR',
        category: 'KASBON_PEKERJA',
        amount,
        notes: `Kasbon Pekerja: ${worker.name}${notes ? ' - ' + notes : ''}`,
        createdAt: new Date().toISOString(),
      };
      setCashflow((prev) => [newCf, ...prev]);
    } else {
      const newCf: CashflowRecord = {
        id: generateId('cf'),
        date: today,
        type: 'MASUK',
        category: 'PENDAPATAN_LAIN',
        amount,
        notes: `Pelunasan Cicilan Kasbon: ${worker.name}${notes ? ' - ' + notes : ''}`,
        createdAt: new Date().toISOString(),
      };
      setCashflow((prev) => [newCf, ...prev]);
    }
  };

  // Global Cashflow
  const addCashflowRecord = (record: Omit<CashflowRecord, 'id' | 'createdAt'>) => {
    const newRecord: CashflowRecord = {
      ...record,
      id: generateId('cf'),
      createdAt: new Date().toISOString(),
    };
    setCashflow((prev) => {
      const updated = [newRecord, ...prev];
      pushToCloud({ cashflow: updated }).catch((e) => console.error('Cloud push failed:', e));
      return updated;
    });
  };

  const deleteCashflowRecord = (id: string) => {
    setCashflow((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      pushToCloud({ cashflow: updated }).catch((e) => console.error('Cloud push failed:', e));
      return updated;
    });
  };

  const clearAllCashflow = () => {
    setCashflow([]);
    pushToCloud({ cashflow: [] }).catch((e) => console.error('Cloud push failed:', e));
  };

  const closePeriodAndZeroCash = (notes?: string): { success: boolean; amount: number } => {
    const income = cashflow.filter((tx) => tx.type === 'MASUK').reduce((sum, tx) => sum + tx.amount, 0);
    const expense = cashflow.filter((tx) => tx.type === 'KELUAR').reduce((sum, tx) => sum + tx.amount, 0);
    const balance = income - expense;

    if (balance > 0) {
      // Saldo surplus: catat penarikan laba/saldo kas keluar agar saldo pas Rp 0
      const newRecord: CashflowRecord = {
        id: generateId('cf'),
        date: new Date().toISOString().split('T')[0],
        type: 'KELUAR',
        category: 'PENARIKAN_LABA_PEMILIK',
        amount: balance,
        notes: notes || `Tutup Buku Periode: Penarikan Sisa Saldo Kas ke Rp 0`,
        createdAt: new Date().toISOString(),
      };
      setCashflow((prev) => {
        const updated = [newRecord, ...prev];
        pushToCloud({ cashflow: updated }).catch((e) => console.error('Cloud push failed:', e));
        return updated;
      });
      return { success: true, amount: balance };
    } else if (balance < 0) {
      // Saldo minus (defisit): catat tambahan modal masuk penyeimbang agar saldo pas Rp 0
      const newRecord: CashflowRecord = {
        id: generateId('cf'),
        date: new Date().toISOString().split('T')[0],
        type: 'MASUK',
        category: 'MODAL_PEMILIK',
        amount: Math.abs(balance),
        notes: notes || `Tutup Buku Periode: Tambahan Modal Penyeimbang ke Rp 0`,
        createdAt: new Date().toISOString(),
      };
      setCashflow((prev) => {
        const updated = [newRecord, ...prev];
        pushToCloud({ cashflow: updated }).catch((e) => console.error('Cloud push failed:', e));
        return updated;
      });
      return { success: true, amount: balance };
    }
    return { success: false, amount: 0 };
  };

  // ==========================================
  // BUKU KAS HARIAN (INDEPENDENT / PERSONAL)
  // ==========================================
  const addDailyCashRecord = (record: Omit<DailyCashRecord, 'id' | 'createdAt'>) => {
    const newRecord: DailyCashRecord = {
      ...record,
      id: generateId('dc'),
      createdAt: new Date().toISOString(),
      createdBy: session?.name || (session?.role === 'PEMILIK' ? 'Pemilik' : 'Admin'),
    };
    deletedDailyCashIdsRef.current.delete(newRecord.id);

    setDailyCashRecords((prev) => {
      const updated = [newRecord, ...prev];
      try {
        localStorage.setItem('fatend_daily_cash', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      pushToCloud({ dailyCash: updated }).catch((e) => console.error('Cloud push failed:', e));
      return updated;
    });
  };

  const updateDailyCashRecord = (id: string, updates: Partial<DailyCashRecord>) => {
    setDailyCashRecords((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
      );
      try {
        localStorage.setItem('fatend_daily_cash', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      pushToCloud({ dailyCash: updated }).catch((e) => console.error('Cloud push failed:', e));
      return updated;
    });
  };

  const deleteDailyCashRecord = (id: string) => {
    deletedDailyCashIdsRef.current.add(id);
    const updatedDeletedIds: string[] = Array.from(deletedDailyCashIdsRef.current);
    setDailyCashRecords((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem('fatend_daily_cash', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      pushToCloud({
        dailyCash: updated,
        deletedDailyCashIds: updatedDeletedIds,
      }).catch((e) => console.error('Cloud push failed:', e));
      return updated;
    });
  };

  const resetDailyCashBook = () => {
    dailyCashRecords.forEach((r) => deletedDailyCashIdsRef.current.add(r.id));
    const updatedDeletedIds: string[] = Array.from(deletedDailyCashIdsRef.current);
    setDailyCashRecords([]);
    try {
      localStorage.setItem('fatend_daily_cash', JSON.stringify([]));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
    pushToCloud({
      dailyCash: [],
      deletedDailyCashIds: updatedDeletedIds,
    }).catch((e) => console.error('Cloud push failed on resetDailyCashBook:', e));
  };

  const clearAllDailyCash = () => {
    resetDailyCashBook();
  };

  const zeroOutDailyCashBalance = (notes?: string): { success: boolean; amount: number; type: 'MASUK' | 'KELUAR' } => {
    const income = dailyCashRecords.filter((r) => r.type === 'MASUK').reduce((sum, r) => sum + r.amount, 0);
    const expense = dailyCashRecords.filter((r) => r.type === 'KELUAR').reduce((sum, r) => sum + r.amount, 0);
    const balance = income - expense;

    if (balance === 0) {
      return { success: false, amount: 0, type: 'KELUAR' };
    }

    if (balance > 0) {
      // Saldo surplus: catat transaksi keluar penyeimbang agar saldo bersih pas Rp 0
      const newRecord: DailyCashRecord = {
        id: generateId('dc'),
        date: new Date().toISOString().split('T')[0],
        type: 'KELUAR',
        amount: balance,
        description: notes || 'Tutup Periode / Setor Saldo Kas ke Pemilik (0-kan Kas)',
        createdAt: new Date().toISOString(),
        createdBy: session?.name || (session?.role === 'PEMILIK' ? 'Pemilik' : 'Admin'),
      };
      deletedDailyCashIdsRef.current.delete(newRecord.id);
      setDailyCashRecords((prev) => {
        const updated = [newRecord, ...prev];
        try {
          localStorage.setItem('fatend_daily_cash', JSON.stringify(updated));
        } catch (e) {
          console.warn(e);
        }
        pushToCloud({
          dailyCash: updated,
          deletedDailyCashIds: Array.from(deletedDailyCashIdsRef.current),
        }).catch((e) => console.error('Cloud push failed on zeroOutDailyCashBalance:', e));
        return updated;
      });
      return { success: true, amount: balance, type: 'KELUAR' };
    } else {
      // Saldo defisit: catat transaksi modal masuk penyeimbang agar saldo bersih pas Rp 0
      const deficitAmount = Math.abs(balance);
      const newRecord: DailyCashRecord = {
        id: generateId('dc'),
        date: new Date().toISOString().split('T')[0],
        type: 'MASUK',
        amount: deficitAmount,
        description: notes || 'Tutup Periode / Tambahan Modal Penyeimbang (0-kan Kas)',
        createdAt: new Date().toISOString(),
        createdBy: session?.name || (session?.role === 'PEMILIK' ? 'Pemilik' : 'Admin'),
      };
      deletedDailyCashIdsRef.current.delete(newRecord.id);
      setDailyCashRecords((prev) => {
        const updated = [newRecord, ...prev];
        try {
          localStorage.setItem('fatend_daily_cash', JSON.stringify(updated));
        } catch (e) {
          console.warn(e);
        }
        pushToCloud({
          dailyCash: updated,
          deletedDailyCashIds: Array.from(deletedDailyCashIdsRef.current),
        }).catch((e) => console.error('Cloud push failed on zeroOutDailyCashBalance:', e));
        return updated;
      });
      return { success: true, amount: deficitAmount, type: 'MASUK' };
    }
  };

  const restoreMasterWorkshopData = async () => {
    deletedProjectIdsRef.current = new Set(INITIAL_DELETED_PROJECT_IDS);
    deletedDailyCashIdsRef.current = new Set();
    deletedInventoryIdsRef.current = new Set();
    deletedSubItemIdsRef.current = new Set();

    const realProjects = INITIAL_PROJECTS.filter((p) => !INITIAL_DELETED_PROJECT_IDS.includes(p.id));
    const realInventory = INITIAL_INVENTORY;
    const realMutations = INITIAL_MUTATIONS;
    const realReceipts = INITIAL_RECEIPTS;
    const realWorkers = INITIAL_KASBON_WORKERS;
    const realCashflow = INITIAL_CASHFLOW;
    const realDailyCash = INITIAL_DAILY_CASH;

    setProjects(realProjects);
    setInventory(realInventory);
    setMutations(realMutations);
    setReceipts(realReceipts);
    setWorkers(realWorkers);
    setCashflow(realCashflow);
    setDailyCashRecords(realDailyCash);

    localStorage.setItem('fatend_projects', JSON.stringify(realProjects));
    localStorage.setItem('fatend_inventory', JSON.stringify(realInventory));
    localStorage.setItem('fatend_mutations', JSON.stringify(realMutations));
    localStorage.setItem('fatend_receipts', JSON.stringify(realReceipts));
    localStorage.setItem('fatend_workers', JSON.stringify(realWorkers));
    localStorage.setItem('fatend_cashflow', JSON.stringify(realCashflow));
    localStorage.setItem('fatend_daily_cash', JSON.stringify(realDailyCash));
    localStorage.setItem('fatend_deleted_projects', JSON.stringify(INITIAL_DELETED_PROJECT_IDS));
    localStorage.removeItem('fatend_deleted_daily_cash');
    localStorage.removeItem('fatend_deleted_inventory');
    localStorage.removeItem('fatend_deleted_subitems');

    hasLoadedRemoteRef.current = true;
    setCloudStatus('syncing');

    const ok = await pushToCloud({
      projects: realProjects,
      inventory: realInventory,
      mutations: realMutations,
      receipts: realReceipts,
      workers: realWorkers,
      cashflow: realCashflow,
      pinConfig,
      dailyCash: realDailyCash,
      deletedProjectIds: INITIAL_DELETED_PROJECT_IDS,
      deletedInventoryIds: [],
      deletedDailyCashIds: [],
      deletedSubItemIds: [],
    });

    const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastSyncedAt(nowStr);
    setCloudStatus(ok ? 'connected' : 'error');

    return {
      success: ok,
      projectCount: realProjects.length,
      stockCount: realInventory.length,
      mutationCount: realMutations.length,
      workerCount: realWorkers.length,
      dailyCashCount: realDailyCash.length,
    };
  };

  const restoreDailyCashFromWorkshop = async () => {
    deletedDailyCashIdsRef.current = new Set();
    try {
      localStorage.removeItem('fatend_deleted_daily_cash');
    } catch (e) {
      console.warn(e);
    }

    const realDailyCash = INITIAL_DAILY_CASH;
    setDailyCashRecords(realDailyCash);
    try {
      localStorage.setItem('fatend_daily_cash', JSON.stringify(realDailyCash));
    } catch (e) {
      console.warn(e);
    }

    hasLoadedRemoteRef.current = true;
    setCloudStatus('syncing');

    const ok = await pushToCloud({
      dailyCash: realDailyCash,
      deletedDailyCashIds: [],
    });

    const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastSyncedAt(nowStr);
    setCloudStatus(ok ? 'connected' : 'error');

    const inc = realDailyCash.filter((r) => r.type === 'MASUK').reduce((s, r) => s + r.amount, 0);
    const exp = realDailyCash.filter((r) => r.type === 'KELUAR').reduce((s, r) => s + r.amount, 0);

    return {
      success: ok,
      count: realDailyCash.length,
      balance: inc - exp,
    };
  };

  const importMasterPayload = async (payloadData: any) => {
    let raw = payloadData?.data || payloadData?.workshopData || payloadData?.fatend_workshop_data || payloadData?.payload || payloadData;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    if (Array.isArray(raw)) {
      raw = { projects: raw };
    }
    if (!raw || typeof raw !== 'object') {
      throw new Error('Format file cadangan tidak valid.');
    }

    const importedProjects: Project[] = Array.isArray(raw.projects)
      ? raw.projects
      : Array.isArray(raw.proyek)
      ? raw.proyek
      : Array.isArray(raw.fatend_projects)
      ? raw.fatend_projects
      : [];

    const importedInventory: InventoryItem[] = Array.isArray(raw.inventory)
      ? raw.inventory
      : Array.isArray(raw.stok)
      ? raw.stok
      : Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.fatend_inventory)
      ? raw.fatend_inventory
      : [];

    const importedMutations: StockMutation[] = Array.isArray(raw.mutations)
      ? raw.mutations
      : Array.isArray(raw.mutasi)
      ? raw.mutasi
      : Array.isArray(raw.fatend_mutations)
      ? raw.fatend_mutations
      : [];

    const importedDailyCash: DailyCashRecord[] = Array.isArray(raw.dailyCash)
      ? raw.dailyCash
      : Array.isArray(raw.daily_cash)
      ? raw.daily_cash
      : Array.isArray(raw.kas)
      ? raw.kas
      : Array.isArray(raw.fatend_daily_cash)
      ? raw.fatend_daily_cash
      : [];

    const importedWorkers: KasbonWorker[] = Array.isArray(raw.workers)
      ? raw.workers
      : Array.isArray(raw.tukang)
      ? raw.tukang
      : Array.isArray(raw.fatend_workers)
      ? raw.fatend_workers
      : [];

    const importedCashflow: CashflowRecord[] = Array.isArray(raw.cashflow)
      ? raw.cashflow
      : Array.isArray(raw.kasflow)
      ? raw.kasflow
      : Array.isArray(raw.fatend_cashflow)
      ? raw.fatend_cashflow
      : [];

    const importedReceipts: ReceiptScan[] = Array.isArray(raw.receipts)
      ? raw.receipts
      : Array.isArray(raw.nota)
      ? raw.nota
      : Array.isArray(raw.fatend_receipts)
      ? raw.fatend_receipts
      : [];

    // Clear deleted tombstones so imported data isn't filtered out
    deletedProjectIdsRef.current = new Set();
    deletedDailyCashIdsRef.current = new Set();
    deletedInventoryIdsRef.current = new Set();
    try {
      localStorage.removeItem('fatend_deleted_projects');
      localStorage.removeItem('fatend_deleted_daily_cash');
    } catch (e) {
      console.warn(e);
    }

    // 1. Update React state immediately
    if (importedProjects.length > 0) setProjects(importedProjects);
    if (importedInventory.length > 0) setInventory(importedInventory);
    if (importedMutations.length > 0) setMutations(importedMutations);
    if (importedDailyCash.length > 0) setDailyCashRecords(importedDailyCash);
    if (importedWorkers.length > 0) setWorkers(importedWorkers);
    if (importedCashflow.length > 0) setCashflow(importedCashflow);
    if (importedReceipts.length > 0) setReceipts(importedReceipts);
    if (raw.pinConfig) setPinConfig(raw.pinConfig);

    // 2. Persist to LocalStorage
    try {
      if (importedProjects.length > 0) localStorage.setItem('fatend_projects', JSON.stringify(importedProjects));
      if (importedInventory.length > 0) localStorage.setItem('fatend_inventory', JSON.stringify(importedInventory));
      if (importedMutations.length > 0) localStorage.setItem('fatend_mutations', JSON.stringify(importedMutations));
      if (importedDailyCash.length > 0) localStorage.setItem('fatend_daily_cash', JSON.stringify(importedDailyCash));
      if (importedWorkers.length > 0) localStorage.setItem('fatend_workers', JSON.stringify(importedWorkers));
      if (importedCashflow.length > 0) localStorage.setItem('fatend_cashflow', JSON.stringify(importedCashflow));
      if (importedReceipts.length > 0) localStorage.setItem('fatend_receipts', JSON.stringify(importedReceipts));
      if (raw.pinConfig) localStorage.setItem('fatend_pins', JSON.stringify(raw.pinConfig));
    } catch (e) {
      console.warn('LocalStorage error on importMasterPayload:', e);
    }

    // 3. Trigger Cloud Firestore sync in background so restore is instant (< 50ms)
    hasLoadedRemoteRef.current = true;
    setCloudStatus('syncing');

    pushToCloud({
      projects: importedProjects.length > 0 ? importedProjects : projects,
      inventory: importedInventory.length > 0 ? importedInventory : inventory,
      mutations: importedMutations.length > 0 ? importedMutations : mutations,
      receipts: importedReceipts.length > 0 ? importedReceipts : receipts,
      workers: importedWorkers.length > 0 ? importedWorkers : workers,
      cashflow: importedCashflow.length > 0 ? importedCashflow : cashflow,
      dailyCash: importedDailyCash.length > 0 ? importedDailyCash : dailyCashRecords,
      pinConfig: raw.pinConfig || pinConfig,
      deletedProjectIds: [],
      deletedDailyCashIds: [],
    })
      .then((ok) => {
        const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncedAt(nowStr);
        setCloudStatus(ok ? 'connected' : 'error');
      })
      .catch((e) => {
        console.warn('Background cloud push notice:', e);
        setCloudStatus('error');
      });

    return {
      success: true,
      projectCount: importedProjects.length,
      stockCount: importedInventory.length,
      mutationCount: importedMutations.length,
      dailyCashCount: importedDailyCash.length,
      workerCount: importedWorkers.length,
      cashflowCount: importedCashflow.length,
      receiptCount: importedReceipts.length,
    };
  };

  const resetDataToDefault = () => {
    restoreMasterWorkshopData();
  };

  return (
    <AppContext.Provider
      value={{
        session,
        pinConfig,
        projects,
        inventory,
        mutations,
        receipts,
        workers,
        cashflow,
        dailyCashRecords,
        loginWithPin,
        logout,
        updatePin,
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
        addProjectExpense,
        deleteProjectExpense,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        restockItem,
        adjustStock,
        processScannedReceipt,
        deleteReceipt,
        clearAllReceipts,
        addWorker,
        updateWorker,
        deleteWorker,
        addKasbonTx,
        addCashflowRecord,
        deleteCashflowRecord,
        clearAllCashflow,
        closePeriodAndZeroCash,
        addDailyCashRecord,
        updateDailyCashRecord,
        deleteDailyCashRecord,
        clearAllDailyCash,
        zeroOutDailyCashBalance,
        resetDailyCashBook,
        resetDataToDefault,
        cloudStatus,
        lastSyncedAt,
        forceUploadToCloud,
        forceDownloadFromCloud,
        restoreMasterWorkshopData,
        restoreDailyCashFromWorkshop,
        importMasterPayload,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
};
