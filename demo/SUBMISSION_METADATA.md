# FieldPilot — Hackathon Submission Metadata (Lablab.ai)

### Project Information
* **Project Name:** FieldPilot
* **Tagline:** Your technicians keep their hands on the tools. FieldPilot handles the parts, pricing, and paperwork.
* **Track / Category:** AssemblyAI Voice Agent Hackathon (September 2026)
* **License:** MIT License (Open Source)

---

### Elevator Pitch (Short Description - 280 chars)
FieldPilot is a voice-first copilot for trade technicians built on the AssemblyAI Voice Agent API. Techs close out jobs, match truck inventory, apply mid-sentence corrections, reconcile ServiceTitan & QuickBooks ERP, and generate vector PDF invoices 100% hands-free.

---

### Detailed Description (Markdown)
#### The Expensive Reality: Billable Leakage
Over 2.5 million trade technicians (HVAC, plumbing, electrical, refrigeration) work in demanding, hands-busy environments with dirty work gloves, oily tools, or on commercial rooftops. They physically cannot type on laptops or mobile screens.
Because of this friction, service companies suffer massive "billable leakage":
1. **Unbilled Truck Consumables:** Over 18% of small parts (capacitors, contactors, line flush, Puron) are forgotten and never invoiced (ACCA audited benchmark: $18,500/van/year).
2. **Rounded-Down Labor:** Technicians round down labor hours rather than logging exact wrench time ($9,200/van/year).
3. **Burnout:** Techs spend 45–60 minutes every night doing tedious administrative paperwork at their kitchen tables.
This costs trade contractors **over $25,000 per van each year**.

#### The Voice-First Solution: FieldPilot
FieldPilot turns closing out a service ticket into a 60-second natural phone conversation. Available through standard cellular phone calls (Twilio MediaStream) or a hands-free browser console:
1. **Locates Work Order:** Resolves customer and equipment details (`lookup_work_order`).
2. **Matches Truck Inventory:** Fuzzy matches spoken names to catalog SKUs with match confidence scoring (e.g. 89.2% on `CAP-45-5`) and decrements truck stock (`check_truck_inventory`).
3. **Calculates Deterministic Billing & Readback:** Computes labor, parts, and Texas Rule 3.292 sales tax with server-side deterministic locks (`calculate_billing_and_readback`).
4. **Mid-Readback Barge-In Correction:** When the agent reads back the total, technicians can interrupt (*"Wait, make that 2.25 hours labor, not 3"*). FieldPilot halts speech instantly, applies the correction, saves $93.75, logs an immutable audit entry, and confirms.
5. **Instant Vector PDF Invoicing:** Renders an official vector PDF invoice with equipment serials, diagnostic notes, and tax disclaimers (`generate_invoice_pdf`).
6. **Digital Customer Checkout Portal:** Dispatches customer SMS/email with a payment portal link featuring an HTML5 signature canvas and instant credit card settlement (`send_customer_notification`).
7. **Proactive Route Briefing:** Locates the next scheduled ticket, calculates transit distance, and provides a conversational driving briefing (`get_next_job_and_route`).
8. **Enterprise Dual-ERP Sync:** Reconciles dispatch tickets in ServiceTitan V2 (`/v2/tenant/jobs/closeout`) and posts balancing General Ledger journal entries to QuickBooks Online with transparent RFC-7807 sandbox validation.

#### Defensible Unit Economics
* **AssemblyAI Voice Agent API Cost:** Flat $4.50/hr rate = **$0.075 per 60-second closeout call** ($72.00/van/year).
* **FieldPilot SaaS Subscription:** $99/van/month ($1,188/van/year).
* **Net Annual Recovery:** **+$26,440/van/year** in bottom-line profit after all technology costs.
* **Payback Period:** **16.6 days** with a **21.0x Net ROI**.

#### How AssemblyAI Tech is Leveraged
* **AssemblyAI Voice Agent API:** Single full-duplex WebSocket connection managing streaming PCM audio, turn-taking, and Voice Activity Detection (VAD) with sub-second response times.
* **Native Barge-In Interruption:** Real-time interruption handling allowing technicians to verbally amend labor hours or materials mid-sentence.
* **Agentic Multi-Tool Execution:** 6 JSON-schema backend tools dynamically executed with zero hallucination.

---

### Tech Stack Tags
`assemblyai`, `voice-agent-api`, `speech-to-text`, `typescript`, `react`, `vite`, `tailwindcss`, `nodejs`, `express`, `websocket`, `twilio`, `pdfkit`, `servicetitan`, `quickbooks`, `ai-copilot`, `field-service`

