import React, { useState } from 'react';
import {
  ShieldCheck,
  Shield,
  Clock,
  ChevronDown,
  ChevronRight,
  FileJson,
  AlertTriangle,
  User,
  Bot,
  Cpu,
} from 'lucide-react';

export interface AuditEntry {
  timestamp: string;           // ISO 8601
  eventType:
    | 'UTTERANCE_CAPTURED'
    | 'SKU_MATCHED'
    | 'INVENTORY_VERIFIED'
    | 'BILLING_CALCULATED'
    | 'CORRECTION_APPLIED'
    | 'TECHNICIAN_CONFIRMED'
    | 'INVOICE_COMMITTED'
    | 'PAYMENT_SETTLED'
    | 'ERP_SYNCED';
  source: 'technician' | 'agent' | 'system';
  detail: string;              // Human-readable description
  rawData?: Record<string, any>; // Optional expandable JSON
  confidence?: number;         // 0.0 - 1.0 match confidence (for SKU_MATCHED)
  isCritical?: boolean;        // true for financial mutations
}

interface AuditTrailPanelProps {
  auditLog: AuditEntry[];
}

interface EventConfig {
  dotClass: string;
  badgeClass: string;
  label: string;
}

const EVENT_CONFIGS: Record<AuditEntry['eventType'], EventConfig> = {
  UTTERANCE_CAPTURED: {
    dotClass: 'bg-sky-400 ring-2 ring-sky-400/20',
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    label: 'Utterance Captured',
  },
  SKU_MATCHED: {
    dotClass: 'bg-orange-400 ring-2 ring-orange-400/20',
    badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    label: 'SKU Matched',
  },
  INVENTORY_VERIFIED: {
    dotClass: 'bg-violet-400 ring-2 ring-violet-400/20',
    badgeClass: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    label: 'Inventory Verified',
  },
  BILLING_CALCULATED: {
    dotClass: 'bg-emerald-400 ring-2 ring-emerald-400/20',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    label: 'Billing Calculated',
  },
  CORRECTION_APPLIED: {
    dotClass: 'bg-amber-400 ring-4 ring-amber-400/40 animate-pulse',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    label: 'Correction Applied',
  },
  TECHNICIAN_CONFIRMED: {
    dotClass: 'bg-emerald-400 ring-2 ring-emerald-400/20',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    label: 'Technician Confirmed',
  },
  INVOICE_COMMITTED: {
    dotClass: 'bg-emerald-500 ring-2 ring-emerald-500/30',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    label: 'Invoice Committed',
  },
  PAYMENT_SETTLED: {
    dotClass: 'bg-teal-400 ring-2 ring-teal-400/20',
    badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    label: 'Payment Settled',
  },
  ERP_SYNCED: {
    dotClass: 'bg-indigo-400 ring-2 ring-indigo-400/20',
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    label: 'ERP Synced',
  },
};

function formatTimestamp(timestampStr: string): string {
  try {
    const date = new Date(timestampStr);
    if (isNaN(date.getTime())) {
      return timestampStr;
    }
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestampStr;
  }
}

export const AuditTrailPanel: React.FC<AuditTrailPanelProps> = ({ auditLog }) => {
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});

  const toggleExpand = (index: number) => {
    setExpandedIndices((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden bg-slate-950/40 rounded-xl border border-slate-800/80 shadow-lg">
      {/* Header Row */}
      <div className="p-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Evidence-Locked Closeout Trail
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {auditLog.length} {auditLog.length === 1 ? 'event' : 'events'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/90 font-mono mt-0.5">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>Immutable Audit Record</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">Deterministic Zero-Hallucination</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {auditLog.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-slate-500" />
          </div>
          <h4 className="font-semibold text-slate-300 mb-1">Audit Trail Standby</h4>
          <p className="text-xs text-slate-500 max-w-xs">
            Awaiting voice closeout mutations. Spoken utterances, inventory matches, and financial calculations will be cryptographically logged here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-0 text-xs">
          {auditLog.map((entry, index) => {
            const isCorrection = entry.eventType === 'CORRECTION_APPLIED';
            const isExpanded = !!expandedIndices[index];
            const config = EVENT_CONFIGS[entry.eventType] || {
              dotClass: 'bg-slate-400 ring-2 ring-slate-400/20',
              badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
              label: entry.eventType,
            };

            const formattedTime = formatTimestamp(entry.timestamp);

            return (
              <div key={index} className="relative pl-7 pb-4 last:pb-1">
                {/* Connecting timeline vertical line */}
                {index !== auditLog.length - 1 && (
                  <div
                    className="absolute left-[11px] top-3.5 -bottom-1 w-[2px] bg-slate-800/90"
                    aria-hidden="true"
                  />
                )}

                {/* Timeline dot */}
                <div
                  className={`absolute left-[5px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${config.dotClass}`}
                  title={config.label}
                />

                {/* Entry Card */}
                <div
                  className={`p-3 rounded-xl border transition-all space-y-2 ${
                    isCorrection
                      ? 'bg-amber-950/20 border-l-4 border-l-amber-400 border-amber-500/40 shadow-lg shadow-amber-950/20'
                      : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700/80'
                  }`}
                >
                  {/* Top metadata line */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Event Type Badge */}
                      <span
                        className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded border ${config.badgeClass}`}
                      >
                        {config.label}
                      </span>

                      {/* Source Badge */}
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {entry.source === 'technician' && <User className="w-2.5 h-2.5 text-sky-400" />}
                        {entry.source === 'agent' && <Bot className="w-2.5 h-2.5 text-emerald-400" />}
                        {entry.source === 'system' && <Cpu className="w-2.5 h-2.5 text-violet-400" />}
                        <span className="capitalize">{entry.source}</span>
                      </span>

                      {/* Critical Financial Mutation Shield */}
                      {entry.isCritical && (
                        <span
                          className="flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30"
                          title="Evidence-Locked Financial Mutation"
                        >
                          <ShieldCheck className="w-3 h-3 text-amber-400" />
                          <span>Locked</span>
                        </span>
                      )}

                      {/* Correction Alert badge */}
                      {isCorrection && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Barge-In Mutation</span>
                        </span>
                      )}

                      {/* Match Confidence Badge */}
                      {entry.confidence !== undefined && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                          {(entry.confidence <= 1
                            ? entry.confidence * 100
                            : entry.confidence
                          ).toFixed(1)}
                          % match
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Raw Data Toggle Button */}
                      {entry.rawData && (
                        <button
                          onClick={() => toggleExpand(index)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                            isExpanded
                              ? 'bg-slate-800 text-sky-300 border border-slate-700'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                          title={isExpanded ? 'Hide Raw JSON' : 'View Raw JSON'}
                        >
                          <FileJson className="w-3 h-3 text-sky-400" />
                          <span>JSON</span>
                          {isExpanded ? (
                            <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-2.5 h-2.5 text-slate-400" />
                          )}
                        </button>
                      )}

                      {/* Timestamp in monospace */}
                      <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                        <Clock className="w-2.5 h-2.5 text-slate-500" />
                        <span>{formattedTime}</span>
                      </span>
                    </div>
                  </div>

                  {/* Detail description */}
                  <p
                    className={`leading-relaxed text-xs ${
                      isCorrection ? 'text-amber-100 font-medium' : 'text-slate-200'
                    }`}
                  >
                    {entry.detail}
                  </p>

                  {/* Expandable Raw Data Pre Block */}
                  {entry.rawData && isExpanded && (
                    <div className="mt-2 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                      <div className="flex items-center justify-between mb-1.5 text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                        <span className="flex items-center gap-1 text-sky-400">
                          <FileJson className="w-3 h-3" />
                          Cryptographic Mutation Payload:
                        </span>
                        <span className="text-[10px] text-slate-500">Read-Only</span>
                      </div>
                      <pre className="text-[11px] font-mono text-emerald-300/90 overflow-x-auto max-h-48 leading-snug p-1">
                        {JSON.stringify(entry.rawData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
