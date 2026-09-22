import { db, InvoiceItem, AuditEntry } from '../data/mockDb.js';

export interface CalculateBillingParams {
  work_order_id: string;
  labor_hours: number;
  parts_items?: Array<{
    sku?: string;
    description: string;
    quantity: number;
    unit_price?: number;
  }>;
  custom_notes?: string;
  part_match_details?: Array<{
    requestedName: string;
    matchedSku: string;
    matchConfidence: number;
  }>;
}

export interface CalculateBillingResult {
  workOrderId: string;
  clientName: string;
  laborHours: number;
  laborRate: number;
  laborTotal: number;
  partsTotal: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  taxJurisdiction: string;
  taxDisclaimer: string;
  itemizedLines: InvoiceItem[];
  voiceReadbackScript: string;
  auditLog: AuditEntry[];
  currency?: 'INR' | 'USD' | 'EUR' | 'GBP';
  currencySymbol?: string;
  customTaxRate?: number;
  customTaxLabel?: string;
  isInterState?: boolean;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
}

export async function calculateBillingAndReadback(params: CalculateBillingParams): Promise<CalculateBillingResult> {
  const profile = db.getActiveProfile();
  const wo = db.findWorkOrder(params.work_order_id);
  const isIndianGst = profile.taxSystem === 'GST_INDIA';
  const currencySymbol = profile.currencySymbol || (isIndianGst ? '₹' : '$');
  const currency = profile.currency || (isIndianGst ? 'INR' : 'USD');

  let defaultLaborRate = 125.0;
  if (isIndianGst) {
    if (profile.tradeType === 'PLUMBER') {
      defaultLaborRate = 800.0;
    } else if (profile.tradeType === 'ELECTRICIAN') {
      defaultLaborRate = 750.0;
    } else if (profile.tradeType === 'HVAC_TECHNICIAN') {
      defaultLaborRate = 850.0;
    } else {
      defaultLaborRate = 750.0;
    }
  }
  const laborRate = wo ? wo.hourlyRate : defaultLaborRate;
  const clientName = wo ? wo.clientName : 'Customer';

  const auditLog: AuditEntry[] = [];
  const now = () => new Date().toISOString();

  // Audit: Utterance capture for labor or services
  auditLog.push({
    timestamp: now(),
    eventType: 'UTTERANCE_CAPTURED',
    source: 'technician',
    detail: isIndianGst
      ? `Reported ${params.labor_hours} hours assembly / technical service for order ${params.work_order_id}`
      : `Technician reported ${params.labor_hours} hours labor for work order ${params.work_order_id}`,
    rawData: { laborHours: params.labor_hours, workOrderId: params.work_order_id, profile: profile.name },
  });

  const laborTotal = Math.round(params.labor_hours * laborRate * 100) / 100;
  const itemizedLines: InvoiceItem[] = [];

  // Determine inter-state vs intra-state for Indian GST based on seller & buyer location
  let isInterState = false;
  const clientLocationStr = `${wo ? wo.address : ''} ${params.custom_notes || ''}`.toLowerCase();
  if (isIndianGst) {
    const profileState = (profile.state || '').toLowerCase();
    if (
      clientLocationStr.includes('interstate') ||
      clientLocationStr.includes('inter-state') ||
      clientLocationStr.includes('courier')
    ) {
      isInterState = true;
    } else if (clientLocationStr.includes('mumbai') || clientLocationStr.includes('maharashtra')) {
      isInterState = profileState !== 'maharashtra';
    } else if (clientLocationStr.includes('delhi')) {
      isInterState = profileState !== 'delhi';
    } else if (
      clientLocationStr.includes('bengaluru') ||
      clientLocationStr.includes('bangalore') ||
      clientLocationStr.includes('karnataka')
    ) {
      isInterState = profileState !== 'karnataka';
    } else if (clientLocationStr.includes('kolkata') || clientLocationStr.includes('west bengal')) {
      isInterState = profileState !== 'west bengal';
    } else if (clientLocationStr.includes('hyderabad') || clientLocationStr.includes('telangana')) {
      isInterState = profileState !== 'telangana';
    } else if (clientLocationStr.includes('chennai') || clientLocationStr.includes('tamil nadu')) {
      isInterState = profileState !== 'tamil nadu';
    }
  }

  // Add Labor line item if laborHours > 0
  if (params.labor_hours > 0) {
    const laborHsn = isIndianGst ? '9954' : undefined;
    const laborGstRate = isIndianGst ? 0.18 : 0;
    const laborCgst = (!isInterState && isIndianGst) ? Math.round(laborTotal * 0.09 * 100) / 100 : 0;
    const laborSgst = (!isInterState && isIndianGst) ? Math.round(laborTotal * 0.09 * 100) / 100 : 0;
    const laborIgst = (isInterState && isIndianGst) ? Math.round(laborTotal * 0.18 * 100) / 100 : 0;

    let laborDescription = '';
    if (isIndianGst) {
      if (profile.tradeType === 'PLUMBER') {
        laborDescription = `Master Plumber Pipe Fitting & Diagnostic Service (${params.labor_hours} hrs @ ${currencySymbol}${laborRate.toFixed(0)}/hr)`;
      } else if (profile.tradeType === 'ELECTRICIAN') {
        laborDescription = `Licensed Electrician Circuit Diagnostic & Panel Wiring (${params.labor_hours} hrs @ ${currencySymbol}${laborRate.toFixed(0)}/hr)`;
      } else if (profile.tradeType === 'HVAC_TECHNICIAN') {
        laborDescription = `HVAC & Appliance Diagnostic & Repair Labor (${params.labor_hours} hrs @ ${currencySymbol}${laborRate.toFixed(0)}/hr)`;
      } else {
        laborDescription = `Custom PC Assembly, Cable Routing & Benchmark Stress Test (${params.labor_hours} hrs @ ${currencySymbol}${laborRate.toFixed(0)}/hr)`;
      }
    } else {
      if (profile.id === 'hvac-fleet') {
        laborDescription = `Technician Field Labor (${params.labor_hours} hrs @ $${laborRate.toFixed(2)}/hr)`;
      } else if (profile.tradeType === 'PLUMBER') {
        laborDescription = `Master Plumber Diagnostic & Pipe Fitting Labor (${params.labor_hours} hrs @ ${currencySymbol}${laborRate.toFixed(2)}/hr)`;
      } else if (profile.tradeType === 'ELECTRICIAN') {
        laborDescription = `Certified Electrician Diagnostic & Wiring Labor (${params.labor_hours} hrs @ ${currencySymbol}${laborRate.toFixed(2)}/hr)`;
      } else if (profile.tradeType === 'PC_BUILDER') {
        laborDescription = `Custom PC Rig Assembly & Benchmarking Labor (${params.labor_hours} hrs @ ${currencySymbol}${laborRate.toFixed(2)}/hr)`;
      } else {
        laborDescription = `Service & Field Labor (${params.labor_hours} hrs @ ${currencySymbol}${laborRate.toFixed(2)}/hr)`;
      }
    }

    itemizedLines.push({
      description: laborDescription,
      quantity: params.labor_hours,
      unitPrice: laborRate,
      totalPrice: laborTotal,
      type: 'LABOR',
      hsnCode: laborHsn,
      gstRate: laborGstRate,
      taxableValue: laborTotal,
      cgstAmount: laborCgst,
      sgstAmount: laborSgst,
      igstAmount: laborIgst,
    });
  }

  let partsTotal = 0;
  let cgstTotal = itemizedLines.reduce((sum, item) => sum + (item.cgstAmount || 0), 0);
  let sgstTotal = itemizedLines.reduce((sum, item) => sum + (item.sgstAmount || 0), 0);
  let igstTotal = itemizedLines.reduce((sum, item) => sum + (item.igstAmount || 0), 0);

  if (params.parts_items && params.parts_items.length > 0) {
    for (let i = 0; i < params.parts_items.length; i++) {
      const p = params.parts_items[i];
      let unitPrice = p.unit_price;
      let resolvedHsn = '8471';
      let resolvedGstRate = 0.18;

      // Try finding in catalog first
      const catalogFound = p.sku ? db.getCatalogItem(p.sku) : db.findCatalogItemByQuery(p.description);
      if (catalogFound) {
        if (!unitPrice) unitPrice = catalogFound.basePrice;
        resolvedHsn = catalogFound.hsnCode;
        resolvedGstRate = catalogFound.gstRate;
      }

      // Try truck inventory fallback
      if (!unitPrice && p.sku) {
        const found = db.getAllInventory().find((item) => item.sku === p.sku);
        if (found) {
          unitPrice = found.retailPrice;
          if (found.hsnCode) resolvedHsn = found.hsnCode;
          if (typeof found.gstRate === 'number') resolvedGstRate = found.gstRate;
        }
      }
      if (!unitPrice) {
        const foundByName = db.findPartByQuery(p.description);
        unitPrice = foundByName ? foundByName.retailPrice : (isIndianGst ? 4500.0 : 65.0);
        if (foundByName?.hsnCode) resolvedHsn = foundByName.hsnCode;
        if (typeof foundByName?.gstRate === 'number') resolvedGstRate = foundByName.gstRate;
      }

      // Audit: SKU match with confidence score
      const matchDetail = params.part_match_details?.find((d) => d.matchedSku === p.sku);
      auditLog.push({
        timestamp: now(),
        eventType: 'SKU_MATCHED',
        source: 'system',
        detail: `"${matchDetail?.requestedName ?? p.description}" → ${p.sku ?? 'CATALOG'} (${p.description})`,
        confidence: matchDetail?.matchConfidence ?? (p.sku ? 0.96 : 0.88),
        isCritical: true,
        rawData: {
          requestedName: matchDetail?.requestedName ?? p.description,
          resolvedSku: p.sku,
          resolvedName: p.description,
          hsnCode: resolvedHsn,
          deterministicUnitPrice: unitPrice,
          gstRate: resolvedGstRate,
          quantity: p.quantity,
          note: 'Price resolved from active business catalog by deterministic code — LLM only matched intent',
        },
      });

      const lineTotal = Math.round(unitPrice * p.quantity * 100) / 100;
      partsTotal += lineTotal;

      let itemCgst = 0;
      let itemSgst = 0;
      let itemIgst = 0;

      if (isIndianGst) {
        if (isInterState) {
          itemIgst = Math.round(lineTotal * resolvedGstRate * 100) / 100;
          igstTotal += itemIgst;
        } else {
          itemCgst = Math.round(lineTotal * (resolvedGstRate / 2) * 100) / 100;
          itemSgst = Math.round(lineTotal * (resolvedGstRate / 2) * 100) / 100;
          cgstTotal += itemCgst;
          sgstTotal += itemSgst;
        }
      }

      itemizedLines.push({
        sku: p.sku,
        description: p.description,
        quantity: p.quantity,
        unitPrice,
        totalPrice: lineTotal,
        type: p.description.toLowerCase().includes('courier') || p.description.toLowerCase().includes('shipping') ? 'SHIPPING' : 'PART',
        hsnCode: resolvedHsn,
        gstRate: resolvedGstRate,
        taxableValue: lineTotal,
        cgstAmount: itemCgst,
        sgstAmount: itemSgst,
        igstAmount: itemIgst,
      });
    }
  }

  const subtotal = Math.round((laborTotal + partsTotal) * 100) / 100;
  let taxRate = 0.0825;
  let taxAmount = 0;
  let totalAmount = 0;
  let taxJurisdiction = '';
  let taxDisclaimer = '';
  let voiceReadbackScript = '';

  if (isIndianGst) {
    cgstTotal = Math.round(cgstTotal * 100) / 100;
    sgstTotal = Math.round(sgstTotal * 100) / 100;
    igstTotal = Math.round(igstTotal * 100) / 100;
    taxAmount = Math.round((cgstTotal + sgstTotal + igstTotal) * 100) / 100;
    totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    taxRate = isInterState ? 0.18 : 0.18;
    if (isInterState) {
      taxJurisdiction = 'Inter-State Supply (IGST 18%)';
      taxDisclaimer = `IGST assessed at 18% (₹${igstTotal.toLocaleString('en-IN')}) for inter-state courier supply to Mumbai/Maharashtra under Section 5 of IGST Act 2017.`;
    } else {
      taxJurisdiction = `${profile.state} (Intra-State: CGST 9% + SGST 9%)`;
      taxDisclaimer = `Intra-state GST assessed as CGST 9% (₹${cgstTotal.toLocaleString('en-IN')}) + SGST 9% (₹${sgstTotal.toLocaleString('en-IN')}) under ${profile.state} GST Act.`;
    }

    voiceReadbackScript = `Total order comes out to ₹${totalAmount.toLocaleString('en-IN')}. That's a taxable subtotal of ₹${subtotal.toLocaleString('en-IN')} across items and services, plus ₹${taxAmount.toLocaleString('en-IN')} in ${isInterState ? 'IGST (18%)' : 'GST (CGST+SGST)'}. Shall I generate the GST Tax Invoice and display the UPI payment QR code for ${clientName}?`;
  } else {
    // Other / Global Countries (Tax set by shopkeeper according to their country)
    const customRate = typeof profile.customTaxRate === 'number' ? profile.customTaxRate : 0.0825;
    taxRate = customRate;

    if (profile.id === 'hvac-fleet') {
      // US Trade HVAC (Travis County, TX - 8.25% parts-only sales tax)
      taxAmount = Math.round(partsTotal * taxRate * 100) / 100;
      totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      taxJurisdiction = 'Austin, TX (Travis County - 8.25%)';
      taxDisclaimer = `Sales tax ($${taxAmount.toFixed(2)}) is assessed strictly on taxable parts & consumables ($${partsTotal.toFixed(2)} @ 8.25%). Technician field labor ($${laborTotal.toFixed(2)}) is non-taxable commercial repair service per TX Comptroller Rule 3.292.`;

      const hoursString = params.labor_hours === 1 ? '1 hour' : `${params.labor_hours} hours`;
      voiceReadbackScript = `Total comes out to $${totalAmount.toFixed(2)}. That's ${hoursString} of labor at $${laborTotal.toFixed(2)}, plus $${partsTotal.toFixed(2)} for parts, and $${taxAmount.toFixed(2)} in tax. Shall I generate the PDF invoice and send it to ${clientName}?`;
    } else {
      // General shopkeeper custom tax according to their country
      const taxableBase = profile.businessCategory === 'RETAIL_SHOP' ? subtotal : (partsTotal > 0 ? partsTotal : subtotal);
      taxAmount = Math.round(taxableBase * taxRate * 100) / 100;
      totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      taxJurisdiction = profile.customTaxLabel || `${profile.country || 'Local'} Custom Tax (${(taxRate * 100).toFixed(2)}%)`;
      taxDisclaimer = `Tax assessed at ${(taxRate * 100).toFixed(2)}% (${currencySymbol}${taxAmount.toFixed(2)}) per shopkeeper country tax rate settings for ${profile.name}.`;

      const hoursString = params.labor_hours === 1 ? '1 hour' : `${params.labor_hours} hours`;
      voiceReadbackScript = `Total comes out to ${currencySymbol}${totalAmount.toFixed(2)}. That's ${params.labor_hours > 0 ? `${hoursString} of labor at ${currencySymbol}${laborTotal.toFixed(2)}, plus ` : ''}${currencySymbol}${partsTotal.toFixed(2)} for items, and ${currencySymbol}${taxAmount.toFixed(2)} in ${taxJurisdiction}. Shall I generate the invoice and send it to ${clientName}?`;
    }
  }

  // Audit: Billing calculated (deterministic price lock)
  auditLog.push({
    timestamp: now(),
    eventType: 'BILLING_CALCULATED',
    source: 'system',
    detail: isIndianGst
      ? `Deterministic total locked at ₹${totalAmount.toLocaleString('en-IN')} (subtotal ₹${subtotal.toLocaleString('en-IN')} + ${isInterState ? `IGST ₹${igstTotal.toLocaleString('en-IN')}` : `CGST ₹${cgstTotal.toLocaleString('en-IN')} + SGST ₹${sgstTotal.toLocaleString('en-IN')}`})`
      : `Deterministic total locked at ${currencySymbol}${totalAmount.toFixed(2)} (labor ${currencySymbol}${laborTotal.toFixed(2)} + parts ${currencySymbol}${partsTotal.toFixed(2)} + tax ${currencySymbol}${taxAmount.toFixed(2)})`,
    isCritical: true,
    rawData: {
      profile: profile.name,
      currency,
      subtotal,
      partsTotal,
      laborTotal,
      taxRate,
      taxAmount,
      customTaxRate: profile.customTaxRate,
      customTaxLabel: profile.customTaxLabel,
      cgstTotal,
      sgstTotal,
      igstTotal,
      totalAmount,
      taxJurisdiction,
      taxDisclaimer,
      lineCount: itemizedLines.length,
      note: 'All arithmetic performed by server-side code. LLM receives final totals read-only.',
    },
  });

  return {
    workOrderId: wo ? wo.id : params.work_order_id,
    clientName,
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
    itemizedLines,
    voiceReadbackScript,
    auditLog,
    currency,
    currencySymbol,
    customTaxRate: profile.customTaxRate,
    customTaxLabel: profile.customTaxLabel,
    isInterState,
    cgstTotal,
    sgstTotal,
    igstTotal,
  };
}
