export type UserRole = 'PEMILIK' | 'ADMIN';

export interface UserSession {
  role: UserRole;
  name: string;
  loggedInAt: string;
}

export interface PinConfig {
  pemilikPin: string;
  adminPin: string;
}

export type ProjectStatus = 'DRAFT' | 'BERJALAN' | 'FINISHING' | 'SELESAI';

export interface ToBuyItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  estPrice: number;
  isPurchased: boolean;
  notes?: string;
}

export interface UsedMaterial {
  id: string;
  inventoryItemId?: string;
  name: string;
  qty: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  date: string;
  fromStock: boolean;
}

export type PaymentType = 'PANJAR' | 'TERMIN_1' | 'TERMIN_2' | 'PELUNASAN' | 'LAINNYA';

export interface ProjectPayment {
  id: string;
  date: string;
  type: PaymentType;
  amount: number;
  notes?: string;
}

export type WageStatus = 'BELUM_BAYAR' | 'DICICIL' | 'LUNAS';

export interface LaborWage {
  id: string;
  tukangName: string;
  helperName?: string;
  baseWage: number; // Upah tukang
  helperRate: number; // default 0.20 (20%)
  helperWage: number; // baseWage * 0.20
  totalWage: number; // baseWage * 1.20
  status: WageStatus;
  paidAmount: number;
  paidDate?: string;
  notes?: string;
}

export interface ProjectExpense {
  id: string;
  date: string;
  name: string;
  amount: number;
  category: string;
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  clientPhone: string;
  location: string;
  contractValue: number;
  progress: number; // 0 - 100
  status: ProjectStatus;
  startDate: string;
  deadline: string;
  toBuyItems: ToBuyItem[];
  usedMaterials: UsedMaterial[];
  payments: ProjectPayment[];
  wages: LaborWage[];
  otherExpenses: ProjectExpense[];
  notes?: string;
  createdAt: string;
}

export type StockCategory = 'material' | 'consumable';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: StockCategory;
  unit: string; // Batang, Lembar, Kotak, Pcs, Roll, Kaleng, Tabung, Kg
  currentStock: number; // can be 0
  minStock: number;
  avgPurchasePrice: number;
  location: string;
  updatedAt: string;
}

export type MutationType = 'MASUK' | 'KELUAR_PROYEK' | 'PENYESUAIAN';

export interface StockMutation {
  id: string;
  inventoryItemId: string;
  itemName: string;
  type: MutationType;
  qty: number;
  previousStock: number;
  currentStock: number;
  date: string;
  referenceId?: string;
  referenceLabel: string;
  notes?: string;
}

export interface ScannedItem {
  name: string;
  category: 'material' | 'consumable' | 'lainnya';
  quantity: number;
  qty?: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  matchedInventoryId?: string; // Optional: ID of existing inventory item to restock, or 'NEW'
  matchedInventoryName?: string;
}

export interface ReceiptScan {
  id: string;
  storeName: string;
  date: string;
  receiptNumber?: string;
  customerOrProject?: string;
  paymentStatus?: string;
  imageBase64?: string;
  photoUrl?: string;
  items: ScannedItem[];
  totalAmount: number;
  allocatedTo: 'GUDANG' | 'PROYEK';
  targetProjectId?: string;
  targetProjectName?: string;
  createdAt: string;
  notes?: string;
}

export type ScannedReceipt = ReceiptScan;

export type KasbonTxType = 'PINJAM' | 'BAYAR_CICILAN';

export interface KasbonTransaction {
  id: string;
  workerId: string;
  workerName?: string;
  type: KasbonTxType | 'PINJAM' | 'BAYAR';
  amount: number;
  date: string;
  notes?: string;
}

export interface KasbonWorker {
  id: string;
  name: string;
  role: string; // Tukang Las, Kepala Tukang, Helper, dsb.
  phone: string;
  totalBorrowed: number;
  totalPaid: number;
  balance: number; // totalBorrowed - totalPaid
  currentKasbon?: number;
  joinedDate?: string;
  transactions: KasbonTransaction[];
}

export type WorkerKasbon = KasbonWorker;

export type CashflowType = 'MASUK' | 'KELUAR';

export type CashflowCategory =
  | 'PEMBAYARAN_PROYEK'
  | 'MODAL_PEMILIK'
  | 'PENDAPATAN_LAIN'
  | 'BELANJA_STOK'
  | 'BAHAN_PROYEK'
  | 'BORONGAN_TUKANG'
  | 'LISTRIK_WORKSHOP'
  | 'GAS_OKSIGEN'
  | 'SEWA_BENGKEL'
  | 'KONSUMSI_HARIAN'
  | 'PERAWATAN_MESIN'
  | 'KASBON_PEKERJA'
  | 'OPERASIONAL_LAIN'
  | 'OPERASIONAL_BENGKEL'
  | 'BELANJA_MATERIAL'
  | 'UPAH_BORONGAN'
  | 'PENARIKAN_LABA_PEMILIK'
  | 'TUTUP_BUKU'
  | 'LAIN_LAIN';

export interface CashflowRecord {
  id: string;
  date: string;
  type: CashflowType | 'IN' | 'OUT';
  category: CashflowCategory;
  amount: number;
  referenceProjectId?: string;
  referenceProjectName?: string;
  projectId?: string;
  projectName?: string;
  description?: string;
  notes?: string;
  createdAt: string;
}

export type CashflowTransaction = CashflowRecord;

// ==========================================
// BUKU KAS HARIAN (INDEPENDENT / PERSONAL)
// ==========================================
export type DailyCashType = 'MASUK' | 'KELUAR';

export interface DailyCashRecord {
  id: string;
  date: string; // Format YYYY-MM-DD
  type: DailyCashType;
  amount: number;
  description: string; // Keterangan transaksi
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}
