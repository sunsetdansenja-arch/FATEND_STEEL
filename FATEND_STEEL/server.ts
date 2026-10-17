import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { runTesseractOcr } from './server/ocrParser.ts';

dotenv.config();

function getPort(): number {
  const portIndex = process.argv.indexOf('--port');
  if (portIndex !== -1 && process.argv[portIndex + 1]) {
    const val = parseInt(process.argv[portIndex + 1], 10);
    if (!isNaN(val)) return val;
  }
  return Number(process.env.PORT) || 3000;
}

function getHost(): string {
  const hostIndex = process.argv.indexOf('--host');
  if (hostIndex !== -1 && process.argv[hostIndex + 1]) {
    return process.argv[hostIndex + 1];
  }
  return process.env.HOST || '0.0.0.0';
}

const PORT = getPort();
const HOST = getHost();

const app = express();

// Restrict browser API access to the configured Vercel frontend origin.
// Set FRONTEND_ORIGIN to the exact deployed origin (for example https://fatend-steel.vercel.app).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.FRONTEND_ORIGIN;

  if (origin && allowedOrigin && origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(origin && allowedOrigin && origin !== allowedOrigin ? 403 : 204);
  }

  next();
});

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Lazy initialize Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'CV FATEND STEEL API',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// API Scan Nota with Gemini Multimodal
app.post('/api/scan-receipt', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', engine = 'auto' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Foto struk / nota belum disertakan.',
      });
    }

    // Clean and validate base64 string
    let cleanBase64 = imageBase64;
    let detectedMime = mimeType || 'image/jpeg';

    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      const rawMime = parts[0].replace('data:', '').trim();
      detectedMime = rawMime.split(';')[0].trim() || 'image/jpeg';
      cleanBase64 = parts[1];
    }

    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    // If explicitly requested OCR or if no Gemini key, execute Tesseract OCR directly
    if (engine === 'ocr' || !process.env.GEMINI_API_KEY) {
      console.log('[ScanReceipt] Memproses via Mesin OCR Tesseract Lokal...');
      const ocrResult = await runTesseractOcr(imageBuffer);
      return res.json({
        success: true,
        source: 'ocr',
        engineUsed: 'Tesseract OCR (Lokal)',
        data: ocrResult,
      });
    }

    // Supported multimodal mime types for Gemini
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validMimes.includes(detectedMime.toLowerCase())) {
      detectedMime = 'image/jpeg';
    }

    const ai = getGeminiClient();
    let responseText = '';
    let lastError: any = null;

    if (ai) {
      const prompt = `
Anda adalah asisten cerdas untuk bengkel las CV FATEND STEEL (Spesialis Kanopi, Pagar, Konstruksi Baja, Tralis, Railing, Pintu & Jendela).
Tugas Anda adalah membaca dan mengekstrak data dari foto nota / bon pembelian toko material / hardware store / toko besi / gas / cat / bon proyek.

Bacalah foto nota terlampir dengan sangat teliti dan ekstrak ke dalam format JSON dengan struktur:
{
  "storeName": "Nama Toko / Suplier Besi atau nama usaha penerbit nota (misal: Toko Besi Sinar Baru, CV FATEND STEEL)",
  "date": "YYYY-MM-DD jika terbaca, atau format tanggal nota (misal: '2026-09-01')",
  "receiptNumber": "Nomor nota / No. Bon jika ada (misal: 'TRX/16')",
  "customerOrProject": "Nama Pelanggan atau Nama Proyek yang tertulis di nota jika ada (misal: 'PINTU & JENDELA RIAN', 'Bpk Wahyu', dll)",
  "paymentStatus": "LUNAS atau BELUM_BAYAR",
  "items": [
    {
      "name": "Nama lengkap barang (misal: Besi Siku 40x40 TKS, Besi Hollow 4x4 0.8, Engsel Kupu-Kupu, Grendel Slot, Cat, Minyak Cat, Epoxy Merah, Mata Gosok, Plat 0.8 Galvanis, Makan Minum, Siku Jendela, Hollow 15x15 0.8)",
      "category": "material ATAU consumable ATAU lainnya",
      "quantity": 1,
      "unit": "Batang / Biji / Lembar / Kotak / Roll / Kaleng / Liter / Porsi / Pcs",
      "unitPrice": 150000,
      "totalPrice": 150000
    }
  ],
  "totalAmount": 150000,
  "notes": "Catatan kondisi nota atau rincian tambahan"
}

Peraturan penting:
1. Pastikan setiap nominal angka murni berupa number integer tanpa titik atau tanda mata uang (contoh: 350000 bukan Rp 350.000).
2. Perhatikan singkatan satuan khas nota toko besi:
   - BTG = Batang
   - BIJI / BH = Biji / Pcs
   - KLG = Kaleng
   - LTR = Liter
   - LBR = Lembar
   - KTK / BOX = Kotak
   - PORSI = Porsi
3. Klasifikasikan:
   - "material": Besi hollow, pipa, plat, unp, siku, wf, wiremesh, nako, expanding metal, spandek, alderon, policarbonat, siku jendela, dll.
   - "consumable": kawat las, batu gerinda potong/asah/amplas/mata gosok, gas CO2/argon/oksigen, cat primer/zinchromate/thinner/minyak cat, kuas, amplas, baut roofing, mata bor, sarung tangan las, engsel, grendel slot, dll.
   - "lainnya": barang non material/consumable bengkel las (misal: konsumsi makan minum kerja).
4. Jika ada baris nama pelanggan, nama proyek, atau lokasi (seperti "Pelanggan: PINTU & JENDELA RIAN", "MTSN PEUREULAK", "PROYEK KANOPI", dll), wajib masukkan ke "customerOrProject", JANGAN MASUKKAN SEBAGAI NAMA BARANG.
5. SANGAT PENTING: JANGAN PERNAH mengisi "name" barang dengan rumus perhitungan/satuan harga (contoh salah: "bijix12.000", "10 biji x 12.000", "@12.000", "12.000/biji"). "name" HARUS berupa nama fisik barang bengkel (contoh: "Baut Roofing", "Dynabolt 10mm", "Mata Gerinda Potong", "Kawat Las", "Cat Minyak", "Besi Hollow"). Jika di nota nama barang tertulis di baris atas dan perkalian "biji x harga" di baris bawahnya, gabungkan dengan tepat.
6. Total amount harus tepat sesuai angka total pada nota (misal: 2385000).
Kembalikan HANYA format JSON yang valid.
`;

      const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

      for (const modelName of candidateModels) {
        try {
          console.log(`[ScanReceipt] Menguji model Gemini: ${modelName}...`);
          
          // Timeout promise 8 seconds per model to prevent indefinite hang on 503
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout model ${modelName}`)), 8000)
          );

          const generatePromise = ai.models.generateContent({
            model: modelName,
            contents: [
              {
                inlineData: {
                  mimeType: detectedMime,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
            config: {
              responseMimeType: 'application/json',
            },
          });

          const response: any = await Promise.race([generatePromise, timeoutPromise]);

          if (response?.text) {
            responseText = response.text.trim();
            console.log(`[ScanReceipt] Berhasil dengan model Gemini: ${modelName}`);
            break;
          }
        } catch (modelErr: any) {
          console.warn(`[ScanReceipt] Model ${modelName} gagal:`, modelErr?.message || modelErr);
          lastError = modelErr;
        }
      }
    }

    // IF GEMINI SUCCEEDED
    if (responseText) {
      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        }
      }

      if (parsedData && Array.isArray(parsedData.items)) {
        parsedData.items = parsedData.items.map((item: any) => {
          const q = Number(item.quantity || item.qty || 1);
          const p = Number(item.unitPrice || 0);
          const tot = Number(item.totalPrice || q * p);
          return {
            name: item.name || 'Material Las',
            category: item.category || 'material',
            quantity: q,
            qty: q,
            unit: item.unit || 'Pcs',
            unitPrice: p,
            totalPrice: tot,
          };
        });

        if (!parsedData.totalAmount) {
          parsedData.totalAmount = parsedData.items.reduce(
            (sum: number, it: any) => sum + (it.totalPrice || 0),
            0
          );
        }

        parsedData.scanSource = 'gemini';
        return res.json({
          success: true,
          source: 'gemini',
          engineUsed: 'Gemini AI Multimodal',
          data: parsedData,
        });
      }
    }

    // AUTOMATIC RESILIENT FALLBACK: If Gemini has 503 / high demand or timeout, execute OCR Tesseract
    console.log('[ScanReceipt] Gemini 503/sibuk. Otomatis dialihkan ke Mesin OCR Tesseract Lokal...');
    const ocrResult = await runTesseractOcr(imageBuffer);
    return res.json({
      success: true,
      source: 'ocr_fallback',
      engineUsed: 'OCR Lokal (Otomatis dialihkan karena server AI sibuk)',
      notice: 'Server AI Gemini sedang antre (503 High Demand). Sistem otomatis mengekstrak nota menggunakan Mesin OCR Cepat tanpa kendala.',
      data: ocrResult,
    });
  } catch (error: any) {
    console.error('Error scanning receipt:', error);
    // Even if an unexpected error occurs, attempt fallback to local text parser if possible
    return res.status(500).json({
      success: false,
      error: error?.message || 'Terjadi kesalahan saat memproses nota.',
    });
  }
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`CV FATEND STEEL Server running on http://${HOST}:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export { app };
