import Tesseract from 'tesseract.js';

export interface ScannedItem {
  name: string;
  category: 'material' | 'consumable' | 'lainnya';
  quantity: number;
  qty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface ScannedReceiptResult {
  storeName: string;
  date: string;
  receiptNumber: string;
  customerOrProject: string;
  paymentStatus: string;
  totalAmount: number;
  notes?: string;
  items: ScannedItem[];
  scanSource?: 'ocr' | 'gemini' | 'manual';
  rawOcrText?: string;
}

export async function runTesseractOcr(imageBuffer: Buffer): Promise<ScannedReceiptResult> {
  console.log('[OCR-Engine] Menjalankan OCR Tesseract lokal...');
  const t0 = Date.now();
  const { data } = await Tesseract.recognize(imageBuffer, 'ind+eng');
  const elapsed = Date.now() - t0;
  console.log(`[OCR-Engine] Pembacaan OCR selesai dalam ${elapsed}ms. Karakter terbaca: ${data.text.length}`);

  const parsed = parseReceiptText(data.text);
  parsed.scanSource = 'ocr';
  parsed.rawOcrText = data.text;
  return parsed;
}

export function parseReceiptText(rawText: string): ScannedReceiptResult {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let storeName = 'Toko Material / Besi';
  let date = new Date().toISOString().split('T')[0];
  let receiptNumber = '';
  let customerOrProject = '';
  let paymentStatus = 'BELUM_BAYAR';
  let totalAmount = 0;
  const items: ScannedItem[] = [];

  // 1. Identify Store Name from top lines
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const l = lines[i];
    if (
      /TB\.?|TOKO|CV\.?|PT\.?|UD\.?|BENGKEL|STEEL|LOGAM|JAYA|ABADI|BESI|BAJA|ALUMUNIUM/i.test(l)
    ) {
      storeName = l.replace(/^[^a-zA-Z0-9]+/, '').trim();
      break;
    }
  }

  // 2. Identify Metadata (Date, Receipt No, Customer, Status, Total)
  for (const line of lines) {
    // Receipt Number
    const rxMatch = line.match(
      /(?:No\.?\s*(?:Nota|Faktur|TRX|INV|Bon)?|Nota|TRX|INV|Faktur)[\s:]*([A-Za-z0-9\/-]{2,20})/i
    );
    if (rxMatch && !receiptNumber && !/^(?:hp|telp|wa)$/i.test(rxMatch[1])) {
      receiptNumber = rxMatch[1];
    }

    // Customer or Project name
    const custMatch = line.match(
      /(?:Pelanggan|Customer|Proyek|Nama|Yth|Kepada|Lokasi)[\s:]+([A-Za-z0-9\s&.\/-]{3,40})/i
    );
    if (custMatch && !customerOrProject) {
      customerOrProject = custMatch[1].trim();
    } else if (!customerOrProject) {
      const prjMatch = line.match(
        /\b(?:MTSN|SMAN|SMPN|SDN|MASJID|MUSHOLA|RUMAH|KANTOR|KAMPUS|KANOPI|PAGAR)\b\s+([A-Za-z0-9\s&.\/-]{3,35})/i
      );
      if (prjMatch) {
        customerOrProject = prjMatch[0].trim();
      }
    }

    // Date
    const dateMatch = line.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (dateMatch) {
      let [, d, m, y] = dateMatch;
      if (y.length === 2) y = '20' + y;
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Payment Status
    if (/(?:LUNAS|PAID|SUDAH BAYAR)/i.test(line) && !/BELUM/i.test(line)) {
      paymentStatus = 'LUNAS';
    }

    // Total Amount line
    const totalMatch = line.match(
      /(?:TOTAL|JUMLAH|HARGA TOTAL|GRAND TOTAL)[\s:]*(?:Rp\.?|\b)?\s*([\d.,]{3,18})/i
    );
    if (totalMatch) {
      const num = parseInt(totalMatch[1].replace(/[^\d]/g, ''), 10);
      if (num > 0) totalAmount = num;
    }
  }

  // Helper to check if string is merely formula/unit multiplication e.g. "bijix12.000", "2 btg x 85.000"
  const isFormulaOnly = (str: string) => {
    const cleaned = str.replace(/\s+/g, '').toLowerCase();
    return (
      /^(?:\d+)?(?:biji|btg|batang|pcs|bh|buah|klg|lbr|meter|m|ktk|sak|kg)?x[\d.,]+$/i.test(cleaned) ||
      /^@[\d.,]+$/.test(cleaned) ||
      /^[\d.,]+(?:\/|\s*per\s*)(?:biji|btg|pcs|bh|lbr|klg)$/i.test(cleaned)
    );
  };

  // 3. Parse Item Lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip headers, metadata and summary lines
    if (
      /(?:TOTAL|SUBTOTAL|TUNAI|KEMBALI|TERIMA KASIH|ANTRIAN|TANGGAL|NO NOTA|KASIR|METODE|STATUS|SPARE PART|BAHAN)/i.test(
        line
      )
    ) {
      continue;
    }

    // Skip if line is the project/customer name itself (e.g. MTSN PEUREULAK)
    if (customerOrProject && line.toLowerCase().includes(customerOrProject.toLowerCase())) {
      continue;
    }

    // Check if line contains a price at the end: e.g. '350.000' or '84.000' or '1.200.000'
    const priceMatch = line.match(/([\d]{1,3}(?:[.,]\d{3})+|\b\d{4,9}\b)\s*$/i);
    if (!priceMatch) continue;

    const rawPrice = priceMatch[1].replace(/[^\d]/g, '');
    const priceNum = parseInt(rawPrice, 10);
    if (isNaN(priceNum) || priceNum < 500) continue;

    let desc = line.slice(0, line.lastIndexOf(priceMatch[1])).trim();
    // remove leading numbering: "1.", "2)", etc.
    desc = desc.replace(/^\d+[\.\)\-\s]+/, '').trim();
    if (!desc || desc.length < 2) continue;

    let qty = 1;
    let unit = 'Pcs';

    // Check for inline multiplication formula: e.g. "10 biji x 12.000", "2 btg x 85.000", "bijix12.000"
    const formulaMatch = desc.match(
      /(?:(\d+(?:[.,]\d+)?)\s*)?(btg|batang|biji|pcs|bh|buah|klg|kaleng|ltr|liter|lbr|lembar|ktk|box|kotak|porsi|roll|sak|m|meter)?\s*x\s*([\d.,]+)/i
    );
    if (formulaMatch) {
      if (formulaMatch[1]) {
        qty = parseFloat(formulaMatch[1].replace(',', '.')) || 1;
      }
      if (formulaMatch[2]) {
        unit = normalizeUnit(formulaMatch[2].toLowerCase());
      }
      desc = desc.replace(formulaMatch[0], '').trim();
    }

    // Look for parenthesized quantity & unit: e.g. (2 btg), (4 biji), (1 klg), (2 lbr)
    const parenMatch = desc.match(
      /\(\s*(\d+(?:[.,]\d+)?)\s*(btg|batang|biji|pcs|bh|buah|klg|kaleng|ltr|liter|lbr|lembar|ktk|box|kotak|porsi|roll|sak|m|meter)?\s*\)/i
    );

    if (parenMatch) {
      qty = parseFloat(parenMatch[1].replace(',', '.')) || 1;
      const rawUnit = (parenMatch[2] || '').toLowerCase();
      unit = normalizeUnit(rawUnit);
      desc = desc.replace(parenMatch[0], '').trim();
    } else {
      // Or end-of-description quantity & unit: e.g. "2 btg", "5 pcs", "1 klg"
      const endQtyMatch = desc.match(
        /\b(\d+(?:[.,]\d+)?)\s*(btg|batang|biji|pcs|bh|buah|klg|kaleng|ltr|liter|lbr|lembar|ktk|box|kotak|porsi|roll|sak|m|meter)\b$/i
      );
      if (endQtyMatch) {
        qty = parseFloat(endQtyMatch[1].replace(',', '.')) || 1;
        const rawUnit = (endQtyMatch[2] || '').toLowerCase();
        unit = normalizeUnit(rawUnit);
        desc = desc.slice(0, desc.lastIndexOf(endQtyMatch[0])).trim();
      }
    }

    // If description became empty or was purely formula (e.g. "bijix12.000"), look at the previous line for actual item name!
    if (!desc || isFormulaOnly(desc)) {
      if (i > 0) {
        const prevLine = lines[i - 1].trim();
        // Ensure previous line isn't a header or total
        if (
          prevLine.length > 2 &&
          !/(?:TOTAL|SUBTOTAL|TUNAI|TANGGAL|NOTA|PELANGGAN|KASIR|CV\.|TB\.|TOKO)/i.test(prevLine) &&
          (!customerOrProject || !prevLine.toLowerCase().includes(customerOrProject.toLowerCase()))
        ) {
          desc = prevLine.replace(/^\d+[\.\)\-\s]+/, '').trim();
        }
      }
    }

    // Clean up residual punctuation or @ markers
    desc = desc.replace(/^[@x\-\s]+|[@x\-\s]+$/g, '').trim();
    if (!desc || isFormulaOnly(desc)) {
      desc = 'Material Las';
    }

    // Determine category
    const category = categorizeItem(desc);
    const unitPrice = qty > 0 ? Math.round(priceNum / qty) : priceNum;

    items.push({
      name: desc.replace(/[()]/g, '').trim() || 'Material Las',
      category,
      quantity: qty,
      qty,
      unit,
      unitPrice,
      totalPrice: priceNum,
    });
  }

  // If totalAmount was not found in summary line, calculate sum of items
  if (!totalAmount && items.length > 0) {
    totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  return {
    storeName,
    date,
    receiptNumber,
    customerOrProject,
    paymentStatus,
    totalAmount,
    items,
    scanSource: 'ocr',
  };
}

function normalizeUnit(raw: string): string {
  if (/btg|batang/.test(raw)) return 'Batang';
  if (/klg|kaleng/.test(raw)) return 'Kaleng (5kg)';
  if (/ltr|liter/.test(raw)) return 'Liter';
  if (/lbr|lembar/.test(raw)) return 'Lembar';
  if (/ktk|box|kotak/.test(raw)) return 'Kotak';
  if (/porsi/.test(raw)) return 'Porsi';
  if (/roll/.test(raw)) return 'Roll';
  if (/sak/.test(raw)) return 'Sak';
  if (/m|meter/.test(raw)) return 'Meter';
  return 'Pcs';
}

function categorizeItem(name: string): 'material' | 'consumable' | 'lainnya' {
  const lower = name.toLowerCase();
  if (/makan|minum|kopi|nasi|konsumsi|snack/i.test(lower)) {
    return 'lainnya';
  }
  if (
    /kawat|gerinda|batu|amplas|cat|thinner|minyak|epoxy|gas|baut|mur|sekrup|mata|kuas|sarung|engsel|grendel|slot|roda|kuas|silicone|lem|semen/i.test(
      lower
    )
  ) {
    return 'consumable';
  }
  return 'material';
}
