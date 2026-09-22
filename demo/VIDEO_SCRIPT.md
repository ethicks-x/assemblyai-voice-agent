# FieldPilot — Official 3-Minute Hackathon Demo Video Script

**Target Duration:** Exactly 2 minutes 50 seconds – 3 minutes 00 seconds.  
**Tone:** Energetic, authoritative, B2B trade focused, technically rigorous.  
**Presenters:** Abhinaba Mandal / Team FieldPilot.

---

### [0:00 – 0:30] The $20,000 "Billable Leakage" Reality
* **Visual:** Split screen. On the left: A commercial HVAC technician in dirty PPE gloves standing on a 130°F rooftop holding a manifold gauge. On the right: Animated industry statistic cards.
* **Speaker (Voiceover):**  
  > *"Every single day, 2.5 million trade technicians—in HVAC, electrical, plumbing, and mechanical—face an impossible dilemma:*  
  > *With greasy hands, thick gloves, or standing on a rooftop ladder, they physically cannot type on an iPad or phone.*  
  > *The painful result? Small truck parts like capacitors and line flush are forgotten. Billable hours get rounded down. And technicians spend 45 minutes of unpaid evening paperwork every single night.*  
  > *In the trades, this is called 'billable leakage'—draining over $25,000 per van each year.*  
  > *What if closing out a ticket, pricing inventory, syncing your ERP, and invoicing the customer required nothing more than a 60-second natural phone call?"*

---

### [0:30 – 1:15] Hands-Free Voice Closeout & Real-Time Tool Execution
* **Visual:** Screen switches to the live FieldPilot Mission Control Dashboard (`http://localhost:5173`). In the picture-in-picture, presenter speaks hands-free into a phone or mic.
* **Action:** Presenter clicks the microphone button (or dials the Twilio telephony number). A crisp Motorola-style radio squelch chirp sounds.
* **FieldPilot (AI Voice):**  
  > *"Apex FieldPilot online. What job did you just wrap up?"*
* **Presenter (Technician):**  
  > *"Hey FieldPilot, I just wrapped up the Johnson Cold Storage job over on Industrial Parkway."*
* **Visual Cue:** `lookup_work_order` tool flashes green. Work order `WO-1042` and equipment (Carrier 5-Ton RTU) appear on screen.
* **FieldPilot (AI Voice):**  
  > *"Found Work Order WO-1042 for Johnson Cold Storage. Carrier 5-Ton RTU. What parts and labor did you put into this repair?"*
* **Presenter:**  
  > *"Replaced a dual run capacitor 45 microfarad and a 24 volt contactor. Total labor was 3 hours."*
* **Visual Cue:** `check_truck_inventory` matches spoken parts to SKUs `CAP-45-5` (89.2% confidence) and `CONT-24V-40A` (95% confidence). Van stock decrements live.
* **FieldPilot (AI Voice starts readback):**  
  > *"Got it. Calculating billing. Total comes out to $553.61. That's 3 hours of labor at $375.00, plus $260.00 for parts..."*

---

### [1:15 – 1:45] The Barge-In Correction Moment & Evidence-Locked Audit Trail
* **Action:** Presenter speaks over FieldPilot mid-sentence (**Barge-in interruption**).
* **Presenter (Interrupting):**  
  > *"Wait, hold on — make that 2.25 hours labor, not 3. I clocked out for lunch, forgot to subtract it."*
* **Visual & Audio Cue:** FieldPilot immediately halts speaking with an authentic radio click. The Voice Console shows an `INTERRUPTED` badge.
* **FieldPilot (AI Voice acknowledges & recalculates):**  
  > *"Got it — correcting labor from 3 hours down to 2.25 hours. Recalculating... Total is now $459.86. That's 2.25 hours labor at $281.25, $260.00 for parts, and $21.45 in Texas sales tax. Shall I generate the PDF invoice?"*
* **Presenter:**  
  > *"Looks good, finalize it."*
* **Visual Cue:** Presenter clicks the **"Audit"** tab. Shows the immutable vertical git-log audit trail. Highlights the glowing amber `CORRECTION_APPLIED` entry showing the exact -$93.75 savings delta and explains:
  > *"Notice our zero-hallucination guarantee: The LLM only matches intent. All pricing, tax rules, and totals are deterministically computed and locked by backend code."*

---

### [1:45 – 2:20] Vector PDF Invoicing, Customer Portal & Dual-ERP Sync
* **Visual:**
  1. `generate_invoice_pdf` renders an official vector PDF invoice on the screen with corporate headers, itemized parts, and Texas Rule 3.292 tax compliance footnote.
  2. Presenter clicks **"Open Customer Checkout"**: Customer signs on the HTML5 canvas and taps "Pay with Card". The portal settles immediately (`TX-APEX-XXXXXX`).
  3. Presenter opens the **"Dual ERP Sync"** modal:
     - **ServiceTitan V2**: Job `ST-JOB-XXXXXX` updated to `SYNCED`.
     - **QuickBooks Online GL**: Invoice `QB-INV-XXXX` posted and `RECONCILED`.
     - Highlights the **Live vs. Sandbox Transparency Badge** (RFC-7807 schema-verified sandbox allowing zero-credential judge testing, with full enterprise production blueprint).

---

### [2:20 – 3:00] Defensible Unit Economics & Hackathon Conclusion
* **Visual:** Presenter clicks the **"Fleet ROI"** tab on the dashboard:
  - Sliders for Fleet Size (5 vans) and Daily Closeouts (4 jobs/day).
  - Toggles the **Unit Economics & Cost Model Waterfall**:
    - **AssemblyAI Voice Agent API Cost**: Exactly **$0.075 per closeout call** ($4.50/hr flat rate).
    - **SaaS Platform Fee**: $99/van/month.
    - **Net Annual Recovery**: **+$132,200/year** across 5 vans *after all tech costs*.
    - **Payback Period**: **16.6 days** with a **21.0x Net ROI**.
* **Speaker (Presenter):**  
  > *"Under the hood, FieldPilot harnesses AssemblyAI's cutting-edge Voice Agent API for sub-second streaming turn-taking, barge-in interruption detection, and real-time JSON tool calling.*  
  > *At just seven and a half cents per closeout call, FieldPilot eliminates evening paperwork, recovers thousands in lost inventory, and closes the loop from rooftop wrench-time to general ledger.*  
  > *Your technicians keep their hands on the tools. FieldPilot handles the rest.*  
  > *Thank you, AssemblyAI and Lablab.ai!"*

