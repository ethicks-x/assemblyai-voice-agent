import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../src/data/mockDb.js';
import { lookupWorkOrder } from '../src/tools/lookupWorkOrder.js';
import { checkTruckInventory } from '../src/tools/inventory.js';
import { calculateBillingAndReadback } from '../src/tools/billing.js';
import { generateInvoicePdf } from '../src/tools/pdfGenerator.js';
import { sendCustomerNotification } from '../src/tools/notification.js';
import { getNextJobAndRoute } from '../src/tools/routing.js';
import { runFullERPSync, getERPSyncSummary } from '../src/integrations/erpSync.js';
import { addOrUpdateCatalogItem } from '../src/tools/manageCatalog.js';
import { generateGstTaxInvoice } from '../src/tools/gstPdfGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 Starting FieldPilot Tool Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // Test 1: lookupWorkOrder
  console.log('Test 1: lookupWorkOrder()');
  const wo1 = await lookupWorkOrder({ query: 'Johnson Cold Storage' });
  assert(wo1.found === true, 'Finds work order by client name');
  assert(wo1.workOrder?.id === 'WO-1042', 'Resolves to WO-1042');
  assert(wo1.workOrder?.equipment.includes('Carrier'), 'Retrieves correct equipment');

  const woNotFound = await lookupWorkOrder({ query: 'Unknown Pizza Shop' });
  assert(woNotFound.found === false, 'Handles non-existent work order gracefully');

  // Test 2: checkTruckInventory
  console.log('\nTest 2: checkTruckInventory()');
  const invResult = await checkTruckInventory({
    parts_used: [
      { part_name: 'dual run capacitor 45 microfarad', quantity: 1 },
      { part_name: '24 volt contactor', quantity: 1 },
    ],
  });
  assert(invResult.allFound === true, 'Matches both spoken parts to inventory');
  assert(invResult.parts.length === 2, 'Contains 2 matched parts');
  assert(invResult.parts[0].matchedSku === 'CAP-45-5', 'Identifies capacitor SKU CAP-45-5');
  assert(invResult.totalPartsAmount === 260, 'Calculates correct parts subtotal ($165 + $95 = $260)');

  // Test 3: calculateBillingAndReadback
  console.log('\nTest 3: calculateBillingAndReadback()');
  const billResult = await calculateBillingAndReadback({
    work_order_id: 'WO-1042',
    labor_hours: 2,
    parts_items: invResult.parts.map((p) => ({
      sku: p.matchedSku,
      description: p.officialName,
      quantity: p.quantityRequested,
      unit_price: p.retailUnitPrice,
    })),
  });
  // 2 hrs * $125 = $250 labor; $260 parts; subtotal $510; tax 8.25% of 260 = $21.45; total = $531.45
  assert(billResult.laborTotal === 250, 'Calculates labor total ($250.00)');
  assert(billResult.partsTotal === 260, 'Calculates parts total ($260.00)');
  assert(billResult.totalAmount === 531.45, 'Calculates total amount with tax ($531.45)');
  assert(billResult.voiceReadbackScript.includes('$531.45'), 'Generates clear phonetic readback script');
  assert(billResult.taxJurisdiction.includes('Austin, TX'), 'Specifies tax jurisdiction (Austin, TX)');
  assert(billResult.taxDisclaimer.includes('Rule 3.292'), 'Provides TX Comptroller Rule 3.292 tax disclaimer');

  // Test 4: generateInvoicePdf
  console.log('\nTest 4: generateInvoicePdf()');
  const stockBefore = db.getAllInventory().find((i) => i.sku === 'CAP-45-5')?.truckStock || 0;

  const pdfResult = await generateInvoicePdf({
    work_order_id: 'WO-1042',
    technician_notes: 'Replaced failed dual run capacitor and pitted contactor. Verified 18F temp split.',
    labor_hours: 2,
    parts_items: [
      { sku: 'CAP-45-5', description: 'Titan HD 45/5 MFD Dual Run Capacitor', quantity: 1, unit_price: 165 },
      { sku: 'CONT-24V-40A', description: 'Siemens 2-Pole 40A Contactor', quantity: 1, unit_price: 95 },
    ],
  });

  assert(pdfResult.success === true, 'PDF generation reports success');
  assert(fs.existsSync(pdfResult.pdfFilePath), 'PDF file physically exists on disk');
  const stats = fs.statSync(pdfResult.pdfFilePath);
  assert(stats.size > 2000, `PDF file has valid non-empty byte size (${stats.size} bytes)`);

  const stockAfter = db.getAllInventory().find((i) => i.sku === 'CAP-45-5')?.truckStock || 0;
  assert(stockAfter === stockBefore - 1, 'Deducted truck inventory stock');

  const updatedWO = db.getWorkOrder('WO-1042');
  assert(updatedWO?.status === 'COMPLETED', 'Work order status updated to COMPLETED');

  // Test 5: sendCustomerNotification
  console.log('\nTest 5: sendCustomerNotification()');
  const notifResult = await sendCustomerNotification({
    invoice_id: pdfResult.invoiceId,
    method: 'both',
  });
  assert(notifResult.sent === true, 'Notification dispatched successfully');
  assert(notifResult.paymentUrl.includes(pdfResult.invoiceId.toLowerCase()), 'Payment URL contains invoice ID');
  assert(notifResult.smsContent?.includes('Apex Commercial HVAC'), 'SMS text properly formulated');

  // Test 6: getNextJobAndRoute
  console.log('\nTest 6: getNextJobAndRoute()');
  const routeResult = await getNextJobAndRoute({
    current_work_order_id: 'WO-1042',
  });
  assert(routeResult.hasNextJob === true, 'Identifies next scheduled service ticket');
  assert(routeResult.nextJob?.id === 'WO-1043', 'Routes to Metro 24 Diner (WO-1043)');
  assert(routeResult.nextJob?.distanceMiles === 12.4, 'Calculates distance (12.4 miles)');
  assert(routeResult.nextJob?.estimatedTransitMins === 18, 'Calculates transit duration (18 mins)');
  assert(routeResult.spokenSummary.includes('Metro 24 Diner'), 'Generates conversational spoken route briefing');

  // Test 7: Customer Checkout Portal & Settlement
  console.log('\nTest 7: Customer Checkout & Payment Settlement');
  const invRecord = db.findInvoice(pdfResult.invoiceId);
  assert(invRecord !== undefined, 'Finds invoice by ID in database');
  assert(invRecord?.status === 'SENT', 'Initial status before checkout is SENT');

  // Simulate payment processing
  invRecord!.status = 'PAID';
  const txId = `TX-APEX-${Date.now().toString().slice(-6)}`;
  assert(invRecord?.status === 'PAID', 'Updates invoice status to PAID upon checkout settlement');
  assert(txId.startsWith('TX-APEX-'), 'Generates valid merchant transaction ID');

  // Test 8: ServiceTitan & QuickBooks ERP Sync
  console.log('\nTest 8: ServiceTitan & QuickBooks Online ERP Sync');
  const erpSummary = await runFullERPSync(invRecord!);
  assert(erpSummary.overallStatus === 'SYNCED', 'Dual-ERP sync status is SYNCED');
  assert(erpSummary.serviceTitan.status === 'SYNCED', 'ServiceTitan V2 status is SYNCED');
  assert(erpSummary.serviceTitan.serviceTitanJobId.startsWith('ST-JOB-'), 'ServiceTitan generated valid Job ID');
  assert(erpSummary.serviceTitan.payloadSent.jobId === 'WO-1042', 'ServiceTitan payload includes WO-1042');
  assert(erpSummary.quickbooks.status === 'RECONCILED', 'QuickBooks Online status is RECONCILED');
  assert(erpSummary.quickbooks.quickbooksDocNumber.startsWith('QB-INV-'), 'QuickBooks generated valid Doc Number');
  assert(erpSummary.quickbooks.journalEntryId.startsWith('GL-TX-'), 'QuickBooks generated GL transaction ID');
  assert(erpSummary.quickbooks.payloadSent.paymentStatus.includes('PAID'), 'QuickBooks captures PAID status');
  assert(erpSummary.serviceTitan.adapterMode === 'SANDBOX_RFC_VALIDATED', 'ServiceTitan adapter mode is SANDBOX_RFC_VALIDATED');
  assert(erpSummary.serviceTitan.schemaValidation.rfcCompliant === true, 'ServiceTitan schema is marked RFC compliant');
  assert(erpSummary.serviceTitan.schemaValidation.validationStatus === 'PASSED', 'ServiceTitan schema validation passed');
  assert(erpSummary.quickbooks.adapterMode === 'SANDBOX_RFC_VALIDATED', 'QuickBooks adapter mode is SANDBOX_RFC_VALIDATED');
  assert(erpSummary.quickbooks.schemaValidation.validationStatus === 'PASSED', 'QuickBooks schema validation passed');
  assert(erpSummary.quickbooks.schemaValidation.targetEndpoint.includes('quickbooks.api.intuit.com'), 'QuickBooks targets standard V3 REST endpoint');

  const cachedSummary = getERPSyncSummary(invRecord!.id);
  assert(cachedSummary !== undefined, 'ERP record successfully stored in cache');
  assert(cachedSummary?.invoiceId === invRecord!.id, 'Cached ERP record matches invoice ID');

  // Test 9: Evidence-Locked Audit Trail & Confidence Scoring
  console.log('\nTest 9: Evidence-Locked Audit Trail & Match Confidence');

  // 9a: Inventory match confidence scoring
  const invResultWithConf = await checkTruckInventory({
    parts_used: [
      { part_name: 'dual run capacitor 45 microfarad', quantity: 1 },
      { part_name: 'viper flush', quantity: 1 },
    ],
  });
  assert(
    typeof invResultWithConf.parts[0].matchConfidence === 'number',
    'Inventory match returns numeric confidence score'
  );
  assert(
    invResultWithConf.parts[0].matchConfidence > 0.8,
    `Capacitor alias match confidence > 0.8 (got ${invResultWithConf.parts[0].matchConfidence})`
  );
  assert(
    invResultWithConf.parts[1].matchConfidence > 0.8,
    `Viper flush alias match confidence > 0.8 (got ${invResultWithConf.parts[1].matchConfidence})`
  );

  // 9b: Billing generates audit trail entries
  const billWithAudit = await calculateBillingAndReadback({
    work_order_id: 'WO-1042',
    labor_hours: 2.25,
    parts_items: invResultWithConf.parts.map((p) => ({
      sku: p.matchedSku,
      description: p.officialName,
      quantity: p.quantityRequested,
      unit_price: p.retailUnitPrice,
    })),
    part_match_details: invResultWithConf.parts.map((p) => ({
      requestedName: p.requestedName,
      matchedSku: p.matchedSku,
      matchConfidence: p.matchConfidence,
    })),
  });
  assert(Array.isArray(billWithAudit.auditLog), 'Billing returns auditLog array');
  assert(billWithAudit.auditLog.length >= 4, `Audit log has >= 4 entries (got ${billWithAudit.auditLog.length})`);

  const utteranceEntries = billWithAudit.auditLog.filter((e) => e.eventType === 'UTTERANCE_CAPTURED');
  assert(utteranceEntries.length >= 1, 'Audit log contains UTTERANCE_CAPTURED entry');

  const skuEntries = billWithAudit.auditLog.filter((e) => e.eventType === 'SKU_MATCHED');
  assert(skuEntries.length === 2, 'Audit log contains 2 SKU_MATCHED entries (one per part)');
  assert(
    typeof skuEntries[0].confidence === 'number' && skuEntries[0].confidence > 0,
    'SKU_MATCHED entries carry confidence scores'
  );

  const calcEntry = billWithAudit.auditLog.find((e) => e.eventType === 'BILLING_CALCULATED');
  assert(calcEntry !== undefined, 'Audit log contains BILLING_CALCULATED entry');
  assert(calcEntry?.isCritical === true, 'BILLING_CALCULATED entry is marked as critical (financial mutation)');
  assert(
    calcEntry?.rawData?.note?.includes('server-side code') || calcEntry?.rawData?.note?.includes('LLM'),
    'BILLING_CALCULATED raw data confirms deterministic pricing (not LLM-generated)'
  );

  // 9c: Barge-in correction audit trail
  const billOriginal = await calculateBillingAndReadback({
    work_order_id: 'WO-1042',
    labor_hours: 3,
    parts_items: [{ sku: 'CAP-45-5', description: 'Capacitor', quantity: 1, unit_price: 165 }],
  });
  const billCorrected = await calculateBillingAndReadback({
    work_order_id: 'WO-1042',
    labor_hours: 2.25,
    parts_items: [{ sku: 'CAP-45-5', description: 'Capacitor', quantity: 1, unit_price: 165 }],
  });
  assert(
    billOriginal.totalAmount > billCorrected.totalAmount,
    `Correction reduces total: $${billOriginal.totalAmount} → $${billCorrected.totalAmount}`
  );
  const delta = Math.round((billOriginal.totalAmount - billCorrected.totalAmount) * 100) / 100;
  assert(delta > 0, `Positive savings delta of $${delta} from barge-in correction`);

  // Test 10: Multi-Business Profile & Voice Catalog Management
  console.log('\nTest 10: Multi-Business Profile & Voice Catalog Management');
  const pcProfile = db.setActiveProfile('custom-pc-builder');
  assert(pcProfile.id === 'custom-pc-builder', 'Switches active profile to custom-pc-builder');
  assert(pcProfile.gstin === '29AABCA1234F1Z5', 'Loads correct Karnataka GSTIN');
  assert(pcProfile.currencySymbol === '₹', 'Sets active currency to INR (₹)');

  // Voice tool: add new catalog item
  const catRes = await addOrUpdateCatalogItem({
    name: 'ZOTAC Gaming GeForce RTX 4080 Super',
    base_price: 105000,
    gst_rate: 0.18,
    stock: 3,
    category: 'Graphics Cards',
  });
  assert(catRes.success === true, 'Voice catalog addition reports success');
  assert(catRes.item.hsnCode === '8471', 'Auto-resolves HSN code 8471 for computer parts');
  assert(catRes.item.basePrice === 105000, 'Stores base price of ₹1,05,000');
  const foundCat = db.findCatalogItemByQuery('4080 super');
  assert(foundCat !== undefined, 'Finds newly added item via fuzzy alias query');

  // Test 11: Indian GST Engine (Intra-State CGST+SGST vs. Inter-State IGST)
  console.log('\nTest 11: Indian GST Engine & Rupee Readback');
  // 11a: Intra-state (Karnataka to Karnataka)
  const billIntra = await calculateBillingAndReadback({
    work_order_id: 'ORD-INTRA-01',
    labor_hours: 0,
    parts_items: [
      { sku: 'CPU-AMD-5600X', description: 'AMD Ryzen 5 5600X', quantity: 1, unit_price: 14200 },
      { sku: 'MB-MSI-B550M', description: 'MSI B550M Motherboard', quantity: 1, unit_price: 8900 },
    ],
    custom_notes: 'Bengaluru, Karnataka Delivery',
  });
  assert(billIntra.subtotal === 23100, 'Calculates taxable subtotal: ₹23,100');
  assert(billIntra.isInterState === false, 'Detects intra-state supply for Karnataka customer');
  assert(billIntra.cgstTotal === 2079, 'Assesses CGST 9%: ₹2,079');
  assert(billIntra.sgstTotal === 2079, 'Assesses SGST 9%: ₹2,079');
  assert(billIntra.igstTotal === 0, 'Zero IGST on intra-state supply');
  assert(billIntra.totalAmount === 27258, 'Calculates total with CGST+SGST: ₹27,258');

  // 11b: Inter-state (Karnataka to Mumbai, Maharashtra Courier Dispatch)
  const billInter = await calculateBillingAndReadback({
    work_order_id: 'ORD-INTER-02',
    labor_hours: 0,
    parts_items: [
      { sku: 'GPU-RTX-4060-8G', description: 'NVIDIA RTX 4060', quantity: 1, unit_price: 28500 },
      { sku: 'SHP-COURIER-AIR', description: 'BlueDart Air Cargo', quantity: 1, unit_price: 850 },
    ],
    custom_notes: 'Bandra West, Mumbai, Maharashtra (Courier Dispatch)',
  });
  assert(billInter.subtotal === 29350, 'Calculates taxable subtotal: ₹29,350');
  assert(billInter.isInterState === true, 'Detects inter-state consignment for Mumbai delivery');
  assert(billInter.igstTotal === 5283, 'Assesses IGST 18%: ₹5,283');
  assert(billInter.cgstTotal === 0 && billInter.sgstTotal === 0, 'Zero CGST/SGST on inter-state consignment');
  assert(billInter.totalAmount === 34633, 'Calculates total with IGST: ₹34,633');
  assert(billInter.voiceReadbackScript.includes('₹34,633'), 'Readback script contains formatted Rupee amount');
  assert(billInter.voiceReadbackScript.includes('IGST'), 'Readback mentions IGST for interstate shipment');

  // Test 12: Indian GST Tax Invoice PDF Generator & UPI QR Code
  console.log('\nTest 12: Indian GST Tax Invoice PDF Generator & UPI QR');
  const gstPdfRes = await generateGstTaxInvoice({
    client_name: 'Rahul Sharma',
    client_address: 'Flat 402, Sea Crest Towers, Bandra West, Mumbai, MH 400050',
    client_phone: '+91 98200 44551',
    client_email: 'rahul.sharma@mumbai-tech.in',
    courier_dispatch: true,
    courier_tracking: 'BD-IN-9842109',
    is_interstate: true,
    items: [
      { sku: 'CPU-AMD-5600X', description: 'AMD Ryzen 5 5600X 6-Core Processor', quantity: 1, unit_price: 14200, hsn_code: '8471', gst_rate: 0.18 },
      { sku: 'GPU-RTX-4060-8G', description: 'NVIDIA GeForce RTX 4060 8GB GDDR6', quantity: 1, unit_price: 28500, hsn_code: '8471', gst_rate: 0.18 },
      { sku: 'SHP-COURIER-AIR', description: 'Insured Air Cargo Courier Dispatch (BlueDart)', quantity: 1, unit_price: 850, hsn_code: '9968', gst_rate: 0.18 },
    ],
  });
  assert(gstPdfRes.success === true, 'GST Tax Invoice reports success');
  assert(fs.existsSync(gstPdfRes.pdfFilePath), 'GST PDF file physically exists on disk');
  const gstPdfSize = fs.statSync(gstPdfRes.pdfFilePath).size;
  assert(gstPdfSize > 2500, `GST PDF has valid byte size (${gstPdfSize} bytes)`);
  assert(gstPdfRes.upiPaymentString.includes('upi://pay?pa=apexpc'), 'Contains valid UPI payment URI');
  assert(gstPdfRes.upiQrDataUrl.startsWith('data:image/png;base64,'), 'Generates valid base64 QR code data URL');

  // Test 13: Indian Trade Services & Government GST (Plumbers & Electricians)
  console.log('\nTest 13: Indian Trade Services & Government GST (Plumber & Electrician)');
  // 13a: JalShakti Plumbing (Mumbai, MH)
  db.setActiveProfile('india-plumber');
  const activePlumb = db.getActiveProfile();
  assert(activePlumb.id === 'india-plumber', 'Switched to JalShakti Plumbing');
  assert(activePlumb.tradeType === 'PLUMBER', 'Profile trade type is PLUMBER');
  assert(activePlumb.businessCategory === 'SERVICE_TRADE', 'Category is SERVICE_TRADE');

  const plumbBill = await calculateBillingAndReadback({
    work_order_id: 'WO-PLUMB-301',
    labor_hours: 1.5,
    parts_items: [
      { sku: 'PLUMB-VALVE-BRASS-1IN', description: 'Brass Ball Valve 1-Inch', quantity: 2, unit_price: 650 },
      { sku: 'PLUMB-PVC-PIPE-10FT', description: 'PVC Pipe 10ft', quantity: 1, unit_price: 480 },
    ],
    custom_notes: 'Bandra West, Mumbai, Maharashtra (Intra-State)',
  });
  // Labor: 1.5 * ₹800 = ₹1,200. Parts: (2*650) + 480 = ₹1,780. Subtotal = ₹2,980.
  assert(plumbBill.subtotal === 2980, 'Plumber taxable subtotal: ₹2,980');
  assert(plumbBill.isInterState === false, 'Detects intra-state Mumbai service call');
  assert(plumbBill.cgstTotal === 268.2, 'Assesses Maharashtra CGST 9%: ₹268.20');
  assert(plumbBill.sgstTotal === 268.2, 'Assesses Maharashtra SGST 9%: ₹268.20');
  assert(plumbBill.totalAmount === 3516.4, 'Calculates plumber total with CGST+SGST: ₹3,516.40');
  assert(plumbBill.voiceReadbackScript.includes('₹3,516.4'), 'Readback quotes ₹3,516.40 in Rupees');

  const plumbPdf = await generateGstTaxInvoice({
    client_name: 'Sunita Deshmukh',
    client_address: '14/B Perry Cross Road, Bandra West, Mumbai, MH 400050',
    items: [
      { sku: 'PLUMB-VALVE-BRASS-1IN', description: 'Brass Ball Valve 1-Inch', quantity: 2, unit_price: 650, hsn_code: '8481', gst_rate: 0.18 },
      { sku: 'PLUMB-PVC-PIPE-10FT', description: 'PVC Pipe 10ft', quantity: 1, unit_price: 480, hsn_code: '3917', gst_rate: 0.18 },
    ],
  });
  assert(plumbPdf.success === true, 'Plumbing GST invoice generated successfully');
  assert(plumbPdf.upiPaymentString.includes('jalshakti@upi'), 'Plumbing invoice carries jalshakti@upi UPI QR code');

  // 13b: PowerCraft Electricals (New Delhi)
  db.setActiveProfile('india-electrician');
  const activeElec = db.getActiveProfile();
  assert(activeElec.id === 'india-electrician', 'Switched to PowerCraft Electricals');
  assert(activeElec.stateCode === '07', 'Delhi State Code is 07');

  const elecBill = await calculateBillingAndReadback({
    work_order_id: 'WO-ELEC-401',
    labor_hours: 2,
    parts_items: [
      { sku: 'ELEC-WIRE-COPPER-2.5', description: 'Havells 2.5 sq mm Wire Coil', quantity: 1, unit_price: 2450 },
      { sku: 'ELEC-MCB-32A-DP', description: '32A Double Pole MCB Breaker', quantity: 2, unit_price: 720 },
    ],
    custom_notes: 'Connaught Place, New Delhi (Intra-State)',
  });
  // Labor: 2 * ₹750 = ₹1,500. Parts: 2450 + (2*720) = ₹3,890. Subtotal = ₹5,390.
  assert(elecBill.subtotal === 5390, 'Electrician taxable subtotal: ₹5,390');
  assert(elecBill.cgstTotal === 485.1, 'Assesses Delhi CGST 9%: ₹485.10');
  assert(elecBill.sgstTotal === 485.1, 'Assesses Delhi SGST 9%: ₹485.10');
  assert(elecBill.totalAmount === 6360.2, 'Calculates electrician total with GST: ₹6,360.20');

  // Test 14: Global / Other Shopkeepers (Custom Country Tax Rate Configured by Shopkeeper)
  console.log('\nTest 14: Global / Other Shopkeepers (Custom Country Tax Rate)');
  // 14a: Seattle PC Builder (10.25% Custom Tax)
  db.setActiveProfile('global-pc-builder');
  const globalPc = db.getActiveProfile();
  assert(globalPc.id === 'global-pc-builder', 'Switched to Falcon Custom Rig Studios (US)');
  assert(globalPc.taxSystem === 'CUSTOM_TAX', 'Tax system is CUSTOM_TAX');
  assert(globalPc.customTaxRate === 0.1025, 'Shopkeeper tax rate is 10.25%');

  const seattleBill = await calculateBillingAndReadback({
    work_order_id: 'ORD-SEA-101',
    labor_hours: 0,
    parts_items: [
      { sku: 'GPU-RTX-4070-12G', description: 'RTX 4070 Graphics Card', quantity: 1, unit_price: 650.0 },
      { sku: 'SSD-1TB-GEN4', description: '1TB NVMe SSD', quantity: 2, unit_price: 85.0 },
    ],
  });
  // Subtotal = 650 + 170 = $820. Tax = 820 * 0.1025 = $84.05. Total = $904.05.
  assert(seattleBill.subtotal === 820.0, 'Subtotal: $820.00');
  assert(seattleBill.taxRate === 0.1025, 'Applied shopkeeper custom tax rate 10.25%');
  assert(seattleBill.taxAmount === 84.05, 'Tax amount: $84.05');
  assert(seattleBill.totalAmount === 904.05, 'Total with shopkeeper tax: $904.05');
  assert(seattleBill.voiceReadbackScript.includes('$904.05'), 'Readback script formats in $ USD with custom tax');

  // 14b: Shopkeeper updates their country tax rate via updateProfileTaxRate
  db.updateProfileTaxRate('global-pc-builder', 0.12, 'Updated WA Special Tax (12.00%)');
  const updatedSeattleBill = await calculateBillingAndReadback({
    work_order_id: 'ORD-SEA-101',
    labor_hours: 0,
    parts_items: [
      { sku: 'GPU-RTX-4070-12G', description: 'RTX 4070 Graphics Card', quantity: 1, unit_price: 650.0 },
      { sku: 'SSD-1TB-GEN4', description: '1TB NVMe SSD', quantity: 2, unit_price: 85.0 },
    ],
  });
  // Tax = 820 * 0.12 = $98.40. Total = $918.40.
  assert(updatedSeattleBill.taxRate === 0.12, 'Recalculation reflects updated shopkeeper tax rate (12.00%)');
  assert(updatedSeattleBill.taxAmount === 98.4, 'Updated tax amount: $98.40');
  assert(updatedSeattleBill.totalAmount === 918.4, 'Updated total amount: $918.40');

  // 14c: UK Retail (20.00% VAT, £ GBP)
  db.setActiveProfile('global-garments-books');
  const ukStore = db.getActiveProfile();
  assert(ukStore.id === 'global-garments-books', 'Switched to Kingsway London');
  assert(ukStore.currencySymbol === '£', 'Currency symbol is £');
  assert(ukStore.customTaxRate === 0.2, 'Shopkeeper tax rate is 20.00% VAT');

  const ukBill = await calculateBillingAndReadback({
    work_order_id: 'ORD-UK-201',
    labor_hours: 0,
    parts_items: [
      { sku: 'GAR-POLO-CTN-01', description: 'Tailored Cotton Polo', quantity: 2, unit_price: 35.0 },
    ],
  });
  // Subtotal = £70.00. Tax = 70 * 0.20 = £14.00. Total = £84.00.
  assert(ukBill.subtotal === 70.0, 'UK subtotal: £70.00');
  assert(ukBill.taxAmount === 14.0, 'UK 20% VAT: £14.00');
  assert(ukBill.totalAmount === 84.0, 'UK total with VAT: £84.00');
  assert(ukBill.currencySymbol === '£', 'Return includes £ symbol');

  // Test 15: Regional Filtering & Multi-Business Retrieval
  console.log('\nTest 15: Regional Filtering & Multi-Business Discovery');
  const indianProfiles = db.getProfilesByRegion('INDIA');
  assert(indianProfiles.length === 5, `Retrieved 5 Indian profiles (got ${indianProfiles.length})`);
  const indianHasTrades = indianProfiles.some((p) => p.businessCategory === 'SERVICE_TRADE');
  const indianHasShops = indianProfiles.some((p) => p.businessCategory === 'RETAIL_SHOP');
  assert(indianHasTrades === true, 'Indian profiles include service trades (plumbers/electricians)');
  assert(indianHasShops === true, 'Indian profiles include retail shops (PC builders/garments)');

  const globalProfiles = db.getProfilesByRegion('GLOBAL');
  assert(globalProfiles.length === 5, `Retrieved 5 Global profiles (got ${globalProfiles.length})`);
  const globalHasTrades = globalProfiles.some((p) => p.businessCategory === 'SERVICE_TRADE');
  const globalHasShops = globalProfiles.some((p) => p.businessCategory === 'RETAIL_SHOP');
  assert(globalHasTrades === true, 'Global profiles include service trades (HVAC/plumbers/electricians)');
  assert(globalHasShops === true, 'Global profiles include retail shops (PC builders/garments)');

  // Reset active profile back to hvac-fleet for clean state
  db.setActiveProfile('hvac-fleet');

  console.log(`\n================================`);
  console.log(`Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
