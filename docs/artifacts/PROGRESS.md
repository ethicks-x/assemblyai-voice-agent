# FieldPilot Development Progression Plan (AI Agent Workflow)

This document outlines the step-by-step roadmap for AI agents to incrementally build the FieldPilot project from scratch, adhering to the architecture and requirements defined in the README.

## Phase 1: Project Setup & Scaffolding
- [ ] Initialize a monorepo workspace for both client and server applications.
- [ ] Configure the client with React 18, TypeScript, Vite, and TailwindCSS.
- [ ] Configure the server with Node.js, Express, and WebSocket support.
- [ ] Setup testing infrastructure (Jest/Mocha) for backend tools validation.
- [ ] Establish environment variable templates (`.env.example`).

## Phase 2: Core Data Models & Business Logic Strategy
- [ ] Define robust JSON schemas for Work Orders, Inventory/Catalog items, and Invoices.
- [ ] Build a robust mock database layer (`src/data/mockDb.ts`) to serve fast interactions without a heavy SQL requirement (ideal for the hackathon).
- [ ] Implement Multi-Business profiles supporting both **Indian Statutory GST** (CGST/SGST/IGST, Lakhs/Crores readback) and **Global Custom Tax** formats.

## Phase 3: Core Backend Tools (The 8-Tool Agentic Pipeline)
- [ ] **Tool 1: `lookup_work_order`** - Fetch job details, address, and equipment via simple string queries.
- [ ] **Tool 2: `check_truck_inventory`** - Implement fuzzy string matching for parts/SKUs, verifying stock levels.
- [ ] **Tool 3: `calculate_billing_and_readback`** - Implement complex deterministic billing math (Regional US/Global tax vs. Intra/Inter-state Indian GST) and generate phonetic readback scripts.
- [ ] **Tool 4: `generate_invoice_pdf`** - Use PDFKit for standard high-resolution US/Global invoices.
- [ ] **Tool 5: `generate_gst_tax_invoice`** - Generate official Rule 46 Indian GST PDF invoices, incorporating HSN/SAC codes and generating embedded NPCI UPI QR code PNG buffers.
- [ ] **Tool 6: `send_customer_notification`** - Build SMS and email dispatch payloads.
- [ ] **Tool 7: `get_next_job_and_route`** - Calculate basic transit distances and time for subsequent dispatch.
- [ ] **Tool 8: `add_or_update_catalog_item`** - Parse spoken instructions into JSON updates for the shop inventory.

## Phase 4: Voice Agent & Telephony Integration
- [ ] Integrate the **AssemblyAI Voice Agent API** using WebSockets.
- [ ] Craft exact system prompts (`src/agent/agentConfig.ts`) to guide the LLM's persona, enabling handling of turn-taking and barge-in interruptions.
- [ ] Build a **Tool Dispatcher Gateway** to marshal LLM function calls directly to the core backend tools.
- [ ] Implement Twilio MediaStream telephony routes, complete with 8kHz to 16kHz audio conversion.

## Phase 5: ERP & Accounting Sync Adapters
- [ ] Build mock / API adapter for **ServiceTitan V2** (Job closeout, time tracking).
- [ ] Build mock / API adapter for **QuickBooks Online GL** (Invoice synchronization and GL balancing).
- [ ] Ensure all payloads adhere to RFC-7807 schemas for transparency, providing separate Sandbox and Live modes.

## Phase 6: Interactive Dashboard & UI Components (Frontend)
- [ ] **Layout & Core State:** Develop the main app shell and business profile switcher (India vs Global).
- [ ] **Voice Console:** Build browser WebMic access, procedural Web Audio earcons (PTT radio squelches), and HVAC pink noise simulation.
- [ ] **Audit Trail Panel:** Construct an immutable vertical log UI to capture confidence scores, state changes, and specifically highlight *barge-in corrections* with exact deterministic cost deltas.
- [ ] **Modals:**
  - `CatalogManagerModal`: For manual overrides and catalog view.
  - `TaxSettingsModal`: For real-time global tax updates.
  - `CustomerCheckoutModal`: Include HTML5 canvas for signatures and fake payment portal.
- [ ] **Fleet ROI Calculator:** Add an interactive tool with sliders (van count, jobs/day) matching the exact financial formulas in the README.

## Phase 7: Validation & Edge Case Handling
- [ ] Write exhaustive unit tests verifying the mathematical correctness of GST vs Non-GST invoices, inventory confidence scores, and JSON schema boundaries.
- [ ] Test real-time corrections: Simulate an interruption mid-readback (e.g., "Wait, make that 2 hours instead of 3") and verify deterministic rollback and recalculation.

## Phase 8: Demo Assets & Polish
- [ ] Bundle pre-configured interactive hackathon scenarios (e.g., PC Shop, Plumber, HVAC).
- [ ] Draft demo scripts (`VIDEO_SCRIPT.md`), pitch slides (`SLIDES_OUTLINE.md`), and lablab.ai metadata.
