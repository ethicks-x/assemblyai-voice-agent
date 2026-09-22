import React, { useState, useEffect } from 'react';
import { X, Percent, DollarSign, Globe, Check, ShieldAlert, Sparkles, Building2 } from 'lucide-react';
import { BusinessProfile } from './CatalogManagerModal';

interface TaxSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile: BusinessProfile | null;
  onSaveTaxRate: (profileId: string, taxRate: number, taxLabel: string) => Promise<void>;
}

export const TaxSettingsModal: React.FC<TaxSettingsModalProps> = ({
  isOpen,
  onClose,
  activeProfile,
  onSaveTaxRate,
}) => {
  const [taxPercent, setTaxPercent] = useState<number>(8.25);
  const [taxLabel, setTaxLabel] = useState<string>('State Sales Tax (8.25%)');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (activeProfile) {
      const rate = typeof activeProfile.customTaxRate === 'number' ? activeProfile.customTaxRate * 100 : 8.25;
      setTaxPercent(rate);
      setTaxLabel(activeProfile.customTaxLabel || `${activeProfile.country || 'Local'} Sales Tax (${rate.toFixed(2)}%)`);
      setSaveSuccess(false);
    }
  }, [activeProfile, isOpen]);

  if (!isOpen || !activeProfile) return null;

  const presets = [
    { label: '0% (Tax Free)', rate: 0, name: 'Tax Free / Exempt (0%)' },
    { label: '5.0% (Reduced)', rate: 5.0, name: 'Local Sales Tax (5.00%)' },
    { label: '7.65% (Denver)', rate: 7.65, name: 'Denver Metro Sales Tax (7.65%)' },
    { label: '8.25% (Austin, TX)', rate: 8.25, name: 'Travis County Sales Tax (8.25%)' },
    { label: '9.0% (Chicago)', rate: 9.0, name: 'Cook County Sales Tax (9.00%)' },
    { label: '10.25% (Seattle)', rate: 10.25, name: 'King County Sales Tax (10.25%)' },
    { label: '20.0% (UK VAT)', rate: 20.0, name: 'UK Value Added Tax (20.00% VAT)' },
  ];

  const handleApplyPreset = (preset: { rate: number; name: string }) => {
    setTaxPercent(preset.rate);
    setTaxLabel(preset.name);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const decimalRate = Math.max(0, taxPercent) / 100;
      await onSaveTaxRate(activeProfile.id, decimalRate, taxLabel);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to save tax settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const sampleBase = 1000;
  const sampleTax = Math.round(sampleBase * (taxPercent / 100) * 100) / 100;
  const sampleTotal = sampleBase + sampleTax;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Percent className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Shopkeeper Country Tax Settings
              </h2>
              <p className="text-xs text-slate-400">
                Configure your country or state tax rate for {activeProfile.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Active Business Info Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">{activeProfile.name}</p>
                <p className="text-[11px] text-slate-400">
                  {activeProfile.country || 'International'} • {activeProfile.businessCategory === 'RETAIL_SHOP' ? 'Retail Shop' : 'Service Trade'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Custom Tax Mode
            </span>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-2">
              Country & Municipal Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    Math.abs(taxPercent - preset.rate) < 0.01
                      ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                      : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Tax Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">
                Tax Rate Percentage (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 pl-8 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-sky-500 transition-colors"
                  placeholder="8.25"
                  required
                />
                <Percent className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3" />
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">
                Currency Symbol
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={activeProfile.currencySymbol}
                  disabled
                  className="w-full px-3 py-2 pl-8 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 font-mono text-sm cursor-not-allowed"
                />
                <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">
              Tax Label Displayed on Invoices & Spoken Readback
            </label>
            <input
              type="text"
              value={taxLabel}
              onChange={(e) => setTaxLabel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-sky-500 transition-colors"
              placeholder="e.g. State Sales Tax (8.25%) or UK Value Added Tax (20% VAT)"
              required
            />
          </div>

          {/* Live Math Simulation Preview */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-sky-400" />
              Real-Time Calculation Preview ({activeProfile.currencySymbol}{sampleBase} sample)
            </p>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Items / Materials Subtotal:</span>
              <span className="font-mono">{activeProfile.currencySymbol}{sampleBase.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>{taxLabel}:</span>
              <span className="font-mono text-emerald-400">+{activeProfile.currencySymbol}{sampleTax.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-800 pt-1.5 flex items-center justify-between text-xs font-bold text-white">
              <span>Customer Grand Total:</span>
              <span className="font-mono text-sky-400">{activeProfile.currencySymbol}{sampleTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Notice Callout */}
          <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-800/30 text-[11px] text-slate-400 leading-relaxed">
            <span className="font-semibold text-sky-300">Global Flexibility: </span>
            While Indian businesses adhere strictly to Central/State GST statutory slabs, shopkeepers in all other countries can set their own tax percentage to match municipal, state, or national laws.
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                saveSuccess
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-slate-950'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Tax Saved!</span>
                </>
              ) : isSaving ? (
                <span>Saving...</span>
              ) : (
                <span>Apply Tax Settings</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
