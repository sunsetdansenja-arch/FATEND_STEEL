import { InventoryItem } from '../types';

/**
 * Normalizes item names for welding/metal workshop inventory matching
 */
export function normalizeWorkshopName(text: string): string {
  if (!text) return '';
  let str = text.toLowerCase();

  // Normalize dimension formats common in Indonesian receipts:
  // e.g. 4x4 or 4 x 4 -> 40x40
  str = str.replace(/\b4\s*[xX*]\s*4\b/g, '40x40');
  str = str.replace(/\b4\s*[xX*]\s*2\b/g, '40x20');
  str = str.replace(/\b2\s*[xX*]\s*4\b/g, '40x20');
  str = str.replace(/\b3\s*[xX*]\s*3\b/g, '30x30');
  str = str.replace(/\b5\s*[xX*]\s*5\b/g, '50x50');
  str = str.replace(/\b15\s*[xX*]\s*15\b/g, '15x15');
  str = str.replace(/\b1[.,]5\s*(?:inch|in|")?/g, '1.5 inch');
  str = str.replace(/\brd[\s-]*260\b/g, 'rd-260');

  // Replace symbols with space
  str = str.replace(/[^a-z0-9.]/g, ' ');
  // Collapse whitespace
  str = str.replace(/\s+/g, ' ').trim();

  return str;
}

/**
 * Finds the most matching existing inventory item for a scanned receipt item
 */
export function matchScannedItemToInventory(
  scannedName: string,
  inventory: InventoryItem[]
): { item: InventoryItem; score: number; reason: string } | null {
  if (!scannedName || !inventory || inventory.length === 0) return null;

  const rawScanned = scannedName.toLowerCase().trim();
  const normScanned = normalizeWorkshopName(scannedName);
  const scannedWords = normScanned.split(' ').filter((w) => w.length > 1);

  let bestMatch: InventoryItem | null = null;
  let highestScore = 0;
  let matchReason = '';

  for (const inv of inventory) {
    const rawInv = inv.name.toLowerCase().trim();
    const normInv = normalizeWorkshopName(inv.name);
    const invWords = normInv.split(' ').filter((w) => w.length > 1);

    // 1. Exact string match
    if (rawInv === rawScanned || normInv === normScanned) {
      return { item: inv, score: 100, reason: 'Nama persis sama' };
    }

    let currentScore = 0;

    // Substring inclusion
    if (normInv.includes(normScanned) || normScanned.includes(normInv)) {
      currentScore += 60;
    }

    // Specific domain rules
    const isScannedHollow = normScanned.includes('hollow');
    const isInvHollow = normInv.includes('hollow');
    const isScannedSiku = normScanned.includes('siku');
    const isInvSiku = normInv.includes('siku');
    const isScannedPipa = normScanned.includes('pipa');
    const isInvPipa = normInv.includes('pipa');
    const isScannedPlat = normScanned.includes('plat');
    const isInvPlat = normInv.includes('plat');
    const isScannedLas = normScanned.includes('kawat') || normScanned.includes('las') || normScanned.includes('rd-260');
    const isInvLas = normInv.includes('kawat') || normInv.includes('las') || normInv.includes('rd-260');
    const isScannedGerinda = normScanned.includes('gerinda') || normScanned.includes('gosok') || normScanned.includes('wd') || normScanned.includes('potong');
    const isInvGerinda = normInv.includes('gerinda') || normInv.includes('gosok') || normInv.includes('wd') || normInv.includes('potong');
    const isScannedCat = normScanned.includes('cat') || normScanned.includes('epoxy') || normScanned.includes('seiv');
    const isInvCat = normInv.includes('cat') || normInv.includes('epoxy') || normInv.includes('seiv');
    const isScannedThinner = normScanned.includes('thinner') || normScanned.includes('minyak');
    const isInvThinner = normInv.includes('thinner') || normInv.includes('minyak');

    // Dimension check (40x40, 40x20, etc.)
    const dimensions = ['40x40', '40x20', '30x30', '50x50', '15x15', '1.5 inch', '2mm', '0.8', '1.4', '1.2'];
    let dimensionMatched = false;
    for (const dim of dimensions) {
      if (normScanned.includes(dim) && normInv.includes(dim)) {
        currentScore += 35;
        dimensionMatched = true;
        break;
      }
    }

    if (isScannedHollow && isInvHollow) {
      currentScore += 35;
      if (dimensionMatched) currentScore += 20;
    }
    if (isScannedSiku && isInvSiku) {
      currentScore += 35;
      if (dimensionMatched) currentScore += 20;
    }
    if (isScannedPipa && isInvPipa) currentScore += 35;
    if (isScannedPlat && isInvPlat) currentScore += 35;
    if (isScannedLas && isInvLas) currentScore += 45;
    if (isScannedGerinda && isInvGerinda) currentScore += 45;
    if (isScannedCat && isInvCat) currentScore += 40;
    if (isScannedThinner && isInvThinner) currentScore += 45;

    // Overlapping words
    for (const sw of scannedWords) {
      if (invWords.includes(sw)) {
        currentScore += 10;
      }
    }

    if (currentScore > highestScore) {
      highestScore = currentScore;
      bestMatch = inv;
      matchReason = dimensionMatched
        ? `Cocok jenis & ukuran (${inv.name})`
        : `Kemiripan nama (${inv.name})`;
    }
  }

  // Minimum threshold to be considered a valid match
  if (highestScore >= 40 && bestMatch) {
    return { item: bestMatch, score: highestScore, reason: matchReason };
  }

  return null;
}
