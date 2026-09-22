import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { db, Invoice, InvoiceItem } from '../data/mockDb.js';
import { generateGstTaxInvoice } from './gstPdfGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INVOICES_DIR = path.resolve(__dirname, '../../public/invoices');

// Ensure invoices output folder exists
if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

export interface GenerateInvoicePdfParams {
  work_order_id: string;
  technician_notes: string;
  labor_hours: number;
  parts_items: Array<{
    sku?: string;
    description: string;
    quantity: number;
    unit_price?: number;
  }>;
}

export interface GenerateInvoicePdfResult {
  success: boolean;
  invoiceId: string;
  totalAmount: number;
  pdfUrl: string;
  pdfFilePath: string;
  clientName: string;
  clientEmail: string;
  summaryMessage: string;
}

export async function generateInvoicePdf(params: GenerateInvoicePdfParams): Promise<GenerateInvoicePdfResult> {
  const profile = db.getActiveProfile();
  const wo = db.findWorkOrder(params.work_order_id);

  // If active profile uses Indian GST, delegate to generateGstTaxInvoice
  if (profile.taxSystem === 'GST_INDIA') {
    const gstRes = await generateGstTaxInvoice({
      order_id: params.work_order_id,
      client_name: wo ? wo.clientName : 'Customer',
      client_phone: wo?.phone,
      client_email: wo?.email,
      client_address: wo?.address,
      technician_notes: params.technician_notes,
      items: params.parts_items.map((p) => ({
        sku: p.sku,
        description: p.description,
        quantity: p.quantity,
        unit_price: p.unit_price,
      })),
    });
    return {
      success: gstRes.success,
      invoiceId: gstRes.invoiceId,
      totalAmount: gstRes.totalAmount,
      pdfUrl: gstRes.pdfUrl,
      pdfFilePath: gstRes.pdfFilePath,
      clientName: gstRes.clientName,
      clientEmail: gstRes.clientEmail,
      summaryMessage: gstRes.summaryMessage,
    };
  }

  const woId = wo ? wo.id : params.work_order_id;
  const invoiceId = `INV-${woId.replace('WO-', '')}-${Date.now().toString().slice(-4)}`;

  const laborRate = wo ? wo.hourlyRate : 125.0;
  const laborTotal = Math.round(params.labor_hours * laborRate * 100) / 100;

  const items: InvoiceItem[] = [
    {
      description: `Technician Field Labor (${params.labor_hours} hrs @ $${laborRate.toFixed(2)}/hr)`,
      quantity: params.labor_hours,
      unitPrice: laborRate,
      totalPrice: laborTotal,
      type: 'LABOR',
    },
  ];

  let partsTotal = 0;
  for (const p of params.parts_items) {
    let unitPrice = p.unit_price;
    if (!unitPrice && p.sku) {
      const found = db.getAllInventory().find((item) => item.sku === p.sku);
      if (found) unitPrice = found.retailPrice;
    }
    if (!unitPrice) {
      const foundByName = db.findPartByQuery(p.description);
      unitPrice = foundByName ? foundByName.retailPrice : 65.0;
    }

    const lineTotal = Math.round(unitPrice * p.quantity * 100) / 100;
    partsTotal += lineTotal;

    // Deduct stock in truck
    if (p.sku) {
      db.deductInventory(p.sku, p.quantity);
    }

    items.push({
      sku: p.sku,
      description: p.description,
      quantity: p.quantity,
      unitPrice,
      totalPrice: lineTotal,
      type: 'PART',
    });
  }

  const subtotal = Math.round((laborTotal + partsTotal) * 100) / 100;
  const taxRate = typeof profile.customTaxRate === 'number' ? profile.customTaxRate : 0.0825;
  const currencySym = profile.currencySymbol || '$';

  let taxAmount = 0;
  let taxJurisdiction = '';
  let taxDisclaimer = '';

  if (profile.id === 'hvac-fleet') {
    taxAmount = Math.round(partsTotal * taxRate * 100) / 100;
    taxJurisdiction = 'Austin, TX (Travis County - 8.25%)';
    taxDisclaimer = `Sales tax ($${taxAmount.toFixed(2)}) assessed on parts & consumables ($${partsTotal.toFixed(2)} @ 8.25%). Field labor is non-taxable commercial repair per TX Comptroller Rule 3.292.`;
  } else {
    const taxableBase = profile.businessCategory === 'RETAIL_SHOP' ? subtotal : (partsTotal > 0 ? partsTotal : subtotal);
    taxAmount = Math.round(taxableBase * taxRate * 100) / 100;
    taxJurisdiction = profile.customTaxLabel || `${profile.country || 'Local'} Custom Tax (${(taxRate * 100).toFixed(2)}%)`;
    taxDisclaimer = `Tax assessed at ${(taxRate * 100).toFixed(2)}% (${currencySym}${taxAmount.toFixed(2)}) per shopkeeper country tax rate settings for ${profile.name}.`;
  }
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

  const clientName = wo ? wo.clientName : 'Customer';
  const clientEmail = wo ? wo.email : 'billing@customer.com';
  const clientPhone = wo ? wo.phone : 'N/A';
  const clientAddress = wo ? wo.address : (profile.country === 'United Kingdom' ? 'London, UK' : 'United States');
  const equipmentInfo = wo ? `${wo.equipment} (S/N: ${wo.serialNumber})` : (profile.businessCategory === 'RETAIL_SHOP' ? 'Retail & Custom Order' : 'Commercial Service Order');

  const pdfFileName = `${invoiceId}.pdf`;
  const pdfFilePath = path.join(INVOICES_DIR, pdfFileName);
  const pdfUrl = `/invoices/${pdfFileName}`;

  // Build the Invoice record
  const invoiceRecord: Invoice = {
    id: invoiceId,
    workOrderId: woId,
    clientName,
    clientEmail,
    clientPhone,
    clientAddress,
    equipmentInfo,
    items,
    laborHours: params.labor_hours,
    laborRate,
    laborTotal,
    partsTotal,
    subtotal,
    taxRate,
    taxAmount,
    totalAmount,
    taxJurisdiction,
    taxDisclaimer,
    technicianNotes: params.technician_notes,
    createdAt: new Date().toISOString(),
    status: 'ISSUED',
    pdfFileName,
    paymentUrl: `https://fieldpilot.io/pay/${invoiceId.toLowerCase()}`,
    currency: profile.currency,
    currencySymbol: currencySym,
    customTaxRate: profile.customTaxRate,
    customTaxLabel: profile.customTaxLabel,
  };

  // Generate the PDF document with PDFKit
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    const writeStream = fs.createWriteStream(pdfFilePath);

    doc.pipe(writeStream);

    // Primary Header
    doc.rect(0, 0, 612, 100).fill('#0F172A'); // Slate 900 banner

    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text(profile.name.toUpperCase(), 45, 28);
    doc.fillColor('#94A3B8').fontSize(9).font('Helvetica').text(`${profile.businessCategory === 'RETAIL_SHOP' ? 'RETAIL & SHOP' : 'FIELD SERVICE & TRADES'} • ${profile.address}`, 45, 54);
    doc.text(`Phone: ${profile.phone}  |  ${profile.email}`, 45, 68);

    doc.fillColor('#38BDF8').fontSize(24).font('Helvetica-Bold').text('INVOICE', 450, 30, { align: 'right' });
    doc.fillColor('#E2E8F0').fontSize(11).font('Helvetica').text(`#${invoiceId}`, 450, 58, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString('en-US')}`, 450, 72, { align: 'right' });

    // Job & Client Information Box
    doc.moveDown(3);
    const infoTop = 120;

    // Bill To
    doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('BILLED TO:', 45, infoTop);
    doc.fillColor('#334155').fontSize(10).font('Helvetica');
    doc.text(clientName, 45, infoTop + 16);
    doc.text(clientAddress, 45, infoTop + 30);
    doc.text(`Attn: ${wo ? wo.contactPerson : 'Manager'} (${clientPhone})`, 45, infoTop + 44);
    doc.text(`Email: ${clientEmail}`, 45, infoTop + 58);

    // Service & Equipment
    doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('SERVICE DETAILS:', 320, infoTop);
    doc.fillColor('#334155').fontSize(10).font('Helvetica');
    doc.text(`Work Order: ${woId}`, 320, infoTop + 16);
    doc.text(`Equipment: ${equipmentInfo}`, 320, infoTop + 30, { width: 245 });
    doc.text(`Technician Closeout: Verbal Sign-Off (FieldPilot)`, 320, infoTop + 58);

    // Diagnostic & Technician Notes
    const notesTop = 205;
    doc.rect(40, notesTop, 532, 50).fill('#F8FAFC');
    doc.rect(40, notesTop, 532, 50).stroke('#CBD5E1');

    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold').text('TECHNICIAN DIAGNOSTIC & REPAIR NOTES:', 50, notesTop + 8);
    doc.fillColor('#1E293B').fontSize(9).font('Helvetica').text(params.technician_notes, 50, notesTop + 22, {
      width: 512,
      lineGap: 2,
    });

    // Line Items Table Header
    const tableTop = 270;
    doc.rect(40, tableTop, 532, 24).fill('#1E293B');
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
    doc.text('ITEM / SERVICE DESCRIPTION', 50, tableTop + 7);
    doc.text('QTY', 340, tableTop + 7, { width: 40, align: 'center' });
    doc.text('UNIT PRICE', 400, tableTop + 7, { width: 70, align: 'right' });
    doc.text('TOTAL', 490, tableTop + 7, { width: 70, align: 'right' });

    let currentY = tableTop + 24;
    doc.font('Helvetica').fontSize(9);

    items.forEach((item, index) => {
      const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(40, currentY, 532, 22).fill(rowBg);

      doc.fillColor('#1E293B').text(item.description, 50, currentY + 6, { width: 280 });
      doc.text(item.quantity.toString(), 340, currentY + 6, { width: 40, align: 'center' });
      doc.text(`${currencySym}${item.unitPrice.toFixed(2)}`, 400, currentY + 6, { width: 70, align: 'right' });
      doc.text(`${currencySym}${item.totalPrice.toFixed(2)}`, 490, currentY + 6, { width: 70, align: 'right' });

      currentY += 22;
    });

    // Summary Totals
    currentY += 15;
    const totalsLeft = 340;

    doc.rect(totalsLeft, currentY, 232, 85).fill('#F1F5F9');
    doc.rect(totalsLeft, currentY, 232, 85).stroke('#CBD5E1');

    doc.fillColor('#475569').font('Helvetica').fontSize(9);
    doc.text('Labor Subtotal:', totalsLeft + 15, currentY + 10);
    doc.fillColor('#1E293B').text(`${currencySym}${laborTotal.toFixed(2)}`, 490, currentY + 10, { width: 70, align: 'right' });

    doc.fillColor('#475569').text('Items & Materials:', totalsLeft + 15, currentY + 25);
    doc.fillColor('#1E293B').text(`${currencySym}${partsTotal.toFixed(2)}`, 490, currentY + 25, { width: 70, align: 'right' });

    const taxLabelText = profile.id === 'hvac-fleet'
      ? 'Sales Tax (8.25% on parts):'
      : `${(profile.customTaxLabel || 'Tax').slice(0, 22)}:`;

    doc.fillColor('#475569').text(taxLabelText, totalsLeft + 15, currentY + 40);
    doc.fillColor('#1E293B').text(`${currencySym}${taxAmount.toFixed(2)}`, 490, currentY + 40, { width: 70, align: 'right' });

    doc.rect(totalsLeft, currentY + 56, 232, 29).fill('#0F172A');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL DUE:', totalsLeft + 15, currentY + 64);
    doc.fillColor('#38BDF8').text(`${currencySym}${totalAmount.toFixed(2)}`, 470, currentY + 64, { width: 90, align: 'right' });

    // Tax Compliance Footnote
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica').text(`Tax Compliance Note: ${taxDisclaimer}`, 45, currentY + 92, { width: 520 });

    // Footer & Payment Information
    const footerY = 650;
    doc.rect(40, footerY, 532, 60).stroke('#E2E8F0');
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9).text('PAYMENT TERMS & ONLINE CHECKOUT:', 50, footerY + 10);
    doc.fillColor('#64748B').font('Helvetica').fontSize(8);
    doc.text(
      'Payment is due upon receipt. Instant payment available by card, ACH, or commercial fleet account via secure link:\n' +
        `Secure Portal: https://fieldpilot.io/pay/${invoiceId.toLowerCase()} | Reference: ${invoiceId}`,
      50,
      footerY + 24,
      { width: 512, lineGap: 3 }
    );

    doc.fillColor('#94A3B8').fontSize(8).text('Generated autonomously by FieldPilot Voice Agent Engine for AssemblyAI Hackathon 2026', 45, 740, {
      align: 'center',
    });

    doc.end();

    writeStream.on('finish', () => resolve());
    writeStream.on('error', (err) => reject(err));
  });

  // Save to database
  db.saveInvoice(invoiceRecord);

  // Mark work order completed
  db.updateWorkOrder(woId, {
    status: 'COMPLETED',
    completedAt: new Date().toISOString(),
    resolutionNotes: params.technician_notes,
    invoiceId,
  });

  const summaryMessage = `Invoice ${invoiceId} generated successfully for ${clientName}. Total billed: $${totalAmount.toFixed(2)}. PDF stored and ready for instant dispatch.`;

  return {
    success: true,
    invoiceId,
    totalAmount,
    pdfUrl,
    pdfFilePath,
    clientName,
    clientEmail,
    summaryMessage,
  };
}
