import { db, CatalogItem } from '../data/mockDb.js';

export interface ManageCatalogParams {
  name: string;
  base_price: number;
  gst_rate?: number;
  hsn_code?: string;
  category?: string;
  stock?: number;
  aliases?: string[];
  sku?: string;
  unit?: string;
}

export interface ManageCatalogResult {
  success: boolean;
  item: CatalogItem;
  summaryMessage: string;
}

/**
 * Tool for shopkeepers and technicians to add or update catalog items verbally or programmatically.
 */
export async function addOrUpdateCatalogItem(params: ManageCatalogParams): Promise<ManageCatalogResult> {
  const profile = db.getActiveProfile();
  const currencySym = profile.currencySymbol || '₹';

  // Determine standard HSN code if not explicitly provided
  let hsn = params.hsn_code;
  if (!hsn) {
    const lowerName = params.name.toLowerCase();
    if (lowerName.includes('courier') || lowerName.includes('cargo') || lowerName.includes('shipping')) {
      hsn = '9968';
    } else if (lowerName.includes('assembly') || lowerName.includes('service') || lowerName.includes('repair') || lowerName.includes('labor')) {
      hsn = '9954';
    } else if (lowerName.includes('shirt') || lowerName.includes('pant') || lowerName.includes('garment')) {
      hsn = '6109';
    } else if (lowerName.includes('book') || lowerName.includes('handbook')) {
      hsn = '4901';
    } else {
      hsn = '8471'; // Default IT / Computer components
    }
  }

  // Generate clean SKU if not provided
  let sku = params.sku;
  if (!sku) {
    const slug = params.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 14);
    sku = `CAT-${slug}-${Date.now().toString().slice(-4)}`;
  }

  // Default aliases from words in name
  const aliases = params.aliases && params.aliases.length > 0
    ? params.aliases
    : [params.name.toLowerCase(), params.name.toLowerCase().replace(/[^a-z0-9 ]/g, '')];

  const savedItem = db.addOrUpdateCatalogItem({
    sku,
    name: params.name,
    category: params.category || 'General',
    aliases,
    hsnCode: hsn,
    basePrice: params.base_price,
    gstRate: typeof params.gst_rate === 'number' ? params.gst_rate : 0.18,
    stock: typeof params.stock === 'number' ? params.stock : 10,
    minStockThreshold: 2,
    unit: params.unit || 'pcs',
  });

  const gstPct = (savedItem.gstRate * 100).toFixed(0);
  const summaryMessage = `Catalog updated: Added "${savedItem.name}" (SKU: ${savedItem.sku}) at ${currencySym}${savedItem.basePrice.toLocaleString('en-IN')} + ${gstPct}% GST (HSN: ${savedItem.hsnCode}). Current stock: ${savedItem.stock} ${savedItem.unit}.`;

  return {
    success: true,
    item: savedItem,
    summaryMessage,
  };
}
