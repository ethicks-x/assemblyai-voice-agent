import { db, TruckInventoryPart } from '../data/mockDb.js';

export interface PartRequestItem {
  part_name: string;
  quantity?: number;
}

export interface CheckInventoryParams {
  parts_used: PartRequestItem[];
}

export interface MatchedPartDetail {
  requestedName: string;
  matchedSku: string;
  officialName: string;
  quantityRequested: number;
  inStock: boolean;
  truckStockRemaining: number;
  retailUnitPrice: number;
  totalPrice: number;
  matchConfidence: number;
  reorderWarning?: string;
}

export interface CheckInventoryResult {
  allFound: boolean;
  parts: MatchedPartDetail[];
  totalPartsAmount: number;
  spokenSummary: string;
}

export async function checkTruckInventory(params: CheckInventoryParams): Promise<CheckInventoryResult> {
  const parts: MatchedPartDetail[] = [];
  let allFound = true;
  let totalPartsAmount = 0;
  const spokenPartsDesc: string[] = [];

  for (const item of params.parts_used) {
    const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
    const part = db.findPartByQuery(item.part_name);

    if (part) {
      const lineTotal = part.retailPrice * qty;
      totalPartsAmount += lineTotal;
      const inStock = part.truckStock >= qty;

      // Compute match confidence based on match tier
      const q = item.part_name.trim().toLowerCase();
      let matchConfidence = 0.82; // alias baseline
      if (part.sku.toLowerCase() === q) {
        matchConfidence = 1.0; // exact SKU
      } else if (part.name.toLowerCase().includes(q)) {
        matchConfidence = 0.95; // name substring
      } else {
        // Alias match — score by word overlap between query and best alias
        let bestScore = 0.82;
        const queryWords = q.split(/\s+/);
        for (const alias of part.aliases) {
          const aliasWords = alias.split(/\s+/);
          const overlap = queryWords.filter((w) => aliasWords.some((a) => a.includes(w) || w.includes(a))).length;
          const score = 0.82 + 0.12 * (overlap / Math.max(queryWords.length, 1));
          if (score > bestScore) bestScore = score;
        }
        matchConfidence = Math.round(bestScore * 1000) / 1000;
      }

      let reorderWarning: string | undefined;
      if (part.truckStock - qty <= part.minStockThreshold) {
        reorderWarning = `Truck bin stock low (${part.truckStock - qty} remaining after this job). Restock needed.`;
      }

      parts.push({
        requestedName: item.part_name,
        matchedSku: part.sku,
        officialName: part.name,
        quantityRequested: qty,
        inStock,
        truckStockRemaining: part.truckStock,
        retailUnitPrice: part.retailPrice,
        totalPrice: lineTotal,
        matchConfidence,
        reorderWarning,
      });

      spokenPartsDesc.push(`${qty} ${part.name} at $${part.retailPrice.toFixed(2)} each`);
    } else {
      allFound = false;
      // Fallback for custom or uncatalogued part
      const estimatedPrice = 65.0 * qty;
      totalPartsAmount += estimatedPrice;
      parts.push({
        requestedName: item.part_name,
        matchedSku: 'CUSTOM-PART-01',
        officialName: item.part_name,
        quantityRequested: qty,
        inStock: true,
        truckStockRemaining: 99,
        retailUnitPrice: 65.0,
        totalPrice: estimatedPrice,
        matchConfidence: 0.0,
        reorderWarning: 'Custom non-catalog part billed at standard technician allowance.',
      });

      spokenPartsDesc.push(`${qty} ${item.part_name} (custom catalog allowance at $65.00)`);
    }
  }

  const spokenSummary = `Checked truck inventory: Found ${parts.length} items. Total parts cost is $${totalPartsAmount.toFixed(2)}. ${spokenPartsDesc.join('; ')}.`;

  return {
    allFound,
    parts,
    totalPartsAmount,
    spokenSummary,
  };
}
