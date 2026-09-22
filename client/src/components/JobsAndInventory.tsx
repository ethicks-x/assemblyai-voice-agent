import React, { useState } from 'react';
import { Briefcase, Package, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export interface WorkOrder {
  id: string;
  clientName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  equipment: string;
  serialNumber: string;
  reportedIssue: string;
  status: 'DISPATCHED' | 'IN_PROGRESS' | 'COMPLETED';
  hourlyRate: number;
}

export interface InventoryPart {
  sku: string;
  name: string;
  truckStock: number;
  minStockThreshold: number;
  retailPrice: number;
  unit: string;
  hsnCode?: string;
  gstRate?: number;
}

interface JobsAndInventoryProps {
  workOrders: WorkOrder[];
  inventory: InventoryPart[];
  activeWorkOrderId?: string;
  onSelectWorkOrder?: (id: string) => void;
  currencySymbol?: string;
  businessType?: string;
}

export const JobsAndInventory: React.FC<JobsAndInventoryProps> = ({
  workOrders,
  inventory,
  activeWorkOrderId,
  onSelectWorkOrder,
  currencySymbol = '$',
  businessType,
}) => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'inventory'>('jobs');

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col h-[740px] shadow-xl overflow-hidden">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 p-1">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'jobs'
              ? 'bg-slate-800 text-sky-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Active Tickets ({workOrders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'inventory'
              ? 'bg-slate-800 text-sky-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Van Inventory ({inventory.length})</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {activeTab === 'jobs' ? (
          workOrders.map((wo) => {
            const isActive = wo.id === activeWorkOrderId;
            const isCompleted = wo.status === 'COMPLETED';

            return (
              <div
                key={wo.id}
                onClick={() => onSelectWorkOrder?.(wo.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-sky-950/40 border-sky-500/50 shadow-md shadow-sky-500/10'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-sky-400">
                    {wo.id}
                  </span>
                  <span
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isCompleted
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : wo.status === 'IN_PROGRESS'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-2.5 h-2.5" />
                    ) : (
                      <Clock className="w-2.5 h-2.5" />
                    )}
                    {wo.status}
                  </span>
                </div>

                <h3 className="font-semibold text-sm text-slate-100 line-clamp-1">
                  {wo.clientName}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-1 mb-2">
                  {wo.address}
                </p>

                <div className="bg-slate-900/80 p-2 rounded-lg text-[11px] text-slate-300 border border-slate-800/60 mb-2">
                  <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider mb-0.5">
                    Equipment
                  </div>
                  <div className="truncate font-medium">{wo.equipment}</div>
                </div>

                <div className="text-[11px] text-slate-400 italic line-clamp-2">
                  "{wo.reportedIssue}"
                </div>
              </div>
            );
          })
        ) : (
          <div className="space-y-2">
            <div className="px-1 text-[11px] font-mono text-slate-400 uppercase flex justify-between">
              <span>Part & SKU</span>
              <span>Stock / Price</span>
            </div>
            {inventory.map((part) => {
              const isLow = part.truckStock <= part.minStockThreshold;
              const formattedPrice = currencySymbol === '₹'
                ? part.retailPrice.toLocaleString('en-IN')
                : part.retailPrice.toFixed(2);

              return (
                <div
                  key={part.sku}
                  className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="flex-1 pr-2">
                    <div className="font-medium text-slate-200 line-clamp-1">
                      {part.name}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span>SKU: {part.sku}</span>
                      {part.hsnCode && (
                        <span className="text-sky-400 bg-sky-950/60 px-1 rounded border border-sky-800/40">
                          HSN {part.hsnCode}
                        </span>
                      )}
                      {typeof part.gstRate === 'number' && (
                        <span className="text-emerald-400 bg-emerald-950/60 px-1 rounded border border-emerald-800/40">
                          {(part.gstRate * 100).toFixed(0)}% GST
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <div className="flex items-center gap-1">
                      <span
                        className={`font-mono font-bold ${
                          isLow ? 'text-amber-400' : 'text-slate-200'
                        }`}
                      >
                        {part.truckStock} {part.unit}
                      </span>
                      {isLow && (
                        <span title="Stock low">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-sky-400 font-semibold font-mono">
                      {currencySymbol}{formattedPrice}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
