import React from 'react';
import {
  FileText,
  Download,
  ExternalLink,
  Send,
  CheckCircle2,
  CreditCard,
  Building2,
  Layers,
  Database,
  ShieldCheck,
  QrCode,
  Package,
} from 'lucide-react';
import { ERPSyncData } from './ERPIntegrationsModal';

export interface InvoiceData {
  invoiceId: string;
  totalAmount: number;
  pdfUrl: string;
  clientName: string;
  clientEmail: string;
  summaryMessage: string;
  paymentUrl?: string;
  status?: string;
  shopName?: string;
  shopGstin?: string;
  taxJurisdiction?: string;
  taxDisclaimer?: string;
  currencySymbol?: string;
  isInterState?: boolean;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  subtotal?: number;
  shippingFee?: number;
  courierPartner?: string;
  courierTracking?: string;
  upiPaymentString?: string;
  upiQrDataUrl?: string;
  totalInWords?: string;
}

interface InvoiceViewerProps {
  invoice: InvoiceData | null;
  notificationSent: boolean;
  isPaid?: boolean;
  erpData?: ERPSyncData | null;
  auditEntriesCount?: number;
  onOpenCheckout?: () => void;
  onOpenERP?: () => void;
  onOpenAudit?: () => void;
}

export const InvoiceViewer: React.FC<InvoiceViewerProps> = ({
  invoice,
  notificationSent,
  isPaid = false,
  erpData,
  auditEntriesCount = 0,
  onOpenCheckout,
  onOpenERP,
  onOpenAudit,
}) => {
  if (!invoice) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
        <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-3">
          <FileText className="w-6 h-6 text-slate-500" />
        </div>
        <h4 className="font-semibold text-slate-300 mb-1">Awaiting Invoice Generation</h4>
        <p className="text-xs text-slate-500 max-w-xs">
          When the technician confirms the verbal readback, FieldPilot automatically renders the vector PDF invoice and delivers it to the customer.
        </p>
      </div>
    );
  }

  const isGst = Boolean(
    invoice.shopGstin ||
    invoice.currencySymbol === '₹' ||
    invoice.taxJurisdiction?.includes('GST') ||
    invoice.taxJurisdiction?.includes('State') ||
    invoice.invoiceId.startsWith('INV-GST')
  );
  const currencySym = invoice.currencySymbol || (isGst ? '₹' : '$');
  const formattedTotal = currencySym === '₹'
    ? invoice.totalAmount.toLocaleString('en-IN')
    : invoice.totalAmount.toFixed(2);

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Invoice Overview Card */}
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-sky-400">
              #{invoice.invoiceId}
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                isPaid || invoice.status === 'PAID'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              {isPaid || invoice.status === 'PAID' ? 'PAID & SETTLED' : 'ISSUED & BILLED'}
            </span>
          </div>
          <div className="text-right">
            <span className="font-mono text-base font-extrabold text-emerald-400">
              {currencySym}{formattedTotal}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/60">
          <div>
            <span className="text-slate-500 block">Customer:</span>
            <span className="font-medium text-slate-200">{invoice.clientName}</span>
          </div>
          <div>
            <span className="text-slate-500 block">{isGst ? 'Billing / Shop:' : 'Delivery Email:'}</span>
            <span className="font-medium text-slate-200 truncate block">
              {isGst && invoice.shopName ? invoice.shopName : invoice.clientEmail}
            </span>
          </div>
        </div>

        {/* SMS / WhatsApp Notification Dispatch Pill */}
        {notificationSent && (
          <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-600/40 text-[11px] text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isGst ? 'WhatsApp & SMS Dispatched with UPI Link' : 'SMS & Email Dispatched to Customer'}</span>
            </div>
            <span className="font-mono text-[10px] text-emerald-400 font-bold">SENT</span>
          </div>
        )}

        {/* Courier Dispatch Tracking Badge */}
        {invoice.courierTracking && (
          <div className="p-2 rounded-lg bg-sky-950/40 border border-sky-600/40 text-[11px] text-sky-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-sky-400" />
              <span>Courier Dispatch: {invoice.courierPartner || 'BlueDart Express'}</span>
            </div>
            <span className="font-mono text-[10px] text-sky-300 font-bold bg-sky-900/60 px-1.5 py-0.5 rounded border border-sky-700/50">
              AWB: {invoice.courierTracking}
            </span>
          </div>
        )}

        {/* Tax Compliance Pill (Indian GST vs US Sales Tax) */}
        <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px] space-y-0.5">
          <div className="flex items-center justify-between text-slate-300">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <span>{isGst ? `🇮🇳 ${invoice.taxJurisdiction || 'Indian GST (Rule 46 CGST)'}` : '🏛️ Austin, TX Sales Tax (8.25%)'}</span>
            </span>
            <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
              {isGst ? (invoice.isInterState ? 'IGST 18% INTER-STATE' : 'CGST 9% + SGST 9%') : 'PARTS-ONLY APPLIED'}
            </span>
          </div>
          <p className="text-[9.5px] text-slate-400 leading-snug">
            {isGst
              ? invoice.taxDisclaimer || 'Compliant with Section 31 of CGST Act 2017 with official HSN/SAC codes.'
              : 'Tax assessed strictly on taxable parts & materials. HVAC labor is non-taxable commercial repair per TX Comptroller Rule 3.292.'}
          </p>
        </div>

        {/* Instant UPI Payment QR Code Block */}
        {invoice.upiQrDataUrl && (
          <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-500/40 flex items-center gap-3">
            <img
              src={invoice.upiQrDataUrl}
              alt="UPI QR Code"
              className="w-14 h-14 rounded-lg bg-white p-1 shrink-0 shadow border border-slate-700"
            />
            <div className="flex-1 min-w-0 text-xs">
              <div className="font-bold text-sky-300 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-sky-400" />
                <span>Instant UPI Settlement</span>
              </div>
              <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                VPA: {invoice.upiPaymentString?.split('pa=')[1]?.split('&')[0] || 'apexpc@okhdfcbank'}
              </p>
              <p className="text-[9px] text-slate-400">
                Scan with Google Pay, PhonePe, Paytm, BHIM
              </p>
            </div>
            {invoice.upiPaymentString && (
              <a
                href={invoice.upiPaymentString}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10px] shadow transition-colors shrink-0"
              >
                Pay UPI
              </a>
            )}
          </div>
        )}

        {/* Dual ERP Sync Ribbon */}
        {erpData ? (
          <div className="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-500/30 text-[11px] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span>Dual ERP & Accounting Sync</span>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                SANDBOX ADAPTER (SCHEMA-VERIFIED)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1 text-slate-300">
                  <Building2 className="w-3 h-3 text-orange-400" />
                  <span>ServiceTitan</span>
                </div>
                <span className="font-mono font-bold text-orange-400">{erpData.serviceTitan.serviceTitanJobId}</span>
              </div>

              <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1 text-slate-300">
                  <Layers className="w-3 h-3 text-emerald-400" />
                  <span>QuickBooks</span>
                </div>
                <span className="font-mono font-bold text-emerald-400">{erpData.quickbooks.quickbooksDocNumber}</span>
              </div>
            </div>

            {onOpenERP && (
              <button
                onClick={onOpenERP}
                className="w-full flex items-center justify-center gap-1 py-1 rounded bg-slate-800/90 hover:bg-slate-700/90 text-[10px] font-semibold text-sky-300 border border-sky-500/30 transition-colors"
              >
                <span>Inspect ServiceTitan & QBO Payloads</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : onOpenERP ? (
          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>ServiceTitan & QuickBooks V2 Ready</span>
            </div>
            <button
              onClick={onOpenERP}
              className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 transition-colors underline"
            >
              Inspect ERP
            </button>
          </div>
        ) : null}

        {/* Evidence-Locked Audit Trail Ribbon */}
        {onOpenAudit && (
          <button
            onClick={onOpenAudit}
            className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-amber-950/20 hover:bg-amber-950/35 border border-amber-500/30 text-[11px] font-semibold text-amber-300 transition-colors group"
          >
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Evidence-Locked Audit Trail</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {auditEntriesCount > 0 ? `${auditEntriesCount} Events • Deterministic Lock` : 'Inspect Trail'}
            </span>
          </button>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          {onOpenCheckout && (
            <button
              onClick={onOpenCheckout}
              className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-bold text-xs shadow-md transition-all ${
                isPaid || invoice.status === 'PAID'
                  ? 'bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/20 active:scale-95'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{isPaid || invoice.status === 'PAID' ? 'View Signed Receipt & Payment Record' : 'Open Customer Checkout & Sign-Off'}</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <a
              href={invoice.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>

            <a
              href={invoice.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Embedded PDF Preview Frame */}
      <div className="flex-1 rounded-xl border border-slate-800 overflow-hidden bg-slate-950 shadow-inner relative">
        <iframe
          src={`${invoice.pdfUrl}#toolbar=0`}
          className="w-full h-full border-0"
          title="Generated Vector Invoice PDF"
        />
      </div>
    </div>
  );
};
