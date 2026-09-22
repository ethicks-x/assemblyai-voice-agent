import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  CreditCard,
  CheckCircle2,
  Lock,
  Download,
  ShieldCheck,
  Building2,
  Calendar,
  PenTool,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { InvoiceData } from './InvoiceViewer';

interface CustomerCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceData | null;
  onPaymentSuccess?: (transactionId: string) => void;
}

export const CustomerCheckoutModal: React.FC<CustomerCheckoutModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onPaymentSuccess,
}) => {
  const [signerName, setSignerName] = useState('Marcus Johnson');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_pay' | 'net30'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [transactionId, setTransactionId] = useState<string>('');
  const [cardNumber, setCardNumber] = useState('•••• •••• •••• 4242');
  const [expiry, setExpiry] = useState('08/28');
  const [cvc, setCvc] = useState('884');

  // Canvas Signature Pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsPaid(false);
      setIsProcessing(false);
      setHasSigned(false);
      setTimeout(initCanvas, 100);
    }
  }, [isOpen]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasSigned(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x = 0;
    let y = 0;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearSignature = () => {
    initCanvas();
    setHasSigned(false);
  };

  const handleProcessPayment = async () => {
    if (!invoice) return;
    setIsProcessing(true);

    try {
      const res = await fetch(`/api/invoices/${invoice.invoiceId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerName,
          paymentMethod: paymentMethod.toUpperCase(),
        }),
      });

      const data = await res.json();
      const txId = data.transactionId || `TX-APEX-${Date.now().toString().slice(-6)}`;
      setTransactionId(txId);

      // Simulate realistic processing time
      setTimeout(() => {
        setIsProcessing(false);
        setIsPaid(true);
        onPaymentSuccess?.(txId);
      }, 1200);
    } catch (err) {
      console.error('Payment processing failed:', err);
      setIsProcessing(false);
    }
  };

  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center text-white font-bold shadow-md shadow-sky-500/20">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100">Apex Commercial Services</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  Customer Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Austin Fleet • Dispatch Hotline (512) 555-0199</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div>
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Invoice Reference</span>
              <span className="font-mono text-sm font-bold text-sky-400">#{invoice.invoiceId}</span>
            </div>

            <span
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                isPaid
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isPaid ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  PAID & SETTLED
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-amber-400" />
                  PENDING SIGN-OFF
                </>
              )}
            </span>
          </div>

          {/* Customer & Job Brief */}
          <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 block">Customer Account</span>
                <span className="font-semibold text-slate-200">{invoice.clientName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Authorized Contact</span>
                <span className="font-semibold text-slate-200">{signerName}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
              <span className="text-slate-500 block">Technician Closeout Notes:</span>
              <p className="text-slate-300 italic">
                "Replaced dual run 45/5 MFD capacitor and 24V contactor. Flushed clogged drain trap with Viper. System cooling verified at 18 deg F delta T."
              </p>
            </div>
          </div>

          {/* Amount Due Pill */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-950 border border-sky-500/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Amount Due</span>
              <span className="text-2xl font-extrabold font-mono text-slate-100">
                ${invoice.totalAmount.toFixed(2)}
              </span>
            </div>
            <div className="text-right text-[11px] font-mono text-slate-400">
              <div>Labor: $281.25</div>
              <div>Parts: $295.00</div>
              <div>Tax: $24.34</div>
            </div>
          </div>

          {/* If Paid State */}
          {isPaid ? (
            <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-center space-y-3 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Payment Successfully Processed</h3>
                <p className="text-xs text-emerald-400 font-mono mt-0.5">Transaction ID: {transactionId}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  A copy of your signed receipt has been delivered to {invoice.clientEmail}.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <a
                  href={invoice.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Paid Receipt PDF</span>
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-300 block">Select Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-2.5 rounded-xl border text-center font-medium transition-all ${
                      paymentMethod === 'card'
                        ? 'bg-sky-950/60 border-sky-500 text-sky-400 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 mx-auto mb-1" />
                    <span>Credit Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('apple_pay')}
                    className={`p-2.5 rounded-xl border text-center font-medium transition-all ${
                      paymentMethod === 'apple_pay'
                        ? 'bg-sky-950/60 border-sky-500 text-sky-400 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold text-sm block mb-0.5">Pay</span>
                    <span>Apple Pay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('net30')}
                    className={`p-2.5 rounded-xl border text-center font-medium transition-all ${
                      paymentMethod === 'net30'
                        ? 'bg-sky-950/60 border-sky-500 text-sky-400 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4 mx-auto mb-1" />
                    <span>Net-30 Terms</span>
                  </button>
                </div>
              </div>

              {/* Card Inputs */}
              {paymentMethod === 'card' && (
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5 animate-fade-in">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Expiration</label>
                      <input
                        type="text"
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">CVC / Security Code</label>
                      <input
                        type="text"
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Digital Signature Pad */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-sky-400" />
                    <span>Customer Digital Sign-Off</span>
                  </label>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Clear</span>
                  </button>
                </div>

                <div className="relative border border-dashed border-slate-700 rounded-xl overflow-hidden bg-slate-950/80">
                  <canvas
                    ref={canvasRef}
                    width={480}
                    height={110}
                    onMouseDown={startDrawing}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onMouseMove={draw}
                    onTouchStart={startDrawing}
                    onTouchEnd={stopDrawing}
                    onTouchMove={draw}
                    className="w-full h-[110px] cursor-crosshair"
                  />
                  {!hasSigned && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-600 text-xs">
                      Sign with finger or mouse to authorize closeout
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer / Action Button */}
        {!isPaid && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>256-Bit Encrypted Checkout</span>
            </div>

            <button
              onClick={handleProcessPayment}
              disabled={isProcessing}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all ${
                isProcessing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/20 active:scale-95'
              }`}
            >
              {isProcessing ? (
                <>
                  <Lock className="w-3.5 h-3.5 animate-spin" />
                  <span>Settling with Merchant...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 fill-current text-slate-950" />
                  <span>Authorize & Pay ${invoice.totalAmount.toFixed(2)}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
