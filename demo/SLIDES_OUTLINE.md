# FieldPilot — Pitch Deck Slide Outline (5 Slides)

### Slide 1: Title & Hook
* **Headline:** FieldPilot — Autonomous Voice Copilot for Field Trade Technicians
* **Subhead:** Closing jobs, pricing truck inventory, and reconciling ERP 100% hands-free.
* **Visual:** Split photo: Dirty work gloves on a commercial rooftop vs. FieldPilot Mission Control Dashboard on a mobile tablet.
* **Key Stat:** 2.5M trade technicians in North America losing 45 min/day to paperwork and $20,000/van in unbilled inventory.

### Slide 2: The $25,000 "Billable Leakage" Problem
* **3 Major Pain Points:**
  1. **Physical Impossibility:** Technicians cannot type on an iPad with greasy gloves or on a 140°F commercial rooftop.
  2. **Unbilled Truck Consumables:** 18% of small parts (capacitors, contactors, line flush, Puron) are forgotten and never billed ($18,500/van/yr).
  3. **Burnout & Inaccurate Labor:** Techs round down labor hours and spend 45 minutes of unpaid evening paperwork at home.
* **Annual Net Cost:** \$20,000 – \$28,000 per van, every single year.

### Slide 3: The Solution — 60-Second Hands-Free Closeout
* **Visual:** Step-by-step speech bubble flow showing:
  - Tech speaks: *"Hey FieldPilot, wrapped up Johnson Cold Storage. Swapped a 45 cap and 24V contactor. 3 hours labor."*
  - Tech interrupts mid-readback: *"Wait, make that 2.25 hours labor, not 3."*
  - FieldPilot acknowledges & recalculates: *"Correcting labor to 2.25 hours. Total is $459.86. Deterministic lock confirmed."*
* **Evidence-Locked Guarantee:** LLM only matches intent; server code computes and locks pricing with an immutable audit trail (`AuditTrailPanel`).
* **Zero Double Entry:** Generates vector PDF invoice + dispatches customer checkout link + reconciles ServiceTitan V2 and QuickBooks Online GL.

### Slide 4: Technical Architecture & AssemblyAI Advantage
* **AssemblyAI Voice Agent API:**
  - Real-time streaming WebSocket connection with sub-second turn-taking.
  - Native Voice Activity Detection (VAD) and barge-in interruption detection.
* **Chained 6-Tool Agentic Execution Pipeline:**
  - `lookup_work_order` → `check_truck_inventory` → `calculate_billing_and_readback` → `generate_invoice_pdf` → `send_customer_notification` → `get_next_job_and_route`.
* **Enterprise ERP & Audio Polish:**
  - Dual-ERP Sync (ServiceTitan V2 + QuickBooks Online GL) with RFC-7807 sandbox transparency.
  - Texas Comptroller Rule 3.292 tax compliance (materials taxable, labor non-taxable repair).
  - Procedural Web Audio earcons (PTT radio squelch chirp) & HVAC rooftop pink noise simulator.

### Slide 5: Defensible Unit Economics & Market ROI
* **Target Customers:** Commercial HVAC, refrigeration, electrical, and plumbing contractors (5–250 vans).
* **Exact Technology Cost:**
  - **AssemblyAI Voice Agent API:** **$0.075 per closeout call** ($4.50/hr flat rate $\approx$ $72/van/year).
  - **FieldPilot SaaS Subscription:** **$99 / van / month** ($1,188/van/year).
  - **Total Tech Cost:** $1,260 / van / year.
* **Customer ROI & Payback:**
  - **Net Annual Profit Recaptured:** **+$26,440 / van / year** *after all technology costs*.
  - **Payback Period:** **16.6 days** (under 3 weeks!).
  - **Net ROI Multiplier:** **21.0x (2,098% annual ROI)**.

