import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ScannedReceipt, ScannedItem } from '../types';
import { formatIDR, formatDate } from '../utils/formatters';
import {
  ScanLine,
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  Package,
  Layers,
  FileText,
  AlertCircle,
  Image as ImageIcon,
  Trash2,
  ArrowRight,
  Eye,
  Plus,
  RefreshCw,
  Clock,
  X,
  Store,
  PenLine,
  Zap,
  Cpu,
  Search,
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface ScanReceiptViewProps {
  initialProjectId?: string;
  onNavigateToProjects?: (projectId?: string) => void;
}

// Client-side automatic image optimizer for faster upload and reliable OCR
const compressImageFile = (
  file: File
): Promise<{ base64: string; originalSizeKB: number; compressedSizeKB: number }> => {
  return new Promise((resolve, reject) => {
    const originalSizeKB = Math.round(file.size / 1024);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600; // Optimal resolution for crisp text without excessive payload
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const raw = e.target?.result as string;
          return resolve({ base64: raw, originalSizeKB, compressedSizeKB: originalSizeKB });
        }

        // Draw crisp white background (preserves dark text on transparent or scanned images)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Quality 0.85 JPEG
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        const compressedSizeKB = Math.round((compressedBase64.length * 3) / 4 / 1024);
        resolve({ base64: compressedBase64, originalSizeKB, compressedSizeKB });
      };
      img.onerror = () => {
        const raw = e.target?.result as string;
        resolve({ base64: raw, originalSizeKB, compressedSizeKB: originalSizeKB });
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const ScanReceiptView: React.FC<ScanReceiptViewProps> = ({
  initialProjectId,
  onNavigateToProjects,
}) => {
  const {
    receipts,
    projects,
    processScannedReceipt,
    deleteReceipt,
    clearAllReceipts,
    addProject,
  } = useApp();

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{
    originalSizeKB?: number;
    compressedSizeKB?: number;
  } | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<'ocr' | 'gemini'>('gemini');
  const [scanEngineNotice, setScanEngineNotice] = useState<{
    engineUsed: string;
    notice?: string;
  } | null>(null);

  // Result of current scan
  const [parsedResult, setParsedResult] = useState<{
    storeName: string;
    receiptNumber?: string;
    date: string;
    customerOrProject?: string;
    paymentStatus?: string;
    totalAmount: number;
    items: ScannedItem[];
  } | null>(null);

  // Destination allocation: GUDANG or PROYEK
  const [destination, setDestination] = useState<'GUDANG' | 'PROYEK'>(
    initialProjectId ? 'PROYEK' : 'GUDANG'
  );
  const [targetProjectId, setTargetProjectId] = useState<string>(initialProjectId || '');

  // Success banner after allocation
  const [commitSuccess, setCommitSuccess] = useState<{
    type: 'GUDANG' | 'PROYEK';
    projectName?: string;
    projectId?: string;
    itemCount: number;
    totalAmount: number;
  } | null>(null);

  // Receipt Detail Preview Modal
  const [previewReceipt, setPreviewReceipt] = useState<ScannedReceipt | null>(null);

  // History search and filter state
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyFilterAlloc, setHistoryFilterAlloc] = useState<'ALL' | 'GUDANG' | 'PROYEK'>('ALL');

  // Confirmation dialog modal
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

  // In-app Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Auto-fill project if initialProjectId passed
  React.useEffect(() => {
    if (initialProjectId) {
      setDestination('PROYEK');
      setTargetProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  // Handle file selection (with auto compression for fast upload & error-free OCR)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setScanError(null);
    setCommitSuccess(null);

    try {
      const { base64, originalSizeKB, compressedSizeKB } = await compressImageFile(file);
      setSelectedImage(base64);
      setImageMeta({ originalSizeKB, compressedSizeKB });
      setParsedResult(null);
    } catch (err) {
      console.warn('Fallback to standard file read:', err);
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setImageMeta(null);
        setParsedResult(null);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
      if (e.target) e.target.value = '';
    }
  };

  // Start fresh manual entry form
  const handleManualEntry = () => {
    setScanError(null);
    setCommitSuccess(null);
    setParsedResult({
      storeName: 'Toko Material / Besi',
      receiptNumber: '',
      date: new Date().toISOString().split('T')[0],
      customerOrProject: initialProjectId
        ? projects.find((p) => p.id === initialProjectId)?.name || ''
        : '',
      paymentStatus: 'BELUM_BAYAR',
      totalAmount: 0,
      items: [
        {
          name: '',
          qty: 1,
          quantity: 1,
          unit: 'Batang',
          unitPrice: 0,
          totalPrice: 0,
          category: 'material',
        },
      ],
    });
    if (initialProjectId) {
      setDestination('PROYEK');
      setTargetProjectId(initialProjectId);
    }
  };

  // Add new item row to current scanned result
  const handleAddNewItemRow = () => {
    if (!parsedResult) return;
    const newItem: ScannedItem = {
      name: '',
      qty: 1,
      quantity: 1,
      unit: 'Batang',
      unitPrice: 0,
      totalPrice: 0,
      category: 'material',
    };
    setParsedResult({
      ...parsedResult,
      items: [...parsedResult.items, newItem],
    });
  };

  // Sample receipts for testing/demo
  const handleLoadSample = (type: 'TOKO_BESI' | 'BAUT_MUR' | 'NOTA_RIAN') => {
    setScanError(null);
    setCommitSuccess(null);

    if (type === 'NOTA_RIAN') {
      // SVG reproduction of the user's receipt (CV FATEND STEEL - PINTU & JENDELA RIAN)
      const sampleSvgRian = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="740" viewBox="0 0 400 740"><rect width="400" height="740" fill="%23fdfbf7"/><text x="200" y="45" font-family="monospace" font-size="18" font-weight="bold" text-anchor="middle" fill="%23111">CV FATEND STEEL</text><text x="200" y="65" font-family="monospace" font-size="11" text-anchor="middle" fill="%23555">Jalan Workshop &amp; Fabrikasi</text><line x1="20" y1="80" x2="380" y2="80" stroke="%23333" stroke-dasharray="4"/><text x="20" y="100" font-family="monospace" font-size="11" fill="%23111">No Nota : TRX/16      Antrian: 1</text><text x="20" y="120" font-family="monospace" font-size="12" font-weight="bold" fill="%23d97706">Pelanggan: PINTU &amp; JENDELA RIAN</text><text x="20" y="140" font-family="monospace" font-size="10" fill="%23555">Tanggal  : 01/09/2026 - 22:38</text><text x="20" y="156" font-family="monospace" font-size="10" fill="%23555">Kasir    : Owner</text><line x1="20" y1="168" x2="380" y2="168" stroke="%23333"/><text x="20" y="186" font-family="monospace" font-size="11" font-weight="bold" fill="%23111">SPARE PART / BAHAN</text><text x="20" y="208" font-family="monospace" font-size="10" fill="%23111">1. SIKU 40X40 TKS (2 btg)</text><text x="380" y="208" font-family="monospace" font-size="10" text-anchor="end" fill="%23111">350.000</text><text x="20" y="230" font-family="monospace" font-size="10" fill="%23111">2. HOLLOW 4X4 0.8 (5 btg)</text><text x="380" y="230" font-family="monospace" font-size="10" text-anchor="end" fill="%23111">575.000</text><text x="20" y="252" font-family="monospace" font-size="10" fill="%23111">3. ENGSEL KUPU-KUPU (4 biji)</text><text x="380" y="252" font-family="monospace" font-size="10" text-anchor="end" fill="%23111">84.000</text><text x="20" y="274" font-family="monospace" font-size="10" fill="%23111">4. GRENDEL SLOT (5 pcs)</text><text x="380" y="274" font-family="monospace" font-size="10" text-anchor="end" fill="%23111">40.000</text><text x="20" y="296" font-family="monospace" font-size="10" fill="%23111">5. CAT FINISHING (1 klg)</text><text x="380" y="296" font-family="monospace" font-size="10" text-anchor="end" fill="%23111">86.000</text><text x="20" y="318" font-family="monospace" font-size="10" fill="%23111">6. MINYAK CAT (6 ltr)</text><text x="380" y="318" font-family="monospace" font-size="10" text-anchor="end" fill="%23111">66.000</text><text x="20" y="340" font-family="monospace" font-size="10" fill="%23111">7. EPOXY MERAH (1 klg)</text><text x="380" y="340" font-family="monospace" font-size="10" text-anchor="end" fill="%23111">68.000</text><text x="20" y="362" font-family="monospace" font-size="10" fill="%23111">8. MATA GOSOK (4 biji)</text><text x="380" y="362" font-family="monospace" font-size="10" text-anchor="end" fill="%23111">44.000</text><text x="20" y="384" font-family="monospace" font-size="10" fill="%23111">9. PLAT 0.8 GLVNS (2 lbr)</text><text x="380" y="384" font-family="monospace" font-size="10" text-anchor="end" fill="%23111">800.000</text><text x="20" y="406" font-family="monospace" font-size="10" fill="%23111">10. MAKAN MINUM (2 porsi)</text><text x="380" y="406" font-family="monospace" font-size="10" text-anchor="end" fill="%23111">42.000</text><text x="20" y="428" font-family="monospace" font-size="10" fill="%23111">11. SIKU JENDELA (2 biji)</text><text x="380" y="428" font-family="monospace" font-size="10" text-anchor="end" fill="%23111">92.000</text><text x="20" y="450" font-family="monospace" font-size="10" fill="%23111">12. HOLLOW 15X15 0.8 (3 btg)</text><text x="380" y="450" font-family="monospace" font-size="10" text-anchor="end" fill="%23111">138.000</text><line x1="20" y1="470" x2="380" y2="470" stroke="%23333"/><text x="20" y="496" font-family="monospace" font-size="13" font-weight="bold" fill="%23111">TOTAL: Rp 2.385.000</text><text x="20" y="518" font-family="monospace" font-size="10" fill="%23dc2626">Status: Belum Bayar  |  Metode: Cash</text><text x="200" y="560" font-family="monospace" font-size="10" text-anchor="middle" fill="%23777">-- CV FATEND STEEL --</text></svg>`;
      setSelectedImage(sampleSvgRian);

      const itemsRian: ScannedItem[] = [
        { name: 'Siku 40x40 TKS', qty: 2, quantity: 2, unit: 'Batang', unitPrice: 175000, totalPrice: 350000, category: 'material' },
        { name: 'Hollow 4x4 0.8', qty: 5, quantity: 5, unit: 'Batang', unitPrice: 115000, totalPrice: 575000, category: 'material' },
        { name: 'Engsel Kupu-Kupu', qty: 4, quantity: 4, unit: 'Pcs', unitPrice: 21000, totalPrice: 84000, category: 'consumable' },
        { name: 'Grendel Slot', qty: 5, quantity: 5, unit: 'Pcs', unitPrice: 8000, totalPrice: 40000, category: 'consumable' },
        { name: 'Cat Finishing', qty: 1, quantity: 1, unit: 'Kaleng (5kg)', unitPrice: 86000, totalPrice: 86000, category: 'consumable' },
        { name: 'Minyak Cat / Thinner', qty: 6, quantity: 6, unit: 'Pcs', unitPrice: 11000, totalPrice: 66000, category: 'consumable' },
        { name: 'Epoxy Merah Primer', qty: 1, quantity: 1, unit: 'Kaleng (5kg)', unitPrice: 68000, totalPrice: 68000, category: 'consumable' },
        { name: 'Mata Gosok / Gerinda', qty: 4, quantity: 4, unit: 'Pcs', unitPrice: 11000, totalPrice: 44000, category: 'consumable' },
        { name: 'Plat 0.8 Galvanis', qty: 2, quantity: 2, unit: 'Lembar', unitPrice: 400000, totalPrice: 800000, category: 'material' },
        { name: 'Konsumsi Tukang (Makan Minum)', qty: 2, quantity: 2, unit: 'Pcs', unitPrice: 21000, totalPrice: 42000, category: 'consumable' },
        { name: 'Siku Jendela', qty: 2, quantity: 2, unit: 'Pcs', unitPrice: 46000, totalPrice: 92000, category: 'material' },
        { name: 'Hollow 15x15 0.8', qty: 3, quantity: 3, unit: 'Batang', unitPrice: 46000, totalPrice: 138000, category: 'material' },
      ];

      setParsedResult({
        storeName: 'CV FATEND STEEL',
        receiptNumber: 'TRX/16',
        date: '2026-09-01',
        customerOrProject: 'PINTU & JENDELA RIAN',
        paymentStatus: 'BELUM_BAYAR',
        totalAmount: 2385000,
        items: itemsRian,
      });

      // Auto match to Pintu & Jendela Rian project!
      const rianPrj = projects.find(
        (p) =>
          p.name.toLowerCase().includes('rian') ||
          p.clientName.toLowerCase().includes('rian') ||
          p.id === 'prj_4'
      );
      if (rianPrj) {
        setDestination('PROYEK');
        setTargetProjectId(rianPrj.id);
      } else {
        setDestination('PROYEK');
      }
      return;
    }

    if (type === 'TOKO_BESI') {
      const sampleSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><rect width="400" height="600" fill="%23fdfbf7"/><text x="200" y="50" font-family="monospace" font-size="18" font-weight="bold" text-anchor="middle" fill="%23111">TB. JAYA BAJA ABADI</text><text x="200" y="75" font-family="monospace" font-size="11" text-anchor="middle" fill="%23555">Jl. Raya Industri Logam No. 88</text><text x="200" y="95" font-family="monospace" font-size="11" text-anchor="middle" fill="%23555">Telp: 0812-9988-7766</text><line x1="20" y1="110" x2="380" y2="110" stroke="%23333" stroke-dasharray="4"/><text x="20" y="130" font-family="monospace" font-size="11" fill="%23111">Tgl: 2026-09-08  No: INV-8891</text><line x1="20" y1="145" x2="380" y2="145" stroke="%23333" stroke-dasharray="4"/><text x="20" y="170" font-family="monospace" font-size="11" fill="%23111">Hollow 40x40 1.6mm Galv</text><text x="20" y="185" font-family="monospace" font-size="11" fill="%23555">6 btg @ Rp 135.000</text><text x="380" y="185" font-family="monospace" font-size="11" text-anchor="end" fill="%23111">Rp 810.000</text><text x="20" y="215" font-family="monospace" font-size="11" fill="%23111">Plat Bordes 2.3mm</text><text x="20" y="230" font-family="monospace" font-size="11" fill="%23555">1 lbr @ Rp 680.000</text><text x="380" y="230" font-family="monospace" font-size="11" text-anchor="end" fill="%23111">Rp 680.000</text><text x="20" y="260" font-family="monospace" font-size="11" fill="%23111">Kawat Las RD-260 3.2mm</text><text x="20" y="275" font-family="monospace" font-size="11" fill="%23555">2 ktk @ Rp 150.000</text><text x="380" y="275" font-family="monospace" font-size="11" text-anchor="end" fill="%23111">Rp 300.000</text><line x1="20" y1="300" x2="380" y2="300" stroke="%23333"/><text x="20" y="325" font-family="monospace" font-size="14" font-weight="bold" fill="%23111">TOTAL BAYAR (CASH)</text><text x="380" y="325" font-family="monospace" font-size="14" font-weight="bold" text-anchor="end" fill="%23111">Rp 1.790.000</text><text x="200" y="420" font-family="monospace" font-size="11" text-anchor="middle" fill="%23777">-- Terima Kasih --</text></svg>`;
      setSelectedImage(sampleSvg);

      setParsedResult({
        storeName: 'TB. JAYA BAJA ABADI',
        receiptNumber: 'INV-8891',
        date: new Date().toISOString().split('T')[0],
        totalAmount: 1790000,
        items: [
          {
            name: 'Hollow 40x40 1.6mm Galvanis',
            qty: 6,
            quantity: 6,
            unit: 'Batang',
            unitPrice: 135000,
            totalPrice: 810000,
            category: 'material',
          },
          {
            name: 'Plat Bordes 2.3mm',
            qty: 1,
            quantity: 1,
            unit: 'Lembar',
            unitPrice: 680000,
            totalPrice: 680000,
            category: 'material',
          },
          {
            name: 'Kawat Las RD-260 3.2mm',
            qty: 2,
            quantity: 2,
            unit: 'Kotak (5kg)',
            unitPrice: 150000,
            totalPrice: 300000,
            category: 'consumable',
          },
        ],
      });
    } else {
      const sampleSvg2 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><rect width="400" height="600" fill="%23fdfbf7"/><text x="200" y="50" font-family="monospace" font-size="18" font-weight="bold" text-anchor="middle" fill="%23111">TOKO TEKNIK MANDIRI</text><text x="200" y="75" font-family="monospace" font-size="11" text-anchor="middle" fill="%23555">Baut, Mur, Cutting Disc &amp; Cat</text><line x1="20" y1="110" x2="380" y2="110" stroke="%23333" stroke-dasharray="4"/><text x="20" y="130" font-family="monospace" font-size="11" fill="%23111">Tgl: 2026-09-09  Kasir: 01</text><line x1="20" y1="145" x2="380" y2="145" stroke="%23333" stroke-dasharray="4"/><text x="20" y="170" font-family="monospace" font-size="11" fill="%23111">Batu Gerinda Potong 4" Nippon</text><text x="20" y="185" font-family="monospace" font-size="11" fill="%23555">1 ktk (25pcs) @ Rp 140.000</text><text x="380" y="185" font-family="monospace" font-size="11" text-anchor="end" fill="%23111">Rp 140.000</text><text x="20" y="215" font-family="monospace" font-size="11" fill="%23111">Cat Primer Zinchromate Nippe</text><text x="20" y="230" font-family="monospace" font-size="11" fill="%23555">1 klg (5kg) @ Rp 185.000</text><text x="380" y="230" font-family="monospace" font-size="11" text-anchor="end" fill="%23111">Rp 185.000</text><text x="20" y="260" font-family="monospace" font-size="11" fill="%23111">Dynabolt M10x77</text><text x="20" y="275" font-family="monospace" font-size="11" fill="%23555">50 pcs @ Rp 3.500</text><text x="380" y="275" font-family="monospace" font-size="11" text-anchor="end" fill="%23111">Rp 175.000</text><line x1="20" y1="300" x2="380" y2="300" stroke="%23333"/><text x="20" y="325" font-family="monospace" font-size="14" font-weight="bold" fill="%23111">TOTAL</text><text x="380" y="325" font-family="monospace" font-size="14" font-weight="bold" text-anchor="end" fill="%23111">Rp 500.000</text></svg>`;
      setSelectedImage(sampleSvg2);
      setParsedResult({
        storeName: 'TOKO TEKNIK MANDIRI',
        date: new Date().toISOString().split('T')[0],
        totalAmount: 500000,
        items: [
          {
            name: 'Batu Gerinda Potong 4" Nippon Resibon',
            qty: 1,
            quantity: 1,
            unit: 'Kotak (25 pcs)',
            unitPrice: 140000,
            totalPrice: 140000,
            category: 'consumable',
          },
          {
            name: 'Cat Primer Zinchromate Abu',
            qty: 1,
            quantity: 1,
            unit: 'Kaleng (5kg)',
            unitPrice: 185000,
            totalPrice: 185000,
            category: 'consumable',
          },
          {
            name: 'Dynabolt M10x77 Galvanis',
            qty: 50,
            quantity: 50,
            unit: 'Pcs',
            unitPrice: 3500,
            totalPrice: 175000,
            category: 'consumable',
          },
        ],
      });
    }
  };

  // Helper to create new project if detected in receipt but doesn't exist yet
  const handleCreateProjectFromReceipt = () => {
    if (!parsedResult?.customerOrProject) return;
    const detectedName = parsedResult.customerOrProject;
    const newPrj = addProject({
      name: detectedName,
      clientName: detectedName.includes('RIAN') ? 'Sdr. Rian' : detectedName,
      clientPhone: '',
      location: 'Workshop Fatend Steel',
      contractValue: Math.round(parsedResult.totalAmount * 1.5),
      progress: 10,
      status: 'BERJALAN',
      startDate: parsedResult.date || new Date().toISOString().split('T')[0],
      deadline: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      notes: `Dibuat otomatis dari Scan Nota ${parsedResult.storeName} (${parsedResult.receiptNumber || 'TRX'})`,
    });
    setDestination('PROYEK');
    setTargetProjectId(newPrj.id);
  };

  // Trigger scan with OCR or Gemini (with auto-fallback)
  const handleScanReceipt = async (engineToUse?: 'ocr' | 'gemini') => {
    if (!selectedImage) return;

    const chosenEngine = engineToUse || activeEngine;
    setIsScanning(true);
    setScanError(null);
    setCommitSuccess(null);
    setScanEngineNotice(null);

    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImage,
          engine: chosenEngine,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        let errMessage = data?.error || data?.message;
        if (!errMessage) {
          errMessage = `Gagal memproses nota (HTTP ${response.status}). Silakan coba lagi atau gunakan input manual.`;
        }
        throw new Error(errMessage);
      }

      if (data.engineUsed || data.notice) {
        setScanEngineNotice({
          engineUsed: data.engineUsed || (chosenEngine === 'ocr' ? 'Tesseract OCR Lokal' : 'AI Gemini'),
          notice: data.notice,
        });
      }

      const raw = data.data;
      const detectedCustomer = raw.customerOrProject || '';
      const detectedStore = raw.storeName || 'CV FATEND STEEL';
      const detectedDate = raw.date || new Date().toISOString().split('T')[0];
      const detectedReceiptNo = raw.receiptNumber || '';
      const detectedPayment = raw.paymentStatus || 'BELUM_BAYAR';

      const mappedItems: ScannedItem[] = (raw.items || [])
        .filter((it: any) => {
          const n = (it?.name || '').trim();
          if (!n) return false;
          // Filter out if item name is project/customer name (e.g. MTSN PEUREULAK)
          if (detectedCustomer && n.toLowerCase() === detectedCustomer.toLowerCase()) return false;
          return true;
        })
        .map((it: any) => {
          let name = (it.name || 'Barang Bengkel').trim();
          // Remove residual formulas like "10 biji x 12.000", "bijix12.000"
          name = name.replace(/\b\d+\s*(?:biji|btg|pcs|bh|buah|klg|lbr)?\s*x\s*[\d.,]+/gi, '').trim();
          name = name.replace(/\b(?:biji|btg|pcs|bh|buah)\s*x\s*[\d.,]+/gi, '').trim();
          name = name.replace(/^[@x\-\s]+|[@x\-\s]+$/g, '').trim();
          if (!name || /^(?:bijix|btgx|pcsx)/i.test(name)) name = 'Material Las';

          const q = Number(it.quantity || it.qty || 1);
          const p = Number(it.unitPrice || 0);
          return {
            name,
            qty: q,
            quantity: q,
            unit: it.unit || 'Batang',
            unitPrice: p,
            totalPrice: it.totalPrice || q * p,
            category: it.category || 'material',
          };
        });

      const calculatedTotal =
        raw.totalAmount || mappedItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

      setParsedResult({
        storeName: detectedStore,
        receiptNumber: detectedReceiptNo,
        date: detectedDate,
        customerOrProject: detectedCustomer,
        paymentStatus: detectedPayment,
        totalAmount: calculatedTotal,
        items: mappedItems,
      });

      // Smart auto-matching to project if detected
      if (detectedCustomer) {
        const match = projects.find((p) => {
          const c = detectedCustomer.toLowerCase();
          const pn = p.name.toLowerCase();
          const cn = p.clientName.toLowerCase();
          return (
            pn.includes(c) ||
            c.includes(pn) ||
            cn.includes(c) ||
            c.includes(cn) ||
            (c.includes('rian') && (pn.includes('rian') || cn.includes('rian') || p.id === 'prj_4'))
          );
        });

        if (match) {
          setDestination('PROYEK');
          setTargetProjectId(match.id);
        } else {
          setDestination('PROYEK');
        }
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setScanError(
        err?.message || 'Gagal memproses nota. Silakan coba lagi atau gunakan input manual.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  // Item field editor
  const handleUpdateItem = (index: number, field: string, value: any) => {
    if (!parsedResult) return;
    const nextItems = [...parsedResult.items];
    const current = { ...nextItems[index], [field]: value } as ScannedItem;
    const qtyVal =
      field === 'qty' || field === 'quantity' ? Number(value) : current.quantity || current.qty || 1;
    const priceVal = field === 'unitPrice' ? Number(value) : current.unitPrice || 0;
    current.quantity = qtyVal;
    current.qty = qtyVal;
    current.unitPrice = priceVal;
    current.totalPrice = qtyVal * priceVal;
    nextItems[index] = current;

    const nextTotal = nextItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
    setParsedResult({
      ...parsedResult,
      items: nextItems,
      totalAmount: nextTotal,
    });
  };

  const handleRemoveItem = (index: number) => {
    if (!parsedResult) return;
    const nextItems = parsedResult.items.filter((_, idx) => idx !== index);
    const nextTotal = nextItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
    setParsedResult({
      ...parsedResult,
      items: nextItems,
      totalAmount: nextTotal,
    });
  };

  // Commit items into system
  const handleCommitAllocation = () => {
    if (!parsedResult || !selectedImage) return;

    if (destination === 'PROYEK' && !targetProjectId) {
      setScanError('Silakan pilih proyek tujuan untuk bahan terpakai!');
      return;
    }

    const targetPrj =
      destination === 'PROYEK' ? projects.find((p) => p.id === targetProjectId) : null;

    processScannedReceipt(
      {
        date: parsedResult.date,
        storeName: parsedResult.storeName,
        receiptNumber: parsedResult.receiptNumber,
        customerOrProject: parsedResult.customerOrProject,
        paymentStatus: parsedResult.paymentStatus,
        imageBase64: selectedImage,
        photoUrl: selectedImage,
        totalAmount: parsedResult.totalAmount,
        allocatedTo: destination,
        targetProjectId: destination === 'PROYEK' ? targetProjectId : undefined,
        targetProjectName: targetPrj?.name,
        items: parsedResult.items.map((it) => ({
          ...it,
          quantity: it.quantity || it.qty || 1,
        })),
      },
      destination,
      destination === 'PROYEK' ? targetProjectId : undefined
    );

    setCommitSuccess({
      type: destination,
      projectName: targetPrj?.name,
      projectId: targetPrj?.id,
      itemCount: parsedResult.items.length,
      totalAmount: parsedResult.totalAmount,
    });

    // Reset scan state
    setSelectedImage(null);
    setParsedResult(null);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#16181e] p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="font-industrial text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-amber-400" />
            <span>Scan Nota &amp; Struk AI (Gemini)</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Foto nota pembelian material/consumable → AI baca otomatis → Alokasikan langsung ke Bahan Proyek atau Stok Gudang
          </p>
        </div>

        {/* Demo Samples */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] text-zinc-400 font-semibold hidden sm:inline">Uji Sampel:</span>
          <button
            type="button"
            onClick={() => handleLoadSample('NOTA_RIAN')}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-[11px] font-bold text-amber-300 border border-amber-500/40 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>⚡ Nota Rian (12 Item)</span>
          </button>
          <button
            type="button"
            onClick={() => handleLoadSample('TOKO_BESI')}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold text-zinc-300 border border-zinc-700 transition-all"
          >
            Toko Besi
          </button>
          <button
            type="button"
            onClick={() => handleLoadSample('BAUT_MUR')}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold text-zinc-300 border border-zinc-700 transition-all"
          >
            Teknik Mandiri
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {commitSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-600/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-300 animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Nota Berhasil Disimpan &amp; Bahan Masuk ke Sistem!</span>
              </h4>
              <p className="text-xs text-zinc-300 mt-0.5">
                {commitSuccess.itemCount} item bahan senilai{' '}
                <strong className="text-amber-400 font-mono">
                  {formatIDR(commitSuccess.totalAmount)}
                </strong>{' '}
                telah otomatis dialokasikan{' '}
                {commitSuccess.type === 'PROYEK' ? (
                  <>
                    sebagai <strong className="text-white">Bahan Terpakai</strong> di Proyek{' '}
                    <span className="underline decoration-amber-500 font-semibold text-amber-300">
                      {commitSuccess.projectName}
                    </span>
                  </>
                ) : (
                  <>ke <strong className="text-white">Stok Gudang</strong></>
                )}
                . Arus kas pengeluaran telah diperbarui.
              </p>
            </div>
          </div>
          {commitSuccess.type === 'PROYEK' && commitSuccess.projectId && onNavigateToProjects && (
            <button
              type="button"
              onClick={() => onNavigateToProjects(commitSuccess.projectId)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-all shadow hover:shadow-emerald-500/20"
            >
              <span>Buka Proyek Ini</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Camera / File Upload Box */}
        <div className="lg:col-span-5 space-y-3">
          <div className="p-4 rounded-2xl bg-[#16181e] border border-zinc-800 flex flex-col items-center text-center">
            {/* Dual Hidden Inputs: One for Photo Gallery / Files, one for Direct Camera */}
            <input
              type="file"
              accept="image/*"
              ref={galleryInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedImage ? (
              <div className="w-full relative group">
                <div className="relative max-h-72 w-full rounded-xl overflow-hidden bg-black/60 border border-zinc-700 flex items-center justify-center">
                  <img
                    src={selectedImage}
                    alt="Nota Preview"
                    className="max-h-72 object-contain"
                  />
                  {isScanning && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center p-4">
                      <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent animate-spin mb-3" />
                      <p className="text-amber-400 font-bold text-xs">
                        Gemini AI sedang membaca isi nota...
                      </p>
                      <p className="text-zinc-400 text-[11px] mt-1">
                        Mendeteksi nama barang, kuantiti & harga
                      </p>
                    </div>
                  )}
                </div>

                {imageMeta?.compressedSizeKB && (
                  <div className="mt-2 text-[11px] text-emerald-400 flex items-center justify-center gap-1.5 bg-emerald-950/40 border border-emerald-800/40 py-1 px-2.5 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Foto dioptimalkan: {imageMeta.compressedSizeKB} KB (dari {imageMeta.originalSizeKB} KB)
                    </span>
                  </div>
                )}

                <div className="flex gap-2 mt-3 w-full">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                    title="Pilih foto lain dari Galeri"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Buka Galeri</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                    title="Ambil foto baru lewat Kamera"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>Foto Kamera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setImageMeta(null);
                      setParsedResult(null);
                    }}
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-red-950 border border-zinc-700 hover:border-red-800 text-zinc-400 hover:text-red-300 cursor-pointer"
                    title="Hapus Foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-3">
                {/* Drag & Click Dropzone - Defaults to Gallery/File Browser */}
                <div
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full py-8 px-4 rounded-xl border-2 border-dashed border-zinc-700 hover:border-amber-500/70 bg-zinc-900/40 hover:bg-zinc-900/70 cursor-pointer transition-all flex flex-col items-center justify-center group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-inner group-hover:scale-105 transition-transform">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Upload Foto Nota / Struk</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs text-center">
                    Klik untuk memilih foto struk toko besi atau faktur nota
                  </p>
                  {isCompressing ? (
                    <div className="mt-4 px-3 py-1.5 rounded-lg bg-zinc-800 text-amber-400 font-medium text-xs flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengoptimalkan foto...</span>
                    </div>
                  ) : (
                    <div className="mt-3 text-[11px] text-zinc-400 flex items-center gap-1">
                      <span>Mendukung JPG, PNG, WEBP dari Galeri atau Kamera</span>
                    </div>
                  )}
                </div>

                {/* Direct Choice Buttons: Galeri HP & Kamera Langsung */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/15 cursor-pointer active:scale-98"
                  >
                    <ImageIcon className="w-4 h-4 stroke-[2.5]" />
                    <span>Pilih dari Galeri</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-100 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
                  >
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>Buka Kamera</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleManualEntry}
                  className="w-full py-2 px-3 rounded-xl border border-zinc-700/80 bg-zinc-800/40 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <PenLine className="w-3.5 h-3.5 text-amber-400" />
                  <span>Input Manual Tanpa Foto</span>
                </button>
              </div>
            )}

            {/* AI / OCR Scan Trigger Buttons */}
            {selectedImage && !parsedResult && (
              <div className="w-full mt-3 space-y-2.5">
                {/* Engine Selector */}
                <div className="p-1 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveEngine('ocr')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
                      activeEngine === 'ocr'
                        ? 'bg-amber-500 text-black font-bold shadow'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>OCR Cepat (Anti-503)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveEngine('gemini')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
                      activeEngine === 'gemini'
                        ? 'bg-amber-500 text-black font-bold shadow'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Gemini</span>
                  </button>
                </div>

                <div className="text-[11px] px-1">
                  {activeEngine === 'ocr' ? (
                    <p className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Diproses lokal di server bengkel. 100% bebas antrean & anti error 503.</span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-amber-300/90">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Analisis AI multimodal (auto-fallback ke OCR jika server Gemini padat).</span>
                    </p>
                  )}
                </div>

                {/* Primary Scan Button */}
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => handleScanReceipt()}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {activeEngine === 'ocr' ? (
                    <Zap className={`w-4 h-4 ${isScanning ? 'animate-bounce' : ''}`} />
                  ) : (
                    <Sparkles className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  )}
                  <span>
                    {isScanning
                      ? `Sedang memindai nota (${activeEngine === 'ocr' ? 'Mesin OCR Lokal' : 'AI Gemini'})...`
                      : `Mulai Pindai (${activeEngine === 'ocr' ? 'Mesin OCR Lokal' : 'AI Gemini'})`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleManualEntry}
                  className="w-full py-2 px-3 rounded-xl border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  <PenLine className="w-3.5 h-3.5 text-amber-400" />
                  <span>Atau Ketik / Input Manual</span>
                </button>
              </div>
            )}

            {scanError && (
              <div className="mt-3 p-3.5 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs space-y-2.5 text-left w-full">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span className="leading-relaxed">{scanError}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-red-900/50">
                  <button
                    type="button"
                    onClick={() => handleScanReceipt('ocr')}
                    disabled={isScanning}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow"
                  >
                    <Zap className={`w-3.5 h-3.5 ${isScanning ? 'animate-bounce' : ''}`} />
                    <span>Pindai Pakai OCR Lokal (Anti-503)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScanReceipt('gemini')}
                    disabled={isScanning}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>Coba AI Gemini Lagi</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleManualEntry}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center gap-1.5 transition-all border border-zinc-700"
                  >
                    <PenLine className="w-3.5 h-3.5 text-amber-400" />
                    <span>Isi & Edit Manual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('NOTA_RIAN')}
                    className="px-3 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 font-semibold text-xs flex items-center gap-1.5 transition-all border border-blue-800/60"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Contoh Nota Rian</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Parsed Data & Allocation Form */}
        <div className="lg:col-span-7 space-y-3">
          {parsedResult ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#16181e] border border-amber-500/40 space-y-4">
              {/* Scan Engine Source Badge */}
              {scanEngineNotice && (
                <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 text-[11px]">Metode Pemindaian:</span>
                      <span className="font-semibold text-emerald-400">{scanEngineNotice.engineUsed}</span>
                    </div>
                    {scanEngineNotice.notice && (
                      <p className="text-amber-300/90 text-[11px] mt-1 leading-relaxed">
                        {scanEngineNotice.notice}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Receipt Header Info */}
              <div className="flex flex-col gap-3 pb-3 border-b border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-amber-400 shrink-0" />
                      <input
                        type="text"
                        value={parsedResult.storeName}
                        onChange={(e) =>
                          setParsedResult({ ...parsedResult, storeName: e.target.value })
                        }
                        placeholder="Nama Toko / Suplier"
                        className="bg-transparent font-industrial font-bold text-base text-white border-b border-zinc-700 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <span>No. Nota:</span>
                        <input
                          type="text"
                          value={parsedResult.receiptNumber || ''}
                          onChange={(e) =>
                            setParsedResult({ ...parsedResult, receiptNumber: e.target.value })
                          }
                          placeholder="Contoh: 001"
                          className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700 text-zinc-200 text-xs w-24 font-mono"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>Tanggal:</span>
                        <input
                          type="date"
                          value={parsedResult.date}
                          onChange={(e) =>
                            setParsedResult({ ...parsedResult, date: e.target.value })
                          }
                          className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700 text-zinc-200 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="sm:text-right flex sm:flex-col justify-between items-end">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                        Total Nilai Nota
                      </span>
                      <span className="text-lg font-bold text-amber-400 font-mono-num">
                        {formatIDR(parsedResult.totalAmount)}
                      </span>
                    </div>
                    {parsedResult.paymentStatus && (
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          parsedResult.paymentStatus === 'LUNAS'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {parsedResult.paymentStatus === 'LUNAS' ? 'Status: LUNAS' : 'Status: BELUM BAYAR / BON'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Auto-detected Customer / Project Banner */}
                {parsedResult.customerOrProject && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-300">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span>Terdeteksi Proyek/Pelanggan: </span>
                        <strong className="text-white font-semibold">"{parsedResult.customerOrProject}"</strong>
                      </div>
                    </div>
                    {targetProjectId ? (
                      <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Otomatis dialokasikan ke Proyek ini</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCreateProjectFromReceipt}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold transition-all shadow"
                      >
                        + Buat Proyek "{parsedResult.customerOrProject}" Otomatis
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-300">
                    Daftar Barang Hasil Scan ({parsedResult.items.length} item):
                  </span>
                  <span className="text-[10px] text-zinc-500 italic">
                    *Kuantiti dan harga dapat disesuaikan manual
                  </span>
                </div>

                <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900 text-zinc-400 font-semibold border-b border-zinc-800">
                      <tr>
                        <th className="p-2">Nama Barang</th>
                        <th className="p-2 w-20">Jumlah</th>
                        <th className="p-2 w-24">Satuan</th>
                        <th className="p-2 w-28">Harga Satuan</th>
                        <th className="p-2 w-28">Subtotal</th>
                        <th className="p-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {parsedResult.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-800/40">
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                              className="w-full bg-zinc-800/80 px-2 py-1 rounded text-zinc-200 text-xs border border-transparent focus:border-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="any"
                              value={item.qty}
                              onChange={(e) =>
                                handleUpdateItem(idx, 'qty', parseFloat(e.target.value) || 0)
                              }
                              className="w-full bg-zinc-800/80 px-2 py-1 rounded text-zinc-200 text-xs font-mono text-center border border-transparent focus:border-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={item.unit}
                              onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                              className="w-full bg-zinc-800/80 px-1 py-1 rounded text-zinc-200 text-[11px] border border-transparent focus:border-amber-500 focus:outline-none"
                            >
                              <option value="Batang">Batang</option>
                              <option value="Lembar">Lembar</option>
                              <option value="Kotak (5kg)">Kotak (5kg)</option>
                              <option value="Kotak (25 pcs)">Kotak (25 pcs)</option>
                              <option value="Kaleng (5kg)">Kaleng (5kg)</option>
                              <option value="Tabung">Tabung</option>
                              <option value="Pcs">Pcs</option>
                              <option value="Roll">Roll</option>
                              <option value="Kg">Kg</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleUpdateItem(idx, 'unitPrice', parseInt(e.target.value, 10) || 0)
                              }
                              className="w-full bg-zinc-800/80 px-2 py-1 rounded text-zinc-200 text-xs font-mono text-right border border-transparent focus:border-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="p-2 font-mono font-bold text-amber-400 text-right">
                            {formatIDR(item.totalPrice)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-zinc-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-2.5 border-t border-zinc-800 bg-zinc-900/90 flex flex-wrap justify-between items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddNewItemRow}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 hover:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all border border-zinc-700/60"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>+ Tambah Baris Barang</span>
                  </button>
                  <span className="text-xs text-zinc-400">
                    Total {parsedResult.items.length} item :{' '}
                    <strong className="text-amber-400 font-mono text-sm ml-1">
                      {formatIDR(parsedResult.totalAmount)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* ALLOCATION TARGET (GUDANG OR PROYEK) */}
              <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <span className="text-xs font-bold text-white block">
                  Tujuan Alokasi Barang Nota Ini:
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDestination('GUDANG')}
                    className={`py-2.5 px-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                      destination === 'GUDANG'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Package className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold">Masuk Stok Gudang</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        Stok bertambah & dicatat di kartu stok bengkel
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDestination('PROYEK')}
                    className={`py-2.5 px-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                      destination === 'PROYEK'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                        : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Layers className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold">Bahan Terpakai Proyek</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        Langsung dibebankan ke biaya proyek tertentu
                      </div>
                    </div>
                  </button>
                </div>

                {/* Project Selector if destination is PROYEK */}
                {destination === 'PROYEK' && (
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-300">
                        Pilih Proyek Penerima Bahan *
                      </label>
                      {parsedResult.customerOrProject && !targetProjectId && (
                        <button
                          type="button"
                          onClick={handleCreateProjectFromReceipt}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline"
                        >
                          + Buat "{parsedResult.customerOrProject}"
                        </button>
                      )}
                    </div>
                    <select
                      value={targetProjectId}
                      onChange={(e) => setTargetProjectId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                      required
                    >
                      <option value="">-- Pilih Proyek Bengkel --</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.clientName})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Action Commit Button */}
                <button
                  type="button"
                  onClick={handleCommitAllocation}
                  disabled={destination === 'PROYEK' && !targetProjectId}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-xs sm:text-sm tracking-wide shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {destination === 'GUDANG'
                      ? `Simpan Nota & Masukkan ${parsedResult.items.length} Barang ke Gudang`
                      : targetProjectId
                      ? `Simpan & Alokasikan ${parsedResult.items.length} Bahan ke Proyek: ${
                          projects.find((p) => p.id === targetProjectId)?.name || ''
                        }`
                      : 'Pilih Proyek untuk Menyimpan Bahan'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-[#16181e] rounded-2xl border border-zinc-800 flex flex-col items-center justify-center min-h-[300px]">
              <FileText className="w-12 h-12 text-zinc-600 mb-2" />
              <h4 className="font-bold text-zinc-300 text-sm">Belum Ada Hasil Pindaian</h4>
              <p className="text-xs text-zinc-500 max-w-sm mt-1">
                Silakan foto atau pilih struk di panel sebelah kiri, lalu klik tombol Pindai dengan AI Gemini.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SAVED RECEIPTS HISTORY (WITH PHOTO PREVIEW & ARCHIVE CONTROLS) */}
      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <h3 className="font-industrial text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>Riwayat Nota & Arsip Foto Struk</span>
            </h3>
            <span className="text-xs text-zinc-400 font-mono px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700">
              {receipts.length} Nota Tersimpan
            </span>
          </div>

          {receipts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setConfirmDialog({
                  isOpen: true,
                  title: 'Hapus Semua Arsip Nota & Foto Struk',
                  message: `Yakin ingin menghapus seluruh ${receipts.length} arsip riwayat nota belanja dan foto struk?`,
                  subMessage:
                    'Tindakan ini akan mengosongkan seluruh riwayat arsip nota dari sistem. Catatan stok dan kas yang sudah diproses sebelumnya tidak akan terhapus.',
                  confirmLabel: 'Ya, Kosongkan Semua Arsip',
                  onConfirm: () => {
                    clearAllReceipts();
                    showToast('Seluruh arsip riwayat nota dan foto struk berhasil dikosongkan.');
                  },
                });
              }}
              className="py-1.5 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Hapus / Kosongkan Seluruh Arsip Riwayat Nota"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua Arsip</span>
            </button>
          )}
        </div>

        {receipts.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="Cari nama toko, proyek, atau barang di arsip nota..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#16181e] border border-zinc-800 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              {historySearchQuery && (
                <button
                  type="button"
                  onClick={() => setHistorySearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setHistoryFilterAlloc('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  historyFilterAlloc === 'ALL'
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-bold'
                    : 'bg-[#16181e] text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                Semua ({receipts.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilterAlloc('GUDANG')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  historyFilterAlloc === 'GUDANG'
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-bold'
                    : 'bg-[#16181e] text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                Ke Gudang ({receipts.filter((r) => r.allocatedTo === 'GUDANG').length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilterAlloc('PROYEK')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  historyFilterAlloc === 'PROYEK'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-bold'
                    : 'bg-[#16181e] text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                Ke Proyek ({receipts.filter((r) => r.allocatedTo === 'PROYEK').length})
              </button>
            </div>
          </div>
        )}

        {receipts.length === 0 ? (
          <div className="p-8 text-center bg-[#16181e] rounded-2xl border border-dashed border-zinc-800 text-zinc-500 text-xs">
            Belum ada arsip nota yang tersimpan.
          </div>
        ) : (
          (() => {
            const filteredReceipts = receipts.filter((rcp) => {
              const q = historySearchQuery.toLowerCase();
              const matchSearch =
                !q ||
                rcp.storeName.toLowerCase().includes(q) ||
                (rcp.targetProjectName && rcp.targetProjectName.toLowerCase().includes(q)) ||
                (rcp.receiptNumber && rcp.receiptNumber.toLowerCase().includes(q)) ||
                rcp.items.some((i) => i.name.toLowerCase().includes(q));

              if (!matchSearch) return false;
              if (historyFilterAlloc === 'ALL') return true;
              return rcp.allocatedTo === historyFilterAlloc;
            });

            if (filteredReceipts.length === 0) {
              return (
                <div className="p-6 text-center bg-[#16181e] rounded-2xl border border-zinc-800 text-zinc-500 text-xs">
                  Tidak ditemukan nota dengan filter atau pencarian "{historySearchQuery}".
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredReceipts.map((rcp) => (
                  <div
                    key={rcp.id}
                    onClick={() => setPreviewReceipt(rcp)}
                    className="p-3.5 rounded-2xl bg-[#16181e] hover:bg-[#1a1c24] border border-zinc-800 hover:border-amber-500/50 cursor-pointer transition-all flex gap-3 group relative"
                  >
                    {/* Photo Thumbnail */}
                    <div className="w-20 h-24 rounded-xl bg-zinc-900 border border-zinc-700/80 overflow-hidden shrink-0 relative flex items-center justify-center">
                      {rcp.photoUrl ? (
                        <img
                          src={rcp.photoUrl}
                          alt={rcp.storeName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-zinc-600" />
                      )}
                      <div className="absolute inset-0 bg-black/30 hover:bg-transparent transition-colors flex items-center justify-center">
                        <Eye className="w-4 h-4 text-white opacity-80" />
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                              rcp.allocatedTo === 'GUDANG'
                                ? 'bg-amber-950 text-amber-300 border-amber-800'
                                : 'bg-blue-950 text-blue-300 border-blue-800'
                            }`}
                          >
                            {rcp.allocatedTo === 'GUDANG' ? 'Ke Gudang' : 'Ke Proyek'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {formatDate(rcp.date)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDialog({
                                  isOpen: true,
                                  title: 'Hapus Arsip Nota',
                                  message: `Yakin ingin menghapus arsip nota "${rcp.storeName}" (${formatIDR(rcp.totalAmount)})?`,
                                  subMessage:
                                    'Foto struk dan rincian belanja nota ini akan dihapus dari riwayat arsip.',
                                  confirmLabel: 'Ya, Hapus Nota',
                                  onConfirm: () => {
                                    deleteReceipt(rcp.id);
                                    showToast(`Arsip nota "${rcp.storeName}" berhasil dihapus.`);
                                  },
                                });
                              }}
                              className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Hapus Nota Ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="font-bold text-white text-xs mt-1 line-clamp-1">
                          {rcp.storeName}
                        </h4>

                        {rcp.targetProjectName && (
                          <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                            Proyek: {rcp.targetProjectName}
                          </p>
                        )}

                        <p className="text-[10px] text-zinc-500 mt-1">
                          {rcp.items.length} macam barang
                        </p>
                      </div>

                      <div className="font-bold text-amber-400 font-mono-num text-xs mt-1">
                        {formatIDR(rcp.totalAmount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </div>

      {/* RECEIPT PREVIEW MODAL */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#16181e] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden my-4 max-h-[90vh] flex flex-col">
            <div className="p-4 bg-[#1a1c24] border-b border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-amber-400 font-bold">
                  {formatDate(previewReceipt.date)}
                </span>
                <h3 className="font-industrial text-lg font-bold text-white">
                  Arsip Nota: {previewReceipt.storeName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const targetReceipt = previewReceipt;
                    setPreviewReceipt(null);
                    setConfirmDialog({
                      isOpen: true,
                      title: 'Hapus Arsip Nota',
                      message: `Yakin ingin menghapus arsip nota "${targetReceipt.storeName}" (${formatIDR(targetReceipt.totalAmount)})?`,
                      subMessage:
                        'Foto struk dan rincian belanja nota ini akan dihapus permanen dari riwayat arsip.',
                      confirmLabel: 'Ya, Hapus Nota',
                      onConfirm: () => {
                        deleteReceipt(targetReceipt.id);
                        showToast(`Arsip nota "${targetReceipt.storeName}" berhasil dihapus.`);
                      },
                    });
                  }}
                  className="py-1 px-2.5 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 text-red-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Hapus Nota Ini Dari Arsip"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Nota</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewReceipt(null)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Photo Display */}
              {previewReceipt.photoUrl && (
                <div className="max-h-64 rounded-xl overflow-hidden bg-black flex items-center justify-center border border-zinc-700">
                  <img
                    src={previewReceipt.photoUrl}
                    alt={previewReceipt.storeName}
                    className="max-h-64 object-contain"
                  />
                </div>
              )}

              {/* Items Table */}
              <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900 text-zinc-400 font-semibold border-b border-zinc-800">
                    <tr>
                      <th className="p-2">Nama Barang</th>
                      <th className="p-2">Qty</th>
                      <th className="p-2 text-right">Harga</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {previewReceipt.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/30">
                        <td className="p-2 text-zinc-200 font-medium">{it.name}</td>
                        <td className="p-2 font-mono text-zinc-400">
                          {it.qty} {it.unit}
                        </td>
                        <td className="p-2 font-mono text-zinc-400 text-right">
                          {formatIDR(it.unitPrice)}
                        </td>
                        <td className="p-2 font-mono font-bold text-amber-400 text-right">
                          {formatIDR(it.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-zinc-900 border-t border-zinc-800 font-bold">
                    <tr>
                      <td colSpan={3} className="p-2 text-zinc-300">
                        TOTAL PEMBELIAN
                      </td>
                      <td className="p-2 text-right text-amber-400 font-mono-num text-sm">
                        {formatIDR(previewReceipt.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        subMessage={confirmDialog.subMessage}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

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
