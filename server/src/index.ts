import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';

import { db, AuditEntry } from './data/mockDb.js';
import { twimlRouter } from './telephony/twimlRoutes.js';
import { handleTwilioMediaStream } from './telephony/twilioHandler.js';
import { dispatchToolCall } from './tools/dispatcher.js';
import { AssemblyAIVoiceSession } from './agent/voiceSession.js';
import { runFullERPSync, getERPSyncSummary, resetERPSyncStore } from './integrations/erpSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static invoice PDFs
const invoicesDir = path.resolve(__dirname, '../public/invoices');
app.use('/invoices', express.static(invoicesDir));

// Telephony TwiML routes
app.use('/api/telephony', twimlRouter);

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FieldPilot Voice Agent Engine',
    version: '1.0.0',
    hasAssemblyAIKey: Boolean(process.env.ASSEMBLYAI_API_KEY && !process.env.ASSEMBLYAI_API_KEY.includes('your_')),
  });
});

app.get('/api/work-orders', (req, res) => {
  res.json(db.getAllWorkOrders());
});

app.get('/api/inventory', (req, res) => {
  res.json(db.getAllInventory());
});

app.get('/api/invoices', (req, res) => {
  res.json(db.getAllInvoices());
});

// Business Profile Switcher & Multi-Tenant Endpoints
app.get('/api/business-profiles', (req, res) => {
  const { region } = req.query;
  const profiles =
    region && (region === 'INDIA' || region === 'GLOBAL')
      ? db.getProfilesByRegion(region as 'INDIA' | 'GLOBAL')
      : db.getAllProfiles();
  res.json({
    profiles,
    activeProfile: db.getActiveProfile(),
  });
});

app.post('/api/business-profile/switch', (req, res) => {
  const { profileId } = req.body;
  const active = db.setActiveProfile(profileId);
  broadcastToClients('PROFILE_SWITCHED', active);
  res.json({ success: true, activeProfile: active });
});

app.patch('/api/business-profile/:id/tax-rate', (req, res) => {
  const { taxRate, taxLabel } = req.body;
  if (typeof taxRate !== 'number' || taxRate < 0 || taxRate > 1) {
    return res.status(400).json({ error: 'taxRate must be a decimal between 0 and 1 (e.g. 0.0825 for 8.25%)' });
  }
  const updated = db.updateProfileTaxRate(req.params.id, taxRate, taxLabel);
  if (!updated) {
    return res.status(404).json({ error: `Profile '${req.params.id}' not found.` });
  }
  broadcastToClients('PROFILE_UPDATED', updated);
  res.json({ success: true, profile: updated });
});

// Shop Catalog Management Endpoints (Voice & Dashboard)
app.get('/api/catalog', (req, res) => {
  res.json(db.getAllCatalog());
});

app.post('/api/catalog/item', (req, res) => {
  const saved = db.addOrUpdateCatalogItem(req.body);
  broadcastToClients('CATALOG_UPDATED', saved);
  res.json({ success: true, item: saved });
});

app.delete('/api/catalog/item/:sku', (req, res) => {
  const deleted = db.deleteCatalogItem(req.params.sku);
  broadcastToClients('CATALOG_UPDATED', { sku: req.params.sku, deleted });
  res.json({ success: deleted });
});

app.get('/api/invoices/:id', (req, res) => {
  const invoice = db.findInvoice(req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: `Invoice '${req.params.id}' not found.` });
  }
  res.json(invoice);
});

app.get('/api/invoices/:id/audit-log', (req, res) => {
  const invoice = db.findInvoice(req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: `Invoice '${req.params.id}' not found.` });
  }
  res.json({ invoiceId: invoice.id, auditLog: invoice.auditLog || [] });
});

app.post('/api/invoices/:id/pay', async (req, res) => {
  const invoice = db.findInvoice(req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: `Invoice '${req.params.id}' not found.` });
  }

  const { paymentMethod = 'CREDIT_CARD', signerName, signatureData } = req.body;

  invoice.status = 'PAID';
  const transactionId = `TX-APEX-${Date.now().toString().slice(-6)}`;

  // Run real-time ERP sync for settled invoice
  const erpSync = await runFullERPSync(invoice);

  // Broadcast real-time payment settlement to fleet dashboard
  broadcastToClients('INVOICE_PAID', {
    invoiceId: invoice.id,
    workOrderId: invoice.workOrderId,
    clientName: invoice.clientName,
    totalAmount: invoice.totalAmount,
    transactionId,
    paymentMethod,
    paidAt: new Date().toISOString(),
    erpSync,
  });

  broadcastToClients('ERP_SYNCED', erpSync);

  res.json({
    success: true,
    message: `Payment of $${invoice.totalAmount.toFixed(2)} approved and settled.`,
    transactionId,
    invoice,
    erpSync,
  });
});

// ERP Integration Endpoints (ServiceTitan V2 & QuickBooks Online)
app.get('/api/integrations/sync/:invoiceId', async (req, res) => {
  const { invoiceId } = req.params;
  let summary = getERPSyncSummary(invoiceId);
  if (!summary) {
    const invoice = db.findInvoice(invoiceId);
    if (invoice) {
      summary = await runFullERPSync(invoice);
    }
  }
  if (!summary) {
    return res.status(404).json({ error: `No ERP sync record found for invoice ${invoiceId}` });
  }
  res.json(summary);
});

app.post('/api/integrations/sync/:invoiceId', async (req, res) => {
  const { invoiceId } = req.params;
  const invoice = db.findInvoice(invoiceId);
  if (!invoice) {
    return res.status(404).json({ error: `Invoice '${invoiceId}' not found.` });
  }
  const syncResult = await runFullERPSync(invoice);
  broadcastToClients('ERP_SYNCED', syncResult);
  res.json({ success: true, syncResult });
});

app.post('/api/tools/execute', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    const result = await dispatchToolCall({ name, arguments: args });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset-demo', (req, res) => {
  db.resetToDefault();
  resetERPSyncStore();
  res.json({ success: true, message: 'Database reset to initial demo seed.' });
});

// WebSocket Servers
const wssClients = new WebSocketServer({ noServer: true });
const wssTwilio = new WebSocketServer({ noServer: true });

// Active browser clients
const activeClientSockets = new Set<WebSocket>();

function broadcastToClients(eventType: string, payload: any) {
  const message = JSON.stringify({ type: eventType, data: payload, timestamp: Date.now() });
  for (const client of activeClientSockets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Full interactive scenario runner (ideal for live judging and demos)
app.post('/api/simulation/run-scenario', async (req, res) => {
  const { scenarioId = 'johnson-cooling' } = req.body;

  res.json({ started: true, message: 'Simulation dialogue started. Stream live on dashboard.' });

  // Route to Indian PC shop scenario, Indian trade (plumber/electrician), or HVAC fleet scenario
  if (
    scenarioId === 'indian-trade' ||
    scenarioId === 'indian-plumber' ||
    scenarioId === 'india-plumber' ||
    scenarioId === 'plumber'
  ) {
    runIndianTradeSimulationScenario();
  } else if (
    scenarioId === 'indian-pc-builder' ||
    scenarioId === 'indian-shop' ||
    scenarioId === 'custom-pc-builder'
  ) {
    runIndianShopSimulationScenario();
  } else {
    runSimulationScenario(scenarioId);
  }
});

app.post('/api/simulation/run-indian-shop-scenario', async (req, res) => {
  res.json({ started: true, message: 'Indian PC Shop Voice POS simulation started. Stream live on dashboard.' });
  runIndianShopSimulationScenario();
});

app.post('/api/simulation/run-indian-trade-scenario', async (req, res) => {
  res.json({ started: true, message: 'Indian Plumber / Trade Service Voice simulation started. Stream live on dashboard.' });
  runIndianTradeSimulationScenario();
});

async function runSimulationScenario(scenarioId: string) {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const auditLog: AuditEntry[] = [];
  const now = () => new Date().toISOString();

  broadcastToClients('SESSION_STATE', { status: 'CONNECTING', mode: 'SIMULATION' });
  await sleep(600);

  broadcastToClients('SESSION_STATE', { status: 'ACTIVE', mode: 'SIMULATION' });
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: 'Apex FieldPilot online. What job did you just wrap up?',
    isFinal: true,
  });
  await sleep(2200);

  // Turn 1: Technician identifies job
  broadcastToClients('TRANSCRIPT', {
    speaker: 'technician',
    text: "Hey FieldPilot, I just wrapped up the Johnson Cold Storage job over on Industrial Parkway.",
    isFinal: true,
  });
  auditLog.push({
    timestamp: now(),
    eventType: 'UTTERANCE_CAPTURED',
    source: 'technician',
    detail: 'Technician identified completed job: Johnson Cold Storage, Industrial Parkway',
    rawData: { spokenText: 'Johnson Cold Storage job over on Industrial Parkway' },
  });
  await sleep(800);

  // Tool 1: Lookup work order
  broadcastToClients('TOOL_START', { name: 'lookup_work_order', args: { query: 'Johnson Cold Storage' } });
  const woResult = await dispatchToolCall({
    name: 'lookup_work_order',
    arguments: { query: 'Johnson Cold Storage' },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'lookup_work_order', result: woResult.result });
  await sleep(1000);

  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: 'Found Work Order WO-1042 for Johnson Cold Storage on Industrial Parkway. Carrier 5-Ton RTU. What parts and labor did you put into this repair?',
    isFinal: true,
  });
  await sleep(2400);

  // Turn 2: Technician lists parts and labor (deliberately says 3 hours to set up correction)
  broadcastToClients('TRANSCRIPT', {
    speaker: 'technician',
    text: "Replaced a bad dual-run 45 microfarad capacitor and a 24-volt contactor. Also flushed the condensate drain line with a gallon of Viper cleaner. Total labor was 3 hours.",
    isFinal: true,
  });
  auditLog.push({
    timestamp: now(),
    eventType: 'UTTERANCE_CAPTURED',
    source: 'technician',
    detail: 'Technician reported parts: capacitor, contactor, Viper flush. Labor: 3 hours (initial)',
    rawData: {
      partsSpoken: ['dual-run 45 microfarad capacitor', '24-volt contactor', 'Viper cleaner'],
      laborHoursSpoken: 3,
    },
  });
  await sleep(800);

  // Tool 2: Check truck inventory (with confidence scoring)
  broadcastToClients('TOOL_START', {
    name: 'check_truck_inventory',
    args: {
      parts_used: [
        { part_name: 'dual run capacitor 45 microfarad', quantity: 1 },
        { part_name: '24 volt contactor', quantity: 1 },
        { part_name: 'viper flush', quantity: 1 },
      ],
    },
  });
  const invResult = await dispatchToolCall({
    name: 'check_truck_inventory',
    arguments: {
      parts_used: [
        { part_name: 'dual run capacitor 45 microfarad', quantity: 1 },
        { part_name: '24 volt contactor', quantity: 1 },
        { part_name: 'viper flush', quantity: 1 },
      ],
    },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'check_truck_inventory', result: invResult.result });

  // Add inventory verification audit entries
  for (const part of invResult.result.parts) {
    auditLog.push({
      timestamp: now(),
      eventType: 'INVENTORY_VERIFIED',
      source: 'system',
      detail: `Truck stock verified: ${part.officialName} (${part.truckStockRemaining} in van)`,
      confidence: part.matchConfidence,
      rawData: { sku: part.matchedSku, requestedName: part.requestedName, remaining: part.truckStockRemaining },
    });
  }
  await sleep(1000);

  // Tool 3: Calculate billing (initial — with 3 hours labor)
  const partMatchDetails = invResult.result.parts.map((p: any) => ({
    requestedName: p.requestedName,
    matchedSku: p.matchedSku,
    matchConfidence: p.matchConfidence,
  }));

  broadcastToClients('TOOL_START', {
    name: 'calculate_billing_and_readback',
    args: {
      work_order_id: 'WO-1042',
      labor_hours: 3,
      parts_items: invResult.result.parts.map((p: any) => ({
        sku: p.matchedSku,
        description: p.officialName,
        quantity: p.quantityRequested,
        unit_price: p.retailUnitPrice,
      })),
    },
  });
  const billResult1 = await dispatchToolCall({
    name: 'calculate_billing_and_readback',
    arguments: {
      work_order_id: 'WO-1042',
      labor_hours: 3,
      parts_items: invResult.result.parts.map((p: any) => ({
        sku: p.matchedSku,
        description: p.officialName,
        quantity: p.quantityRequested,
        unit_price: p.retailUnitPrice,
      })),
      part_match_details: partMatchDetails,
    },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'calculate_billing_and_readback', result: billResult1.result });
  auditLog.push(...(billResult1.result.auditLog || []));
  await sleep(1200);

  // Agent reads back the initial total
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: billResult1.result.voiceReadbackScript,
    isFinal: true,
  });
  await sleep(2800);

  // ═══════════════════════════════════════════════════════════════════
  // 🔁 BARGE-IN CORRECTION BEAT — Technician interrupts mid-readback
  // ═══════════════════════════════════════════════════════════════════
  broadcastToClients('TRANSCRIPT', {
    speaker: 'technician',
    text: "Wait, hold on — make that 2.25 hours, not 3. I clocked out for lunch, forgot to subtract it.",
    isFinal: true,
  });
  broadcastToClients('INTERRUPTED', {});
  auditLog.push({
    timestamp: now(),
    eventType: 'UTTERANCE_CAPTURED',
    source: 'technician',
    detail: 'Technician barge-in correction: labor hours changed from 3 → 2.25',
    rawData: { originalHours: 3, correctedHours: 2.25, reason: 'Lunch break subtracted' },
  });
  await sleep(1400);

  // Agent acknowledges the correction
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: "Got it — correcting labor from 3 hours down to 2.25 hours. Recalculating...",
    isFinal: true,
  });
  await sleep(800);

  // Tool 3b: Recalculate billing with corrected hours
  broadcastToClients('TOOL_START', {
    name: 'calculate_billing_and_readback',
    args: {
      work_order_id: 'WO-1042',
      labor_hours: 2.25,
      note: 'CORRECTION: labor hours amended from 3 → 2.25 by technician barge-in',
    },
  });
  const billResult2 = await dispatchToolCall({
    name: 'calculate_billing_and_readback',
    arguments: {
      work_order_id: 'WO-1042',
      labor_hours: 2.25,
      parts_items: invResult.result.parts.map((p: any) => ({
        sku: p.matchedSku,
        description: p.officialName,
        quantity: p.quantityRequested,
        unit_price: p.retailUnitPrice,
      })),
      part_match_details: partMatchDetails,
    },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'calculate_billing_and_readback', result: billResult2.result });

  // Audit: Correction applied (the key moment judges look for)
  const savedAmount = Math.round((billResult1.result.totalAmount - billResult2.result.totalAmount) * 100) / 100;
  auditLog.push({
    timestamp: now(),
    eventType: 'CORRECTION_APPLIED',
    source: 'system',
    detail: `Labor hours corrected: 3 → 2.25 hrs. Total adjusted $${billResult1.result.totalAmount.toFixed(2)} → $${billResult2.result.totalAmount.toFixed(2)} (saved $${savedAmount.toFixed(2)})`,
    isCritical: true,
    rawData: {
      originalHours: 3,
      correctedHours: 2.25,
      originalTotal: billResult1.result.totalAmount,
      correctedTotal: billResult2.result.totalAmount,
      delta: -savedAmount,
      note: 'Technician barge-in correction. Agent halted readback, re-ran deterministic billing, and requested new verbal commit.',
    },
  });
  // Merge billing audit entries from the corrected run
  auditLog.push(...(billResult2.result.auditLog || []));
  await sleep(1200);

  // Agent reads back corrected total
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: `Corrected. ${billResult2.result.voiceReadbackScript}`,
    isFinal: true,
  });
  await sleep(2800);

  // Turn 3: Technician confirms the corrected total
  broadcastToClients('TRANSCRIPT', {
    speaker: 'technician',
    text: "That's right, finalize it.",
    isFinal: true,
  });
  auditLog.push({
    timestamp: now(),
    eventType: 'TECHNICIAN_CONFIRMED',
    source: 'technician',
    detail: `Technician verbally confirmed corrected total of $${billResult2.result.totalAmount.toFixed(2)}`,
    isCritical: true,
    rawData: { confirmedTotal: billResult2.result.totalAmount, spokenText: "That's right, finalize it." },
  });
  await sleep(800);

  // Tool 4: Generate Invoice PDF (using corrected billing)
  broadcastToClients('TOOL_START', {
    name: 'generate_invoice_pdf',
    args: {
      work_order_id: 'WO-1042',
      technician_notes: 'Diagnosed failed run capacitor causing compressor start trip. Replaced 45/5 MFD dual run capacitor and pitted 40A contactor. Flushed clogged drain trap with Nu-Calgon Viper. System cooling verified at 18 deg F split.',
      labor_hours: 2.25,
      parts_items: billResult2.result.itemizedLines.filter((i: any) => i.type === 'PART'),
    },
  });
  const pdfResult = await dispatchToolCall({
    name: 'generate_invoice_pdf',
    arguments: {
      work_order_id: 'WO-1042',
      technician_notes: 'Diagnosed failed run capacitor causing compressor start trip. Replaced 45/5 MFD dual run capacitor and pitted 40A contactor. Flushed clogged drain trap with Nu-Calgon Viper. System cooling verified at 18 deg F split.',
      labor_hours: 2.25,
      parts_items: billResult2.result.itemizedLines.filter((i: any) => i.type === 'PART'),
    },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'generate_invoice_pdf', result: pdfResult.result });

  // Attach audit trail to the invoice record
  const invoiceRecord = db.findInvoice(pdfResult.result.invoiceId);
  auditLog.push({
    timestamp: now(),
    eventType: 'INVOICE_COMMITTED',
    source: 'system',
    detail: `Invoice #${pdfResult.result.invoiceId} committed at $${pdfResult.result.totalAmount.toFixed(2)}`,
    isCritical: true,
    rawData: { invoiceId: pdfResult.result.invoiceId, totalAmount: pdfResult.result.totalAmount },
  });
  if (invoiceRecord) {
    invoiceRecord.auditLog = auditLog;
  }

  broadcastToClients('INVOICE_READY', { ...pdfResult.result, auditLog });
  await sleep(1200);

  // Tool 5: Send Customer Notification
  broadcastToClients('TOOL_START', {
    name: 'send_customer_notification',
    args: { invoice_id: pdfResult.result.invoiceId, method: 'both' },
  });
  const notifResult = await dispatchToolCall({
    name: 'send_customer_notification',
    arguments: { invoice_id: pdfResult.result.invoiceId, method: 'both' },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'send_customer_notification', result: notifResult.result });
  await sleep(600);

  // Automated ERP background sync to ServiceTitan V2 & QuickBooks Online
  if (invoiceRecord) {
    const erpSummary = await runFullERPSync(invoiceRecord);
    auditLog.push({
      timestamp: now(),
      eventType: 'ERP_SYNCED',
      source: 'system',
      detail: `Dual ERP sync complete — ServiceTitan Job #${erpSummary.serviceTitan.serviceTitanJobId}, QuickBooks Doc #${erpSummary.quickbooks.quickbooksDocNumber}`,
      rawData: { serviceTitanJobId: erpSummary.serviceTitan.serviceTitanJobId, quickbooksDocNumber: erpSummary.quickbooks.quickbooksDocNumber },
    });
    // Update the stored audit log with ERP entry
    invoiceRecord.auditLog = auditLog;
    broadcastToClients('ERP_SYNCED', erpSummary);
    broadcastToClients('AUDIT_LOG_UPDATED', { invoiceId: pdfResult.result.invoiceId, auditLog });
  }
  await sleep(600);

  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: `Invoice #${pdfResult.result.invoiceId} for $${pdfResult.result.totalAmount.toFixed(2)} is delivered to Marcus. Labor correction from 3 to 2.25 hours is logged in the audit trail. Van inventory deducted. Pulling your next dispatch call...`,
    isFinal: true,
  });
  await sleep(1500);

  // Tool 6: Get Next Job and Route
  broadcastToClients('TOOL_START', {
    name: 'get_next_job_and_route',
    args: { current_work_order_id: 'WO-1042' },
  });
  const routeResult = await dispatchToolCall({
    name: 'get_next_job_and_route',
    arguments: { current_work_order_id: 'WO-1042' },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'get_next_job_and_route', result: routeResult.result });
  await sleep(1200);

  // Agent final dispatch briefing
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: routeResult.result.spokenSummary,
    isFinal: true,
  });
  broadcastToClients('SESSION_STATE', { status: 'COMPLETED' });
}

async function runIndianShopSimulationScenario() {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const auditLog: AuditEntry[] = [];
  const now = () => new Date().toISOString();

  // Switch to Apex Custom Tech & PC Studio profile
  const profile = db.setActiveProfile('custom-pc-builder');
  broadcastToClients('PROFILE_SWITCHED', profile);

  broadcastToClients('SESSION_STATE', { status: 'CONNECTING', mode: 'SIMULATION' });
  await sleep(600);

  broadcastToClients('SESSION_STATE', { status: 'ACTIVE', mode: 'SIMULATION' });
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: 'Apex Custom Tech voice engine online. Vikram, what build or customer order are we processing today?',
    isFinal: true,
  });
  await sleep(2200);

  // Turn 1: Shopkeeper gives customer & list of components
  const customerUtterance = 'Hey FieldPilot, create an invoice for Rahul Sharma in Mumbai for a custom gaming PC. The parts are: AMD Ryzen 5 5600X, RTX 4060 graphics card, MSI B550M motherboard, 16GB Corsair RAM, 1TB NVMe SSD, 650W power supply, and gaming cabinet. Add custom assembly and BlueDart courier cargo.';
  broadcastToClients('TRANSCRIPT', {
    speaker: 'technician',
    text: customerUtterance,
    isFinal: true,
  });

  auditLog.push({
    timestamp: now(),
    eventType: 'UTTERANCE_CAPTURED',
    source: 'technician',
    detail: 'Shopkeeper ordered custom PC build for Rahul Sharma (Mumbai) with 9 components & courier',
    rawData: { spokenText: customerUtterance },
  });
  await sleep(900);

  // Tool 1: Check catalog inventory
  const requestedParts = [
    { part_name: 'ryzen 5 5600x', quantity: 1 },
    { part_name: 'rtx 4060', quantity: 1 },
    { part_name: 'b550m', quantity: 1 },
    { part_name: 'corsair ram', quantity: 1 },
    { part_name: '1tb ssd', quantity: 1 },
    { part_name: '650w psu', quantity: 1 },
    { part_name: 'gaming cabinet', quantity: 1 },
    { part_name: 'assembly', quantity: 1 },
    { part_name: 'courier', quantity: 1 },
  ];

  broadcastToClients('TOOL_START', {
    name: 'check_truck_inventory',
    args: { parts_used: requestedParts },
  });

  const invResult = await dispatchToolCall({
    name: 'check_truck_inventory',
    arguments: { parts_used: requestedParts },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'check_truck_inventory', result: invResult.result });

  for (const part of invResult.result.parts) {
    auditLog.push({
      timestamp: now(),
      eventType: 'SKU_MATCHED',
      source: 'system',
      detail: `"${part.requestedName}" → ${part.matchedSku} (${part.officialName})`,
      confidence: part.matchConfidence,
      isCritical: true,
      rawData: {
        requestedName: part.requestedName,
        matchedSku: part.matchedSku,
        officialName: part.officialName,
        confidence: part.matchConfidence,
        priceINR: part.retailUnitPrice,
        stock: part.truckStockRemaining,
      },
    });
  }
  await sleep(1000);

  // Tool 2: Initial billing calculation (1 SSD)
  const initialPartsItems = invResult.result.parts.map((p: any) => ({
    sku: p.matchedSku,
    description: p.officialName,
    quantity: p.quantityRequested,
    unit_price: p.retailUnitPrice,
  }));

  broadcastToClients('TOOL_START', {
    name: 'calculate_billing_and_readback',
    args: {
      work_order_id: 'ORD-9842',
      labor_hours: 0,
      parts_items: initialPartsItems,
      custom_notes: 'Bandra West, Mumbai, Maharashtra (Inter-State Courier)',
    },
  });

  const billResult1 = await dispatchToolCall({
    name: 'calculate_billing_and_readback',
    arguments: {
      work_order_id: 'ORD-9842',
      labor_hours: 0,
      parts_items: initialPartsItems,
      custom_notes: 'Bandra West, Mumbai, Maharashtra (Inter-State Courier)',
      part_match_details: invResult.result.parts.map((p: any) => ({
        requestedName: p.requestedName,
        matchedSku: p.matchedSku,
        matchConfidence: p.matchConfidence,
      })),
    },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'calculate_billing_and_readback', result: billResult1.result });
  await sleep(1200);

  // Agent reads back initial quote
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: billResult1.result.voiceReadbackScript,
    isFinal: true,
  });
  await sleep(2800);

  // Turn 2 (Barge-in / Modification moment)
  const correctionUtterance = 'Wait, hold on — he just messaged me! Upgrade the SSD to 2 units of the 1TB NVMe SSD instead of 1.';
  broadcastToClients('TRANSCRIPT', {
    speaker: 'technician',
    text: correctionUtterance,
    isFinal: true,
  });
  auditLog.push({
    timestamp: now(),
    eventType: 'UTTERANCE_CAPTURED',
    source: 'technician',
    detail: 'Shopkeeper requested quantity upgrade: 1TB NVMe SSD from 1 to 2 units',
    rawData: { spokenText: correctionUtterance },
  });
  await sleep(800);

  // Tool 3: Recalculate billing with 2 SSDs
  const correctedPartsItems = initialPartsItems.map((item: any) => {
    if (item.sku === 'SSD-1TB-GEN4') {
      return { ...item, quantity: 2 };
    }
    return item;
  });

  broadcastToClients('TOOL_START', {
    name: 'calculate_billing_and_readback',
    args: {
      work_order_id: 'ORD-9842',
      labor_hours: 0,
      parts_items: correctedPartsItems,
      custom_notes: 'Bandra West, Mumbai, Maharashtra (Inter-State Courier)',
    },
  });

  const billResult2 = await dispatchToolCall({
    name: 'calculate_billing_and_readback',
    arguments: {
      work_order_id: 'ORD-9842',
      labor_hours: 0,
      parts_items: correctedPartsItems,
      custom_notes: 'Bandra West, Mumbai, Maharashtra (Inter-State Courier)',
    },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'calculate_billing_and_readback', result: billResult2.result });

  const addedAmount = Math.round((billResult2.result.totalAmount - billResult1.result.totalAmount) * 100) / 100;
  auditLog.push({
    timestamp: now(),
    eventType: 'CORRECTION_APPLIED',
    source: 'system',
    detail: `SSD quantity upgraded: 1 → 2 units Crucial 1TB NVMe. Order adjusted ₹${billResult1.result.totalAmount.toLocaleString('en-IN')} → ₹${billResult2.result.totalAmount.toLocaleString('en-IN')} (+₹${addedAmount.toLocaleString('en-IN')} with IGST)`,
    isCritical: true,
    rawData: {
      originalTotal: billResult1.result.totalAmount,
      correctedTotal: billResult2.result.totalAmount,
      delta: addedAmount,
      note: 'Shopkeeper voice correction. Recalculated GST and locked total deterministically.',
    },
  });
  auditLog.push(...(billResult2.result.auditLog || []));
  await sleep(1200);

  // Agent reads back updated total
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: `Recalibrated. ${billResult2.result.voiceReadbackScript}`,
    isFinal: true,
  });
  await sleep(2600);

  // Turn 3: Shopkeeper verbal approval
  broadcastToClients('TRANSCRIPT', {
    speaker: 'technician',
    text: 'Yes, looks perfect. Seal the bill and book the courier.',
    isFinal: true,
  });
  auditLog.push({
    timestamp: now(),
    eventType: 'TECHNICIAN_CONFIRMED',
    source: 'technician',
    detail: `Shopkeeper verbally confirmed final GST order total of ₹${billResult2.result.totalAmount.toLocaleString('en-IN')}`,
    isCritical: true,
    rawData: { confirmedTotal: billResult2.result.totalAmount, spokenText: 'Yes, looks perfect. Seal the bill and book the courier.' },
  });
  await sleep(800);

  // Tool 4: Generate GST Tax Invoice PDF with UPI QR code
  broadcastToClients('TOOL_START', {
    name: 'generate_gst_tax_invoice',
    args: {
      client_name: 'Rahul Sharma',
      client_address: 'Flat 402, Sea Crest Towers, Bandra West, Mumbai, MH 400050',
      client_phone: '+91 98200 44551',
      client_email: 'rahul.sharma@mumbai-tech.in',
      courier_dispatch: true,
      courier_tracking: 'BD-IN-9842109',
      is_interstate: true,
      items: correctedPartsItems,
    },
  });

  const gstPdfResult = await dispatchToolCall({
    name: 'generate_gst_tax_invoice',
    arguments: {
      order_id: 'ORD-9842',
      client_name: 'Rahul Sharma',
      client_address: 'Flat 402, Sea Crest Towers, Bandra West, Mumbai, MH 400050',
      client_phone: '+91 98200 44551',
      client_email: 'rahul.sharma@mumbai-tech.in',
      courier_dispatch: true,
      courier_tracking: 'BD-IN-9842109',
      is_interstate: true,
      items: correctedPartsItems,
      technician_notes: 'All 9 components brand-new sealed in retail packaging. System assembled, cable-managed, and stress-tested 60 minutes. Shipped via BlueDart Air Cargo.',
    },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'generate_gst_tax_invoice', result: gstPdfResult.result });

  // Attach audit trail to invoice
  const invRecord = db.findInvoice(gstPdfResult.result.invoiceId);
  auditLog.push({
    timestamp: now(),
    eventType: 'INVOICE_COMMITTED',
    source: 'system',
    detail: `GST Tax Invoice #${gstPdfResult.result.invoiceId} committed (PDF rendered, BlueDart tracking BD-IN-9842109, UPI QR active)`,
    isCritical: true,
    rawData: {
      invoiceId: gstPdfResult.result.invoiceId,
      totalAmount: gstPdfResult.result.totalAmount,
      upiString: gstPdfResult.result.upiPaymentString,
      pdfPath: gstPdfResult.result.pdfFilePath,
    },
  });

  if (invRecord) {
    invRecord.auditLog = auditLog;
  }
  broadcastToClients('AUDIT_LOG_UPDATED', { invoiceId: gstPdfResult.result.invoiceId, auditLog });
  broadcastToClients('INVOICE_GENERATED', gstPdfResult.result);
  broadcastToClients('GST_INVOICE_GENERATED', gstPdfResult.result);
  await sleep(1400);

  // Tool 5: Customer notification via WhatsApp / SMS
  broadcastToClients('TOOL_START', {
    name: 'send_customer_notification',
    args: { invoice_id: gstPdfResult.result.invoiceId, method: 'both' },
  });
  const notifResult = await dispatchToolCall({
    name: 'send_customer_notification',
    arguments: { invoice_id: gstPdfResult.result.invoiceId, method: 'both' },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'send_customer_notification', result: notifResult.result });
  await sleep(1000);

  // Final confirmation
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: `GST Tax Invoice #${gstPdfResult.result.invoiceId} generated for ₹${gstPdfResult.result.totalAmount.toLocaleString('en-IN')} and dispatched to Rahul Sharma via WhatsApp with the UPI payment QR code. BlueDart courier air cargo booked under tracking BD-IN-9842109. Ready for the next build!`,
    isFinal: true,
  });
  broadcastToClients('SESSION_STATE', { status: 'COMPLETED' });
}

async function runIndianTradeSimulationScenario() {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const auditLog: AuditEntry[] = [];
  const now = () => new Date().toISOString();

  // Switch to JalShakti Plumbing & Sanitary Works profile
  const profile = db.setActiveProfile('india-plumber');
  broadcastToClients('PROFILE_SWITCHED', profile);

  broadcastToClients('SESSION_STATE', { status: 'CONNECTING', mode: 'SIMULATION' });
  await sleep(600);

  broadcastToClients('SESSION_STATE', { status: 'ACTIVE', mode: 'SIMULATION' });
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: 'JalShakti Plumbing voice copilot online. Ramesh, what service or customer job are we billing today?',
    isFinal: true,
  });
  await sleep(2200);

  // Turn 1: Plumber speaks work completed
  const customerUtterance =
    'Hey FieldPilot, create bill for customer Sunita Deshmukh in Bandra West, Mumbai. I installed 2 heavy brass ball valves, 1 length of 10-foot PVC pipe, and did 1.5 hours of emergency pipe repair labor.';
  broadcastToClients('TRANSCRIPT', {
    speaker: 'technician',
    text: customerUtterance,
    isFinal: true,
  });

  auditLog.push({
    timestamp: now(),
    eventType: 'UTTERANCE_CAPTURED',
    source: 'technician',
    detail: 'Plumber reported service call for Sunita Deshmukh (Bandra West, Mumbai): 2 brass valves, 1 PVC pipe, 1.5 hrs labor',
    rawData: { spokenText: customerUtterance },
  });
  await sleep(900);

  // Tool 1: Check catalog inventory
  const requestedParts = [
    { part_name: 'brass valve', quantity: 2 },
    { part_name: 'pvc pipe', quantity: 1 },
  ];

  broadcastToClients('TOOL_START', {
    name: 'check_truck_inventory',
    args: { parts_used: requestedParts },
  });

  const invResult = await dispatchToolCall({
    name: 'check_truck_inventory',
    arguments: { parts_used: requestedParts },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'check_truck_inventory', result: invResult.result });

  for (const part of invResult.result.parts) {
    auditLog.push({
      timestamp: now(),
      eventType: 'SKU_MATCHED',
      source: 'system',
      detail: `"${part.requestedName}" → ${part.matchedSku} (${part.officialName})`,
      confidence: part.matchConfidence,
      isCritical: true,
      rawData: {
        requestedName: part.requestedName,
        matchedSku: part.matchedSku,
        officialName: part.officialName,
        confidence: part.matchConfidence,
        priceINR: part.retailUnitPrice,
        stock: part.truckStockRemaining,
      },
    });
  }
  await sleep(1000);

  // Tool 2: Initial billing calculation (Intra-state Maharashtra CGST 9% + SGST 9%)
  const initialPartsItems = invResult.result.parts.map((p: any) => ({
    sku: p.matchedSku,
    description: p.officialName,
    quantity: p.quantityRequested,
    unit_price: p.retailUnitPrice,
  }));

  broadcastToClients('TOOL_START', {
    name: 'calculate_billing_and_readback',
    args: {
      work_order_id: 'WO-PLUMB-301',
      labor_hours: 1.5,
      parts_items: initialPartsItems,
      custom_notes: 'Bandra West, Mumbai, Maharashtra (Intra-State)',
    },
  });

  const billResult1 = await dispatchToolCall({
    name: 'calculate_billing_and_readback',
    arguments: {
      work_order_id: 'WO-PLUMB-301',
      labor_hours: 1.5,
      parts_items: initialPartsItems,
      custom_notes: 'Bandra West, Mumbai, Maharashtra (Intra-State)',
    },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'calculate_billing_and_readback', result: billResult1.result });
  auditLog.push(...(billResult1.result.auditLog || []));
  await sleep(1400);

  // Agent reads back initial total
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: billResult1.result.voiceReadbackScript,
    isFinal: true,
  });
  await sleep(2600);

  // Turn 2: Verbal addition / barge-in moment
  const additionUtterance = 'Wait, hold on — also add 1 tap ceramic cartridge for the kitchen mixer.';
  broadcastToClients('TRANSCRIPT', {
    speaker: 'technician',
    text: additionUtterance,
    isFinal: true,
  });
  auditLog.push({
    timestamp: now(),
    eventType: 'UTTERANCE_CAPTURED',
    source: 'technician',
    detail: 'Plumber added 1 ceramic tap cartridge to service invoice',
    rawData: { spokenText: additionUtterance },
  });
  await sleep(800);

  // Tool 3: Recalculate billing with ceramic cartridge
  const updatedPartsItems = [
    ...initialPartsItems,
    {
      sku: 'PLUMB-FAUCET-CARTRIDGE',
      description: 'Quarter-Turn Ceramic Disc Tap & Faucet Cartridge',
      quantity: 1,
      unit_price: 350,
    },
  ];

  broadcastToClients('TOOL_START', {
    name: 'calculate_billing_and_readback',
    args: {
      work_order_id: 'WO-PLUMB-301',
      labor_hours: 1.5,
      parts_items: updatedPartsItems,
      custom_notes: 'Bandra West, Mumbai, Maharashtra (Intra-State)',
    },
  });

  const billResult2 = await dispatchToolCall({
    name: 'calculate_billing_and_readback',
    arguments: {
      work_order_id: 'WO-PLUMB-301',
      labor_hours: 1.5,
      parts_items: updatedPartsItems,
      custom_notes: 'Bandra West, Mumbai, Maharashtra (Intra-State)',
    },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'calculate_billing_and_readback', result: billResult2.result });

  const addedAmount = Math.round((billResult2.result.totalAmount - billResult1.result.totalAmount) * 100) / 100;
  auditLog.push({
    timestamp: now(),
    eventType: 'CORRECTION_APPLIED',
    source: 'system',
    detail: `Added ceramic tap cartridge (₹350). Bill adjusted ₹${billResult1.result.totalAmount.toLocaleString('en-IN')} → ₹${billResult2.result.totalAmount.toLocaleString('en-IN')} (+₹${addedAmount.toLocaleString('en-IN')} with CGST+SGST)`,
    isCritical: true,
    rawData: {
      originalTotal: billResult1.result.totalAmount,
      correctedTotal: billResult2.result.totalAmount,
      delta: addedAmount,
      note: 'Plumber voice addition. Deterministically calculated GST and locked total.',
    },
  });
  auditLog.push(...(billResult2.result.auditLog || []));
  await sleep(1200);

  // Agent reads back updated total
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: `Updated total is ₹${billResult2.result.totalAmount.toLocaleString('en-IN')}, including ₹${billResult2.result.taxAmount.toLocaleString('en-IN')} in Maharashtra GST (CGST ₹${(billResult2.result.cgstTotal || 0).toLocaleString('en-IN')} + SGST ₹${(billResult2.result.sgstTotal || 0).toLocaleString('en-IN')}). Shall I generate the GST invoice with the UPI QR code?`,
    isFinal: true,
  });
  await sleep(2200);

  // Verbal commit
  broadcastToClients('TRANSCRIPT', {
    speaker: 'technician',
    text: 'Yes, generate the bill and send it to Sunita.',
    isFinal: true,
  });
  auditLog.push({
    timestamp: now(),
    eventType: 'TECHNICIAN_CONFIRMED',
    source: 'technician',
    detail: 'Plumber verbally confirmed ₹' + billResult2.result.totalAmount.toLocaleString('en-IN') + ' total',
    isCritical: true,
  });
  await sleep(800);

  // Tool 4: Generate Section 31 Rule 46 CGST Tax Invoice
  broadcastToClients('TOOL_START', {
    name: 'generate_gst_tax_invoice',
    args: {
      order_id: 'WO-PLUMB-301',
      client_name: 'Sunita Deshmukh',
      client_address: '14/B Perry Cross Road, Bandra West, Mumbai, MH 400050',
      client_phone: '+91 98210 99887',
      client_email: 'sunita.deshmukh@gmail.com',
      is_interstate: false,
      items: updatedPartsItems,
      technician_notes: 'Replaced corroded mainline brass shutoff valves with heavy duty 1-inch lever valves, replaced 10ft drain PVC pipe line, and installed ceramic faucet disc cartridge.',
    },
  });

  const gstPdfResult = await dispatchToolCall({
    name: 'generate_gst_tax_invoice',
    arguments: {
      order_id: 'WO-PLUMB-301',
      client_name: 'Sunita Deshmukh',
      client_address: '14/B Perry Cross Road, Bandra West, Mumbai, MH 400050',
      client_phone: '+91 98210 99887',
      client_email: 'sunita.deshmukh@gmail.com',
      is_interstate: false,
      items: updatedPartsItems,
      technician_notes: 'Replaced corroded mainline brass shutoff valves with heavy duty 1-inch lever valves, replaced 10ft drain PVC pipe line, and installed ceramic faucet disc cartridge.',
    },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'generate_gst_tax_invoice', result: gstPdfResult.result });

  // Attach audit trail
  const invRecord = db.findInvoice(gstPdfResult.result.invoiceId);
  auditLog.push({
    timestamp: now(),
    eventType: 'INVOICE_COMMITTED',
    source: 'system',
    detail: `GST Tax Invoice #${gstPdfResult.result.invoiceId} committed (PDF rendered, JalShakti UPI QR active: jalshakti@upi)`,
    isCritical: true,
    rawData: {
      invoiceId: gstPdfResult.result.invoiceId,
      totalAmount: gstPdfResult.result.totalAmount,
      upiString: gstPdfResult.result.upiPaymentString,
      pdfPath: gstPdfResult.result.pdfFilePath,
    },
  });

  if (invRecord) {
    invRecord.auditLog = auditLog;
  }
  broadcastToClients('AUDIT_LOG_UPDATED', { invoiceId: gstPdfResult.result.invoiceId, auditLog });
  broadcastToClients('INVOICE_GENERATED', gstPdfResult.result);
  broadcastToClients('GST_INVOICE_GENERATED', gstPdfResult.result);
  await sleep(1200);

  // Tool 5: Customer notification via WhatsApp / SMS
  broadcastToClients('TOOL_START', {
    name: 'send_customer_notification',
    args: { invoice_id: gstPdfResult.result.invoiceId, method: 'both' },
  });
  const notifResult = await dispatchToolCall({
    name: 'send_customer_notification',
    arguments: { invoice_id: gstPdfResult.result.invoiceId, method: 'both' },
  });
  broadcastToClients('TOOL_COMPLETE', { name: 'send_customer_notification', result: notifResult.result });
  await sleep(1000);

  // Final confirmation
  broadcastToClients('TRANSCRIPT', {
    speaker: 'agent',
    text: `GST Tax Invoice #${gstPdfResult.result.invoiceId} generated for ₹${gstPdfResult.result.totalAmount.toLocaleString('en-IN')} and sent to Sunita Deshmukh via WhatsApp with the UPI payment QR code. Job marked complete!`,
    isFinal: true,
  });
  broadcastToClients('SESSION_STATE', { status: 'COMPLETED' });
}

// Upgrade WebSocket connections
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname === '/api/ws/client') {
    wssClients.handleUpgrade(request, socket, head, (ws) => {
      wssClients.emit('connection', ws, request);
    });
  } else if (pathname === '/api/telephony/media-stream') {
    wssTwilio.handleUpgrade(request, socket, head, (ws) => {
      wssTwilio.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Browser Dashboard WebSocket handling
wssClients.on('connection', (ws) => {
  console.log('[Dashboard WS] Browser client connected.');
  activeClientSockets.add(ws);

  let activeSession: AssemblyAIVoiceSession | null = null;

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'START_VOICE_SESSION') {
        activeSession = new AssemblyAIVoiceSession({
          sessionId: `client-${Date.now()}`,
          onTranscript: (speaker, text, isFinal) => {
            ws.send(JSON.stringify({ type: 'TRANSCRIPT', data: { speaker, text, isFinal } }));
          },
          onAudioOutput: (audioBase64) => {
            ws.send(JSON.stringify({ type: 'AUDIO_CHUNK', data: { audio: audioBase64 } }));
          },
          onToolEvent: (toolEvt) => {
            ws.send(JSON.stringify({ type: 'TOOL_EVENT', data: toolEvt }));
          },
          onInterrupted: () => {
            ws.send(JSON.stringify({ type: 'INTERRUPTED' }));
          },
        });

        const live = await activeSession.connect();
        ws.send(JSON.stringify({ type: 'SESSION_CONNECTED', data: { live } }));
      } else if (msg.type === 'AUDIO_INPUT' && activeSession) {
        activeSession.sendAudioChunk(msg.data.pcm16Base64);
      } else if (msg.type === 'STOP_VOICE_SESSION' && activeSession) {
        activeSession.close();
        activeSession = null;
        ws.send(JSON.stringify({ type: 'SESSION_CLOSED' }));
      }
    } catch (err) {
      console.error('[Dashboard WS] Message parse error:', err);
    }
  });

  ws.on('close', () => {
    activeClientSockets.delete(ws);
    if (activeSession) {
      activeSession.close();
      activeSession = null;
    }
    console.log('[Dashboard WS] Browser client disconnected.');
  });
});

// Twilio Telephony WebSocket handling
wssTwilio.on('connection', (ws) => {
  handleTwilioMediaStream(ws, {
    onCallStarted: (callSid, streamSid) => {
      broadcastToClients('PHONE_CALL_START', { callSid, streamSid });
    },
    onCallEnded: (callSid) => {
      broadcastToClients('PHONE_CALL_END', { callSid });
    },
    onTranscript: (speaker, text, isFinal) => {
      broadcastToClients('TRANSCRIPT', { speaker, text, isFinal, source: 'telephony' });
    },
    onToolEvent: (toolEvt) => {
      broadcastToClients('TOOL_COMPLETE', toolEvt);
    },
  });
});

// Start HTTP & WS Server
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 FieldPilot Voice Agent Server listening on port ${PORT}`);
  console.log(`📡 WebSocket Client: ws://localhost:${PORT}/api/ws/client`);
  console.log(`📞 Twilio Media Stream: ws://localhost:${PORT}/api/telephony/media-stream`);
  console.log(`📄 Invoices Directory: ${invoicesDir}`);
  console.log(`======================================================\n`);
});
