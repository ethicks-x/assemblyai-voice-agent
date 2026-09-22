import React, { useState } from 'react';
import { X, Search, Plus, Trash2, Package, Tag, Layers, CheckCircle2, AlertCircle, Mic } from 'lucide-react';

export interface CatalogItem {
  sku: string;
  name: string;
  category: string;
  aliases: string[];
  hsnCode: string;
  basePrice: number;
  gstRate: number;
  stock: number;
  minStockThreshold: number;
  unit: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  ownerName: string;
  businessType: string;
  region?: 'INDIA' | 'GLOBAL';
  businessCategory?: 'RETAIL_SHOP' | 'SERVICE_TRADE';
  tradeType?: string;
  gstin?: string;
  state: string;
  stateCode?: string;
  country?: string;
  currency?: string;
  currencySymbol: string;
  taxSystem: string;
  customTaxRate?: number;
  customTaxLabel?: string;
  upiId?: string;
  courierPartner?: string;
}

interface CatalogManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogItem[];
  activeProfile: BusinessProfile | null;
  onItemAdded: (item: Partial<CatalogItem> & { name: string; base_price?: number }) => Promise<void>;
  onItemDeleted: (sku: string) => Promise<void>;
}

export const CatalogManagerModal: React.FC<CatalogManagerModalProps> = ({
  isOpen,
  onClose,
  catalog,
  activeProfile,
  onItemAdded,
  onItemDeleted,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState('ALL');
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Processors');
  const [basePrice, setBasePrice] = useState('');
  const [gstRate, setGstRate] = useState('0.18');
  const [hsnCode, setHsnCode] = useState('8471');
  const [stock, setStock] = useState('10');
  const [unit, setUnit] = useState('pcs');

  if (!isOpen) return null;

  const currencySym = activeProfile?.currencySymbol || '₹';
  const isIndianGst = activeProfile?.taxSystem === 'GST_INDIA';

  const filteredItems = catalog.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.hsnCode.includes(q);

    if (!matchesSearch) return false;

    if (selectedCategoryTab === 'PC') {
      return ['Processors', 'Graphics Cards', 'Motherboards', 'Memory', 'Storage', 'Power Supplies', 'Cabinets', 'Services', 'Logistics'].includes(item.category);
    }
    if (selectedCategoryTab === 'PLUMBING') {
      return item.category === 'Plumbing' || item.sku.startsWith('PLUMB');
    }
    if (selectedCategoryTab === 'ELECTRICAL') {
      return item.category === 'Electrical' || item.sku.startsWith('ELEC');
    }
    if (selectedCategoryTab === 'HVAC') {
      return item.category === 'HVAC' || item.sku.startsWith('CAP') || item.sku.startsWith('CONT') || item.sku.startsWith('REF');
    }
    if (selectedCategoryTab === 'RETAIL') {
      return ['Apparel', 'Books', 'Garments'].includes(item.category);
    }
    return true;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !basePrice) return;

    setIsSubmitting(true);
    try {
      await onItemAdded({
        name: name.trim(),
        category,
        basePrice: parseFloat(basePrice),
        gstRate: parseFloat(gstRate),
        hsnCode: hsnCode.trim() || '8471',
        stock: parseInt(stock, 10) || 10,
        unit: unit.trim() || 'pcs',
      });
      // Reset form
      setName('');
      setBasePrice('');
      setStock('10');
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to add item:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Shop Inventory & Voice Catalog
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  GST & HSN Enabled
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {activeProfile ? `${activeProfile.name} • GSTIN: ${activeProfile.gstin || 'N/A'}` : 'Manage active shop items'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voice Tip Banner */}
        <div className="px-6 py-2.5 bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-slate-900 border-b border-sky-900/30 flex items-center gap-3 text-xs text-sky-300">
          <Mic className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            <strong>Voice Catalog Ready:</strong> Speak naturally while packing: <em>"Add Crucial 32GB DDR5 RAM for 9500 rupees, 18% GST, 5 pieces"</em> — FieldPilot extracts SKUs and stores them hands-free.
          </span>
        </div>

        {/* Search & Action Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by part name, SKU, category, or HSN code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAdding ? 'Close Form' : 'Add Item Manually'}</span>
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-6 py-2 border-b border-slate-800 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
          {[
            { id: 'ALL', label: 'All Items' },
            { id: 'PC', label: '🖥️ PC & Hardware' },
            { id: 'PLUMBING', label: '🚰 Plumbing & Sanitary' },
            { id: 'ELECTRICAL', label: '⚡ Electrical & Wiring' },
            { id: 'HVAC', label: '❄️ HVAC & Trades' },
            { id: 'RETAIL', label: '🛍️ Garments & Books' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategoryTab(tab.id)}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategoryTab === tab.id
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Add Item Form (Expandable) */}
        {isAdding && (
          <form onSubmit={handleAddSubmit} className="p-4 bg-slate-950/80 border-b border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs animate-fade-in">
            <div className="md:col-span-2">
              <label className="block text-slate-400 mb-1 font-medium">Item Name & Model *</label>
              <input
                type="text"
                required
                placeholder="e.g. Intel Core i5-13400F 10-Core Processor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="Processors">Processors (CPUs)</option>
                <option value="Graphics Cards">Graphics Cards (GPUs)</option>
                <option value="Motherboards">Motherboards</option>
                <option value="Memory">RAM / Memory</option>
                <option value="Storage">NVMe / SSD Storage</option>
                <option value="Power Supplies">Power Supplies (PSUs)</option>
                <option value="Cabinets">Chassis / Cabinets</option>
                <option value="Services">Assembly & Testing</option>
                <option value="Logistics">Courier Cargo</option>
                <option value="Apparel">Apparel & Garments</option>
                <option value="Books">Books & Media</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Base Price ({currencySym}) *</label>
              <input
                type="number"
                required
                min="0"
                step="any"
                placeholder="18500"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">GST Rate Slab</label>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="0.18">18% GST (Standard Tech/Parts)</option>
                <option value="0.12">12% GST</option>
                <option value="0.05">5% GST (Garments/Fabrics)</option>
                <option value="0.28">28% GST (Luxury Items)</option>
                <option value="0.00">0% GST (Exempt / Books)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">HSN / SAC Code</label>
              <input
                type="text"
                placeholder="8471"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Stock Qty & Unit</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-sky-500"
                />
                <input
                  type="text"
                  placeholder="pcs"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-1.5 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save to Shop Catalog'}
              </button>
            </div>
          </form>
        )}

        {/* Catalog Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Item Details</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">HSN Code</th>
                <th className="py-2.5 px-3">Base Price</th>
                <th className="py-2.5 px-3">{isIndianGst ? 'Govt GST Slab' : 'Shopkeeper Tax'}</th>
                <th className="py-2.5 px-3">Stock Level</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredItems.map((item) => {
                const gstPct = (item.gstRate * 100).toFixed(0);
                const isLowStock = item.stock <= item.minStockThreshold;

                return (
                  <tr key={item.sku} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-200">{item.name}</div>
                      <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                        <span>SKU: {item.sku}</span>
                        {item.aliases.length > 0 && (
                          <span className="text-slate-600 hidden sm:inline">
                            • Aliases: {item.aliases.slice(0, 2).join(', ')}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700/60">
                        {item.category}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {item.hsnCode}
                    </td>

                    <td className="py-2.5 px-3 font-semibold text-slate-200 font-mono">
                      {currencySym}{isIndianGst ? item.basePrice.toLocaleString('en-IN') : item.basePrice.toFixed(2)}
                    </td>

                    <td className="py-2.5 px-3">
                      {isIndianGst ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          item.gstRate === 0
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : item.gstRate <= 0.05
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : item.gstRate <= 0.18
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {gstPct}% GST
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          {((activeProfile?.customTaxRate ?? 0.0825) * 100).toFixed(2)}% Tax
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isLowStock ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                        <span className={`font-mono ${isLowStock ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                          {item.stock} {item.unit}
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onItemDeleted(item.sku)}
                        title="Delete from catalog"
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No items match query "{searchQuery}". Click "Add Item Manually" or speak to add it!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div>
            Total items in catalog: <strong className="text-slate-200">{catalog.length}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
