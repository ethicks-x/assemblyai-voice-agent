export const SYSTEM_PROMPT = `
You are FieldPilot, the universal autonomous voice copilot engineered for retail shopkeepers (custom PC builders, garments, bookstores, electronics) and field service trades (plumbers, electricians, HVAC & appliance technicians) worldwide.

CONTEXT & USER PERSONA:
- Your user is working hands-free: either a service worker (plumber, electrician, technician) with hands on pipes and wires or wearing thick work gloves, or a shopkeeper/PC builder packing delicate hardware or attending to customers.
- They CANNOT look at a screen or type. You are their verbal cashier, parts ledger, tax billing clerk, and logistics copilot.
- Keep your speech concise, punchy, and conversational (1-2 short spoken sentences per turn). Avoid reading large lists, avoid markdown formatting, and speak currency amounts naturally.

TWO REGIONAL MODES:
A. 🇮🇳 INDIAN USERS MODE (Government Statutory GST / ₹ INR / UPI QR):
1. IDENTIFY WORK OR ORDER:
   - For trades (plumber, electrician, technician): match materials used (e.g. brass ball valves, PVC pipes, copper wire coils, MCB breakers, capacitors) and diagnostic/repair labor hours.
   - For shops (PC builder, garments, books): match components or merchandise (e.g. Ryzen CPUs, RTX graphics cards, polo shirts, textbooks) and courier logistics.
2. STATUTORY GOVERNMENT GST: All items have fixed Government GST slabs (0%, 5%, 12%, 18%, 28%) and statutory HSN/SAC codes. Intra-state supplies split 50/50 into CGST (9%) + SGST (9%), while inter-state courier dispatches use full IGST (18%).
3. VOICE CATALOG ADDITIONS: Shopkeepers and trade workers can speak new items and prices into their live inventory via \`add_or_update_catalog_item\`.
4. READBACK & UPI INVOICING: Call \`calculate_billing_and_readback\` to quote total in Rupees (₹) with GST breakdown. When approved, generate Section 31 Rule 46 CGST Tax Invoice with scannable UPI QR code.

B. 🌍 OTHER / GLOBAL USERS MODE (Shopkeeper-Configured Country Tax / $ / £ / €):
1. IDENTIFY WORK OR ORDER: Across any shop (PC builder, apparel, books) or service trade (plumber, electrician, HVAC fleet), match materials and labor.
2. SHOPKEEPER-CONFIGURED COUNTRY TAX: The tax rate is set directly by the shopkeeper according to their country/jurisdiction (e.g. US state tax, UK VAT, European tax, or custom 0-30%).
3. TALLY & LOCAL READBACK: Call \`calculate_billing_and_readback\`. Read back labor, materials, and custom tax in local currency ($ USD, £ GBP, € EUR).
4. GENERATE INVOICE & DISPATCH: Generate PDF invoice and customer payment link via \`generate_invoice_pdf\`.

CRITICAL RULES:
- Never guess or invent prices or stock numbers; always rely on tool outputs. All pricing, GST, and totals are deterministically computed and locked by backend code—never hallucinated.
- If the user interrupts or corrects values (e.g., "Wait, make that 2 hours labor", or "Add two brass valves"), immediately halt, acknowledge the correction, recalculate with updated parameters, read back the new total, and request confirmation before generating the invoice.
`;

export const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'lookup_work_order',
      description: 'Finds an active field service work order or customer ticket by client name, address, or ticket ID.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query spoken by the technician or shopkeeper, e.g. "Johnson", "1042", "Rahul Sharma", "Metro 24 Diner".',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_truck_inventory',
      description: 'Matches spoken parts, components, or merchandise to active truck inventory and shop catalog, verifying stock levels and retail pricing.',
      parameters: {
        type: 'object',
        properties: {
          parts_used: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                part_name: {
                  type: 'string',
                  description: 'Spoken name of the part or component, e.g. "Ryzen 5 5600X", "RTX 4060", "B550M motherboard", "dual run capacitor", "courier shipping".',
                },
                quantity: {
                  type: 'number',
                  description: 'Quantity used (defaults to 1 if not specified).',
                },
              },
              required: ['part_name'],
            },
            description: 'List of parts or components spoken by the user.',
          },
        },
        required: ['parts_used'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_or_update_catalog_item',
      description: 'Adds or updates a shopkeeper inventory item into the active catalog by voice (e.g. adding newly arrived PC parts, books, or garments).',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Full name or model of the item, e.g. "Intel Core i5-13400F Processor" or "Crucial 32GB DDR5 RAM".',
          },
          base_price: {
            type: 'number',
            description: 'Base selling price in Rupees (₹) or Dollars ($).',
          },
          gst_rate: {
            type: 'number',
            description: 'GST rate slab (0.18 for 18%, 0.12 for 12%, 0.05 for 5%, 0.28 for 28%, 0 for exempt). Defaults to 0.18.',
          },
          hsn_code: {
            type: 'string',
            description: 'Official HSN/SAC code (defaults to 8471 for computer parts, 9954 for service, 6109 for garments).',
          },
          category: {
            type: 'string',
            description: 'Category such as Processors, Graphics Cards, Memory, Storage, Apparel, Books.',
          },
          stock: {
            type: 'number',
            description: 'Number of units currently in stock.',
          },
          unit: {
            type: 'string',
            description: 'Unit of measurement, e.g. "pcs", "service", "copies".',
          },
        },
        required: ['name', 'base_price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_billing_and_readback',
      description: 'Calculates the complete order or job billing including labor/assembly hours, parts/components, and applicable taxes (Indian GST CGST/SGST/IGST or US Sales Tax). Generates verbal readback script.',
      parameters: {
        type: 'object',
        properties: {
          work_order_id: {
            type: 'string',
            description: 'The ID of the work order or order, e.g. "WO-1042" or "ORD-9842".',
          },
          labor_hours: {
            type: 'number',
            description: 'Billable labor or custom assembly hours worked, e.g. 1.5 or 2.25.',
          },
          parts_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sku: { type: 'string', description: 'Matched SKU code if available.' },
                description: { type: 'string', description: 'Description of the part or component.' },
                quantity: { type: 'number', description: 'Quantity used.' },
                unit_price: { type: 'number', description: 'Retail unit price.' },
              },
              required: ['description', 'quantity'],
            },
            description: 'Itemized parts or merchandise to bill.',
          },
          custom_notes: {
            type: 'string',
            description: 'Optional customer location, courier shipping destination (e.g. "Mumbai, Maharashtra"), or technician notes.',
          },
        },
        required: ['work_order_id', 'labor_hours'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_invoice_pdf',
      description: 'Generates the official invoice document (US Trade or Indian GST based on active profile), deducts inventory, and completes order.',
      parameters: {
        type: 'object',
        properties: {
          work_order_id: {
            type: 'string',
            description: 'Work order or ticket ID e.g. "WO-1042".',
          },
          technician_notes: {
            type: 'string',
            description: 'Summary of diagnostic findings, PC specs, or repair notes.',
          },
          labor_hours: {
            type: 'number',
            description: 'Billable labor hours.',
          },
          parts_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sku: { type: 'string' },
                description: { type: 'string' },
                quantity: { type: 'number' },
                unit_price: { type: 'number' },
              },
              required: ['description', 'quantity'],
            },
          },
        },
        required: ['work_order_id', 'technician_notes', 'labor_hours', 'parts_items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_gst_tax_invoice',
      description: 'Generates an authentic Indian GST Tax Invoice PDF (Rule 46 CGST) with HSN codes, IGST/CGST/SGST breakdown, courier shipment tracking, and scannable UPI QR code.',
      parameters: {
        type: 'object',
        properties: {
          client_name: { type: 'string', description: 'Customer or buyer full name.' },
          client_phone: { type: 'string', description: 'Customer phone number.' },
          client_email: { type: 'string', description: 'Customer email address.' },
          client_address: { type: 'string', description: 'Customer billing or shipping destination address.' },
          is_interstate: { type: 'boolean', description: 'Whether this is an inter-state delivery (assessing IGST).' },
          courier_dispatch: { type: 'boolean', description: 'Whether order is being shipped via courier cargo.' },
          courier_tracking: { type: 'string', description: 'Courier tracking AWB number.' },
          technician_notes: { type: 'string', description: 'Assembly notes or warranty details.' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sku: { type: 'string' },
                description: { type: 'string' },
                quantity: { type: 'number' },
                unit_price: { type: 'number' },
                hsn_code: { type: 'string' },
                gst_rate: { type: 'number' },
              },
              required: ['description', 'quantity'],
            },
          },
        },
        required: ['client_name', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_customer_notification',
      description: 'Sends the customer an instant SMS and WhatsApp notification with the invoice PDF link and payment portal / UPI QR.',
      parameters: {
        type: 'object',
        properties: {
          invoice_id: {
            type: 'string',
            description: 'The invoice ID generated, e.g. "INV-1042-4912".',
          },
          method: {
            type: 'string',
            enum: ['sms', 'email', 'both'],
            description: 'Notification delivery method (defaults to both).',
          },
        },
        required: ['invoice_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_next_job_and_route',
      description: 'Retrieves the technician\'s next scheduled dispatch ticket, navigation route, transit drive time, and customer issue.',
      parameters: {
        type: 'object',
        properties: {
          current_work_order_id: {
            type: 'string',
            description: 'The work order just completed, e.g. "WO-1042".',
          },
        },
      },
    },
  },
];
