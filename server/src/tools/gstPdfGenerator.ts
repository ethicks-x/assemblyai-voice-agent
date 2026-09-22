import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { db, Invoice, InvoiceItem } from '../data/mockDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INVOICES_DIR = path.resolve(__dirname, '../../public/invoices');

if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

export interface GenerateGstInvoiceParams {
  order_id?: string;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  client_address?: string;
  is_interstate?: boolean;
  courier_dispatch?: boolean;
  courier_tracking?: string;
  technician_notes?: string;
  items: Array<{
    sku?: string;
    description: string;
    quantity: number;
    unit_price?: number;
    hsn_code?: string;
    gst_rate?: number;
  }>;
}

export interface GenerateGstInvoiceResult {
  success: boolean;
  invoiceId: string;
  totalAmount: number;
  pdfUrl: string;
  pdfFilePath: string;
  clientName: string;
  clientEmail: string;
  upiPaymentString: string;
  upiQrDataUrl: string;
  summaryMessage: string;
}

export function numberToIndianWords(num: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Rupees Zero Only';
  const integerPart = Math.floor(num);
  
  function convert(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  }
  
  return `Rupees ${convert(integerPart)} Only`;
}

/**
 * Generates an authentic, legally compliant Indian GST Tax Invoice PDF (Rule 46 CGST Rules)
 * with HSN codes, IGST/CGST/SGST breakdown, Courier tracking, and scannable UPI QR code.
 */
export async function generateGstTaxInvoice(params: GenerateGstInvoiceParams): Promise<GenerateGstInvoiceResult> {
  const profile = db.getActiveProfile();
  const invoiceNum = `GST-${Date.now().toString().slice(-6)}`;
  const invoiceId = `INV-${invoiceNum}`;

  const clientName = params.client_name || 'Customer';
  const clientPhone = params.client_phone || '+91 98200 44551';
  const clientEmail = params.client_email || 'client@domain.in';
  const clientAddress = params.client_address || 'Flat 402, Sea Crest Towers, Bandra West, Mumbai, MH 400050';

  // Detect inter-state: compare customer state to profile state
  let isInterState = params.is_interstate ?? false;
  const addressLower = clientAddress.toLowerCase();
  const profileStateLower = (profile.state || '').toLowerCase();

  if (params.is_interstate === undefined) {
    if (params.courier_dispatch) {
      isInterState = true;
    } else if (addressLower.includes('mumbai') || addressLower.includes('maharashtra')) {
      isInterState = profileStateLower !== 'maharashtra';
    } else if (addressLower.includes('delhi')) {
      isInterState = profileStateLower !== 'delhi';
    } else if (addressLower.includes('bengaluru') || addressLower.includes('bangalore') || addressLower.includes('karnataka')) {
      isInterState = profileStateLower !== 'karnataka';
    } else if (addressLower.includes('kolkata') || addressLower.includes('west bengal')) {
      isInterState = profileStateLower !== 'west bengal';
    }
  }

  const invoiceItems: InvoiceItem[] = [];
  let taxableSubtotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  for (const item of params.items) {
    let unitPrice = item.unit_price;
    let hsn = item.hsn_code || '8471';
    let gstRate = typeof item.gst_rate === 'number' ? item.gst_rate : 0.18;

    // Check catalog for SKU or name
    const found = item.sku ? db.getCatalogItem(item.sku) : db.findCatalogItemByQuery(item.description);
    if (found) {
      if (!unitPrice) unitPrice = found.basePrice;
      hsn = found.hsnCode;
      gstRate = found.gstRate;
      db.deductCatalogStock(found.sku, item.quantity);
    }
    if (!unitPrice) unitPrice = 1200;

    const lineTaxable = Math.round(unitPrice * item.quantity * 100) / 100;
    taxableSubtotal += lineTaxable;

    let itemCgst = 0;
    let itemSgst = 0;
    let itemIgst = 0;

    if (isInterState) {
      itemIgst = Math.round(lineTaxable * gstRate * 100) / 100;
      igstTotal += itemIgst;
    } else {
      itemCgst = Math.round(lineTaxable * (gstRate / 2) * 100) / 100;
      itemSgst = Math.round(lineTaxable * (gstRate / 2) * 100) / 100;
      cgstTotal += itemCgst;
      sgstTotal += itemSgst;
    }

    const lineTotal = lineTaxable + itemCgst + itemSgst + itemIgst;

    invoiceItems.push({
      sku: found?.sku || item.sku,
      description: item.description,
      quantity: item.quantity,
      unitPrice,
      totalPrice: lineTotal,
      type: item.description.toLowerCase().includes('courier') || item.description.toLowerCase().includes('shipping') ? 'SHIPPING' : 'PART',
      hsnCode: hsn,
      gstRate,
      taxableValue: lineTaxable,
      cgstAmount: itemCgst,
      sgstAmount: itemSgst,
      igstAmount: itemIgst,
    });
  }

  cgstTotal = Math.round(cgstTotal * 100) / 100;
  sgstTotal = Math.round(sgstTotal * 100) / 100;
  igstTotal = Math.round(igstTotal * 100) / 100;
  taxableSubtotal = Math.round(taxableSubtotal * 100) / 100;
  const taxTotal = Math.round((cgstTotal + sgstTotal + igstTotal) * 100) / 100;
  const totalAmount = Math.round((taxableSubtotal + taxTotal) * 100) / 100;

  const totalInWords = numberToIndianWords(totalAmount);
  const upiId = profile.upiId || 'apexpc@okhdfcbank';
  const upiPaymentString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(profile.name)}&am=${totalAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${invoiceId}`)}`;
  
  // Generate QR Code as PNG Buffer for PDFKit
  const qrPngBuffer = await QRCode.toBuffer(upiPaymentString, {
    width: 140,
    margin: 1,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  });
  const upiQrDataUrl = await QRCode.toDataURL(upiPaymentString, { width: 220 });

  const courierTracking = params.courier_tracking || (isInterState ? `BD-IN-${Date.now().toString().slice(-7)}` : undefined);
  const courierPartner = profile.courierPartner || 'BlueDart Express Air Cargo';

  const pdfFileName = `${invoiceId}.pdf`;
  const pdfFilePath = path.join(INVOICES_DIR, pdfFileName);
  const pdfUrl = `/invoices/${pdfFileName}`;

  // Save in DB
  const invoiceRecord: Invoice = {
    id: invoiceId,
    workOrderId: params.order_id || `ORD-${Date.now().toString().slice(-4)}`,
    clientName,
    clientEmail,
    clientPhone,
    clientAddress,
    equipmentInfo: profile.tradeType === 'PLUMBER'
      ? 'Sanitary & Plumbing Installation / Repair Service'
      : profile.tradeType === 'ELECTRICIAN'
      ? 'Electrical Wiring & Power Distribution Service'
      : profile.tradeType === 'HVAC_TECHNICIAN'
      ? 'HVAC & Appliance Cooling Repair Service'
      : profile.tradeType === 'GARMENT_STORE'
      ? 'Apparel & Readymade Garments Retail'
      : profile.tradeType === 'BOOK_STORE'
      ? 'Books & Educational Publications'
      : 'Custom Built High-Performance PC Rig',
    items: invoiceItems,
    laborHours: 1,
    laborRate: 1500,
    laborTotal: 1500,
    partsTotal: taxableSubtotal,
    subtotal: taxableSubtotal,
    taxRate: 0.18,
    taxAmount: taxTotal,
    totalAmount,
    taxJurisdiction: isInterState ? 'Inter-State Supply (IGST 18%)' : `${profile.state} (CGST 9% + SGST 9%)`,
    taxDisclaimer: isInterState
      ? `Assessed under Section 5 of IGST Act 2017 for inter-state consignment to ${clientAddress.split(',').pop()?.trim() || 'Maharashtra'}.`
      : `Assessed under ${profile.state} Goods and Services Tax Act 2017.`,
    technicianNotes: params.technician_notes || 'All components brand-new in sealed retail boxes. Bench stress-tested 60 minutes.',
    createdAt: new Date().toISOString(),
    status: 'ISSUED',
    pdfFileName,
    paymentUrl: `https://fieldpilot.io/pay/upi/${invoiceId.toLowerCase()}`,
    profileId: profile.id,
    shopName: profile.name,
    shopGstin: profile.gstin,
    shopOwner: profile.ownerName,
    placeOfSupply: isInterState ? 'Maharashtra (27)' : `${profile.state} (${profile.stateCode})`,
    isInterState,
    cgstTotal,
    sgstTotal,
    igstTotal,
    shippingFee: isInterState ? 850 : 0,
    courierPartner: isInterState ? courierPartner : undefined,
    courierTracking,
    upiPaymentString,
    upiQrDataUrl,
    totalInWords,
    currency: 'INR',
    currencySymbol: '₹',
  };

  db.saveInvoice(invoiceRecord);

  // Render PDF Document
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const writeStream = fs.createWriteStream(pdfFilePath);
    doc.pipe(writeStream);

    // Top Header Banner
    doc.rect(0, 0, 595, 88).fill('#0F172A'); // Slate 900
    doc.fillColor('#F59E0B').fontSize(10).font('Helvetica-Bold').text('TAX INVOICE [RULE 46 OF CGST RULES, 2017]', 36, 18);
    doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold').text(profile.name.toUpperCase(), 36, 32);
    doc.fillColor('#94A3B8').fontSize(8.5).font('Helvetica').text(`${profile.address} • Phone: ${profile.phone}`, 36, 54);
    doc.fillColor('#38BDF8').fontSize(9).font('Helvetica-Bold').text(`GSTIN: ${profile.gstin || '29AABCA1234F1Z5'}  |  State: ${profile.state} (Code: ${profile.stateCode})`, 36, 68);

    doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold').text('ORIGINAL FOR RECIPIENT', 400, 20, { align: 'right' });
    doc.fillColor('#38BDF8').fontSize(11).font('Helvetica-Bold').text(`Invoice #: ${invoiceId}`, 400, 38, { align: 'right' });
    doc.fillColor('#CBD5E1').fontSize(8.5).font('Helvetica').text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 400, 54, { align: 'right' });
    doc.text(`Place of Supply: ${invoiceRecord.placeOfSupply}`, 400, 68, { align: 'right' });

    // Client & Shipping Boxes
    const boxY = 100;
    // Billed To Box
    doc.rect(36, boxY, 255, 68).fill('#F8FAFC');
    doc.rect(36, boxY, 255, 68).stroke('#CBD5E1');
    doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold').text('BILLED TO (BUYER):', 44, boxY + 6);
    doc.fillColor('#334155').fontSize(8.5).font('Helvetica');
    doc.text(clientName, 44, boxY + 18, { width: 240 });
    doc.text(clientAddress, 44, boxY + 30, { width: 240, height: 22 });
    doc.text(`Contact: ${clientPhone} | ${clientEmail}`, 44, boxY + 52, { width: 240 });

    // Shipped To / Courier Dispatch Box
    doc.rect(303, boxY, 256, 68).fill('#F8FAFC');
    doc.rect(303, boxY, 256, 68).stroke('#CBD5E1');
    doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold').text('DISPATCH & COURIER LOGISTICS:', 311, boxY + 6);
    doc.fillColor('#334155').fontSize(8.5).font('Helvetica');
    doc.text(`Mode: Air Cargo Express (Fragile/Insured)`, 311, boxY + 18);
    doc.text(`Courier Partner: ${courierPartner}`, 311, boxY + 30);
    doc.fillColor('#0284C7').font('Helvetica-Bold').text(`Tracking AWB: ${courierTracking || 'N/A (Local Pickup)'}`, 311, boxY + 44);
    doc.fillColor('#64748B').font('Helvetica').text(`Delivery Term: Doorstep Courier Delivery`, 311, boxY + 56);

    // Items Table Header
    const tableTop = 178;
    doc.rect(36, tableTop, 523, 20).fill('#1E293B');
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
    doc.text('SN', 42, tableTop + 6, { width: 18 });
    doc.text('ITEM DESCRIPTION & SPECIFICATION', 64, tableTop + 6, { width: 210 });
    doc.text('HSN/SAC', 280, tableTop + 6, { width: 45, align: 'center' });
    doc.text('QTY', 330, tableTop + 6, { width: 25, align: 'center' });
    doc.text('RATE (₹)', 360, tableTop + 6, { width: 55, align: 'right' });
    doc.text('TAXABLE (₹)', 420, tableTop + 6, { width: 65, align: 'right' });
    doc.text(isInterState ? 'IGST (₹)' : 'GST (₹)', 490, tableTop + 6, { width: 62, align: 'right' });

    let currentY = tableTop + 20;
    doc.font('Helvetica').fontSize(8);

    invoiceItems.forEach((item, idx) => {
      const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(36, currentY, 523, 18).fill(rowBg);

      const taxColAmount = isInterState ? (item.igstAmount || 0) : ((item.cgstAmount || 0) + (item.sgstAmount || 0));

      doc.fillColor('#1E293B');
      doc.text((idx + 1).toString(), 42, currentY + 5, { width: 18 });
      doc.text(item.description, 64, currentY + 5, { width: 210, ellipsis: true });
      doc.text(item.hsnCode || '8471', 280, currentY + 5, { width: 45, align: 'center' });
      doc.text(item.quantity.toString(), 330, currentY + 5, { width: 25, align: 'center' });
      doc.text((item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 360, currentY + 5, { width: 55, align: 'right' });
      doc.text((item.taxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 420, currentY + 5, { width: 65, align: 'right' });
      doc.text(taxColAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 490, currentY + 5, { width: 62, align: 'right' });

      currentY += 18;
    });

    // Total in Words Box & Totals Summary Table
    currentY += 6;
    const totalsTableTop = currentY;

    // Total in Words (Left)
    doc.rect(36, totalsTableTop, 310, 68).fill('#F1F5F9');
    doc.rect(36, totalsTableTop, 310, 68).stroke('#CBD5E1');
    doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text('TOTAL AMOUNT IN WORDS:', 44, totalsTableTop + 8);
    doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold').text(totalInWords, 44, totalsTableTop + 22, { width: 294 });
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica').text('Certified that all components are brand-new genuine retail inventory with original serial numbers.', 44, totalsTableTop + 48, { width: 294 });

    // Financial Breakdown Table (Right)
    const sumX = 354;
    doc.rect(sumX, totalsTableTop, 205, 96).fill('#F8FAFC');
    doc.rect(sumX, totalsTableTop, 205, 96).stroke('#CBD5E1');

    doc.fillColor('#475569').fontSize(8).font('Helvetica');
    doc.text('Taxable Subtotal:', sumX + 8, totalsTableTop + 8);
    doc.fillColor('#1E293B').text(`₹${taxableSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sumX + 110, totalsTableTop + 8, { width: 85, align: 'right' });

    if (isInterState) {
      doc.fillColor('#475569').text('Integrated Tax (IGST 18%):', sumX + 8, totalsTableTop + 22);
      doc.fillColor('#1E293B').text(`₹${igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sumX + 110, totalsTableTop + 22, { width: 85, align: 'right' });
    } else {
      doc.fillColor('#475569').text('Central Tax (CGST 9%):', sumX + 8, totalsTableTop + 22);
      doc.fillColor('#1E293B').text(`₹${cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sumX + 110, totalsTableTop + 22, { width: 85, align: 'right' });

      doc.fillColor('#475569').text('State Tax (SGST 9%):', sumX + 8, totalsTableTop + 34);
      doc.fillColor('#1E293B').text(`₹${sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sumX + 110, totalsTableTop + 34, { width: 85, align: 'right' });
    }

    doc.fillColor('#475569').text('Total Tax Amount:', sumX + 8, totalsTableTop + 48);
    doc.fillColor('#1E293B').text(`₹${taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sumX + 110, totalsTableTop + 48, { width: 85, align: 'right' });

    // Grand Total Bar
    doc.rect(sumX, totalsTableTop + 64, 205, 32).fill('#0F172A');
    doc.fillColor('#F59E0B').fontSize(8.5).font('Helvetica-Bold').text('TOTAL INVOICE VALUE:', sumX + 8, totalsTableTop + 72);
    doc.fillColor('#FFFFFF').fontSize(13).font('Helvetica-Bold').text(`₹${totalAmount.toLocaleString('en-IN')}`, sumX + 90, totalsTableTop + 72, { width: 105, align: 'right' });

    // UPI Payment & Bank Settlement Block (Left bottom)
    const upiY = totalsTableTop + 80;
    doc.rect(36, upiY, 310, 100).fill('#EFF6FF');
    doc.rect(36, upiY, 310, 100).stroke('#BFDBFE');

    // Embed Scannable UPI QR Code Image
    doc.image(qrPngBuffer, 44, upiY + 8, { width: 82, height: 82 });

    doc.fillColor('#1E3A8A').fontSize(8.5).font('Helvetica-Bold').text('INSTANT UPI SETTLEMENT (ZERO FEE)', 136, upiY + 10);
    doc.fillColor('#2563EB').fontSize(8).font('Helvetica-Bold').text(`VPA / UPI ID: ${upiId}`, 136, upiY + 24);
    doc.fillColor('#475569').fontSize(7.5).font('Helvetica');
    doc.text(`Bank: ${profile.bankDetails?.bankName || 'HDFC Bank'}`, 136, upiY + 38);
    doc.text(`A/C: ${profile.bankDetails?.accountNumber || '50200084719283'}`, 136, upiY + 50);
    doc.text(`IFSC: ${profile.bankDetails?.ifscCode || 'HDFC0001234'}`, 136, upiY + 62);
    doc.fillColor('#059669').fontSize(7.5).font('Helvetica-Bold').text('Scan with GPay, PhonePe, Paytm, or BHIM', 136, upiY + 76);

    // Signatory Block (Right bottom)
    const signY = upiY + 8;
    doc.rect(354, signY, 205, 92).fill('#FFFFFF');
    doc.rect(354, signY, 205, 92).stroke('#CBD5E1');
    doc.fillColor('#0F172A').fontSize(8).font('Helvetica-Bold').text(`FOR ${profile.name.toUpperCase()}`, 362, signY + 8);
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica').text('Digitally verified and sealed via FieldPilot Voice Engine', 362, signY + 22);
    
    // Signature placeholder line
    doc.moveTo(362, signY + 66).lineTo(540, signY + 66).stroke('#94A3B8');
    doc.fillColor('#0F172A').fontSize(8).font('Helvetica-Bold').text(`Authorised Signatory (${profile.ownerName})`, 362, signY + 72);

    doc.end();

    writeStream.on('finish', () => resolve());
    writeStream.on('error', (err) => reject(err));
  });

  const summaryMessage = `GST Tax Invoice generated: #${invoiceId} for ₹${totalAmount.toLocaleString('en-IN')} with UPI QR code (${upiId}) and ${isInterState ? `BlueDart courier dispatch (${courierTracking})` : 'store receipt'}.`;

  return {
    success: true,
    invoiceId,
    totalAmount,
    pdfUrl,
    pdfFilePath,
    clientName,
    clientEmail,
    upiPaymentString,
    upiQrDataUrl,
    summaryMessage,
  };
}
