import React, { useState } from 'react';
import {
  Mic,
  Phone,
  Play,
  RotateCcw,
  Activity,
  ChevronDown,
  Package,
  Percent,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';
import { BusinessProfile } from './CatalogManagerModal';

interface HeaderProps {
  isConnected: boolean;
  isSimulating: boolean;
  onRunScenario: (scenarioId?: string) => void;
  onResetDemo: () => void;
  sessionMode: string;
  activeProfile: BusinessProfile | null;
  profiles: BusinessProfile[];
  onSwitchProfile: (profileId: string) => void;
  onOpenCatalog: () => void;
  selectedRegion: 'INDIA' | 'GLOBAL';
  onRegionChange: (region: 'INDIA' | 'GLOBAL') => void;
  onOpenTaxSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  isSimulating,
  onRunScenario,
  onResetDemo,
  sessionMode,
  activeProfile,
  profiles,
  onSwitchProfile,
  onOpenCatalog,
  selectedRegion,
  onRegionChange,
  onOpenTaxSettings,
}) => {
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);

  const getProfileIcon = (p?: BusinessProfile | null) => {
    if (!p) return '🏢';
    if (p.tradeType === 'PLUMBER') return '🚰';
    if (p.tradeType === 'ELECTRICIAN') return '⚡';
    if (p.tradeType === 'HVAC_TECHNICIAN') return '❄️';
    if (p.businessType === 'CUSTOM_PC_BUILDER') return '🖥️';
    if (p.businessType === 'GARMENT_RETAIL') return '👗';
    if (p.businessType === 'BOOK_SHOP') return '📚';
    return p.businessCategory === 'SERVICE_TRADE' ? '🔧' : '🛍️';
  };

  const handleScenarioClick = (scenarioId: string) => {
    setShowScenarioMenu(false);
    onRunScenario(scenarioId);
  };

  // Filter profiles for current region
  const visibleProfiles = profiles.filter((p) => {
    if (selectedRegion === 'INDIA') return p.region === 'INDIA' || p.taxSystem === 'GST_INDIA';
    return p.region === 'GLOBAL' || p.taxSystem !== 'GST_INDIA';
  });

  const retailShops = visibleProfiles.filter(
    (p) =>
      p.businessCategory === 'RETAIL_SHOP' ||
      p.businessType === 'CUSTOM_PC_BUILDER' ||
      p.businessType === 'GARMENT_RETAIL' ||
      p.businessType === 'BOOK_SHOP'
  );

  const serviceTrades = visibleProfiles.filter(
    (p) => p.businessCategory === 'SERVICE_TRADE' || p.businessType === 'FIELD_SERVICE_TRADE'
  );

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 py-2.5 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
            <Mic className="w-5 h-5 text-white animate-pulse-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-cyan-300 to-white">
                FieldPilot
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30">
                Voice POS & Fleet AI
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Universal Voice Invoicing • Shops, PC Builders, Technicians & Field Trades
            </p>
          </div>
        </div>

        {/* Region Segmented Switcher (India vs Other Countries) */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => onRegionChange('INDIA')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedRegion === 'INDIA'
                ? 'bg-gradient-to-r from-orange-500/20 to-emerald-500/20 text-white border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🇮🇳</span>
            <span>India (Govt GST)</span>
          </button>
          <button
            onClick={() => onRegionChange('GLOBAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedRegion === 'GLOBAL'
                ? 'bg-gradient-to-r from-sky-500/20 to-indigo-500/20 text-white border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>Other Countries (Custom Tax)</span>
          </button>
        </div>

        {/* Business Profile Selector & Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 shadow-inner">
            <span className="text-base">{getProfileIcon(activeProfile)}</span>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">
                Active Business Profile
              </span>
              <select
                value={activeProfile?.id || ''}
                onChange={(e) => onSwitchProfile(e.target.value)}
                className="text-xs font-semibold bg-transparent text-slate-200 focus:outline-none cursor-pointer pr-2 max-w-[190px] truncate"
              >
                {retailShops.length > 0 && (
                  <optgroup label="🛍️ Retail & Specialized Shops" className="bg-slate-900 text-slate-300 font-bold">
                    {retailShops.map((p) => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200 font-normal">
                        {p.name} ({p.currencySymbol} • {p.region === 'INDIA' ? `${p.state || 'India'} GST` : `${((p.customTaxRate || 0) * 100).toFixed(1)}%`})
                      </option>
                    ))}
                  </optgroup>
                )}

                {serviceTrades.length > 0 && (
                  <optgroup label="🔧 Service Trades & Field Fleets" className="bg-slate-900 text-slate-300 font-bold">
                    {serviceTrades.map((p) => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200 font-normal">
                        {p.name} ({p.currencySymbol} • {p.region === 'INDIA' ? `${p.state || 'India'} GST` : `${((p.customTaxRate || 0) * 100).toFixed(1)}%`})
                      </option>
                    ))}
                  </optgroup>
                )}

                {retailShops.length === 0 && serviceTrades.length === 0 && visibleProfiles.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Tax Settings Modal Trigger (Global Mode Only) */}
          {selectedRegion === 'GLOBAL' && (
            <button
              onClick={onOpenTaxSettings}
              title="Configure custom country / regional tax rate"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all active:scale-95 shadow-sm"
            >
              <Percent className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">
                {activeProfile?.customTaxRate !== undefined
                  ? `${(activeProfile.customTaxRate * 100).toFixed(activeProfile.customTaxRate % 0.01 === 0 ? 0 : 2)}% Tax`
                  : 'Country Tax'}
              </span>
            </button>
          )}

          {/* Shop Catalog Manager Modal Trigger */}
          <button
            onClick={onOpenCatalog}
            title="Open Live Shop Catalog & Slabs"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 text-xs font-semibold transition-all active:scale-95 shadow-sm"
          >
            <Package className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">{selectedRegion === 'INDIA' ? 'Catalog & GST' : 'Catalog & Rates'}</span>
          </button>
        </div>

        {/* Telephony & Network Status */}
        <div className="hidden xl:flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Twilio SIP / WebRTC</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Engine:</span>
            <span className={isConnected ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
              {sessionMode === 'SIMULATION' ? 'Active Call' : isConnected ? 'Online' : 'Standby'}
            </span>
          </div>
        </div>

        {/* Action Controls & Interactive Demos */}
        <div className="flex items-center gap-2 relative">
          <div className="flex rounded-lg shadow-md overflow-hidden border border-sky-500/40">
            <button
              onClick={() =>
                onRunScenario(
                  selectedRegion === 'INDIA'
                    ? activeProfile?.businessCategory === 'SERVICE_TRADE'
                      ? 'indian-trade'
                      : 'indian-pc-builder'
                    : 'johnson-cooling'
                )
              }
              disabled={isSimulating}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-all ${
                isSimulating
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 active:scale-95'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {isSimulating
                  ? 'Simulating...'
                  : selectedRegion === 'INDIA'
                  ? activeProfile?.businessCategory === 'SERVICE_TRADE'
                    ? 'Run Plumber Scenario (₹)'
                    : 'Run PC Shop Scenario (₹)'
                  : 'Run HVAC Scenario ($)'}
              </span>
            </button>

            <button
              onClick={() => setShowScenarioMenu(!showScenarioMenu)}
              disabled={isSimulating}
              className="px-2 py-1.5 bg-sky-600 hover:bg-sky-500 text-slate-950 border-l border-sky-400/40 transition-colors"
              title="Choose Voice Agent Simulation Scenario"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scenario Picker Dropdown */}
          {showScenarioMenu && (
            <div className="absolute right-0 top-11 w-72 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50 animate-fade-in text-xs">
              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                🇮🇳 Indian GST Scenarios (Statutory Slabs)
              </div>
              <button
                onClick={() => handleScenarioClick('indian-pc-builder')}
                className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800 text-slate-200 flex flex-col gap-0.5 transition-colors"
              >
                <div className="font-bold flex items-center gap-1.5 text-sky-400">
                  <span>🖥️ Indian Custom PC Builder</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Bengaluru to Mumbai • 18% IGST • ₹ INR • BlueDart Tracking • UPI QR
                </div>
              </button>

              <button
                onClick={() => handleScenarioClick('indian-trade')}
                className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800 text-slate-200 flex flex-col gap-0.5 transition-colors"
              >
                <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <span>🚰 Indian Plumber & Sanitary</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Mumbai Residential • 9% CGST + 9% SGST • Brass Valves & Labor • UPI QR
                </div>
              </button>

              <div className="px-2.5 py-1 mt-1 border-t border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                🌍 Global Scenarios (Custom Country Tax)
              </div>
              <button
                onClick={() => handleScenarioClick('johnson-cooling')}
                className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800 text-slate-200 flex flex-col gap-0.5 transition-colors"
              >
                <div className="font-bold flex items-center gap-1.5 text-cyan-400">
                  <span>❄️ Commercial HVAC Trade Fleet</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Austin, TX • TX Rule 3.292 8.25% Tax • $ USD • ServiceTitan & QBO Sync
                </div>
              </button>
            </div>
          )}

          <button
            onClick={onResetDemo}
            title="Reset demo seed data"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
