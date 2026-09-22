export interface WorkOrder {
  id: string;
  clientName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  equipment: string;
  serialNumber: string;
  reportedIssue: string;
  status: 'DISPATCHED' | 'IN_PROGRESS' | 'COMPLETED';
  hourlyRate: number;
  isWarranty: boolean;
  dispatchedAt: string;
  completedAt?: string;
  resolutionNotes?: string;
  invoiceId?: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  ownerName: string;
  businessType: 'CUSTOM_PC_BUILDER' | 'FIELD_SERVICE_TRADE' | 'GARMENT_RETAIL' | 'BOOK_SHOP' | 'GENERAL_RETAIL' | 'PLUMBER' | 'ELECTRICIAN';
  region: 'INDIA' | 'GLOBAL';
  businessCategory: 'RETAIL_SHOP' | 'SERVICE_TRADE';
  tradeType: 'PC_BUILDER' | 'PLUMBER' | 'ELECTRICIAN' | 'HVAC_TECHNICIAN' | 'GARMENT_STORE' | 'BOOK_STORE' | 'GENERAL';
  gstin?: string;
  state: string;
  stateCode: string; // e.g. "29" for Karnataka, "19" for WB, "27" for Maharashtra, "TX" for Texas
  country?: string;
  address: string;
  phone: string;
  email: string;
  currency: 'INR' | 'USD' | 'EUR' | 'GBP';
  currencySymbol: string;
  taxSystem: 'GST_INDIA' | 'CUSTOM_TAX' | 'US_SALES_TAX';
  customTaxRate?: number; // e.g. 0.0825 (8.25%), 0.10 (10%), 0.20 (20% VAT) set by shopkeeper
  customTaxLabel?: string; // e.g. "State Sales Tax (8.25%)", "UK VAT (20%)", "Custom Tax"
  upiId?: string; // e.g. "apexpc@okhdfcbank"
  courierPartner?: string; // e.g. "BlueDart Express Courier"
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branch: string;
  };
}

export interface CatalogItem {
  sku: string;
  name: string;
  category: string;
  aliases: string[];
  hsnCode: string; // e.g. "8471" for computer parts, "9954" for assembly/repairs, "9968" for air cargo/courier
  basePrice: number; // in ₹ or $
  gstRate: number; // 0.18 (18%), 0.12 (12%), 0.05 (5%), 0.28 (28%), 0.00
  stock: number;
  minStockThreshold: number;
  unit: string;
}

export interface TruckInventoryPart {
  sku: string;
  name: string;
  aliases: string[];
  truckStock: number;
  minStockThreshold: number;
  wholesaleCost: number;
  retailPrice: number;
  unit: string;
  hsnCode?: string;
  gstRate?: number;
}

export interface InvoiceItem {
  sku?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  type: 'PART' | 'LABOR' | 'FEE' | 'SHIPPING';
  hsnCode?: string;
  gstRate?: number;
  taxableValue?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
}

export interface AuditEntry {
  timestamp: string;
  eventType:
    | 'UTTERANCE_CAPTURED'
    | 'SKU_MATCHED'
    | 'INVENTORY_VERIFIED'
    | 'BILLING_CALCULATED'
    | 'CORRECTION_APPLIED'
    | 'TECHNICIAN_CONFIRMED'
    | 'INVOICE_COMMITTED'
    | 'PAYMENT_SETTLED'
    | 'ERP_SYNCED';
  source: 'technician' | 'agent' | 'system';
  detail: string;
  rawData?: Record<string, any>;
  confidence?: number;
  isCritical?: boolean;
}

export interface Invoice {
  id: string;
  workOrderId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  equipmentInfo: string;
  items: InvoiceItem[];
  laborHours: number;
  laborRate: number;
  laborTotal: number;
  partsTotal: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  taxJurisdiction?: string;
  taxDisclaimer?: string;
  technicianNotes: string;
  createdAt: string;
  status: 'DRAFT' | 'ISSUED' | 'SENT' | 'PAID';
  pdfFileName?: string;
  paymentUrl?: string;
  auditLog?: AuditEntry[];
  // Multi-business & Indian GST extensions
  profileId?: string;
  shopName?: string;
  shopGstin?: string;
  shopOwner?: string;
  placeOfSupply?: string;
  isInterState?: boolean;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  shippingFee?: number;
  courierPartner?: string;
  courierTracking?: string;
  upiPaymentString?: string;
  upiQrDataUrl?: string;
  totalInWords?: string;
  currency?: 'INR' | 'USD' | 'EUR' | 'GBP';
  currencySymbol?: string;
  customTaxRate?: number;
  customTaxLabel?: string;
}

export class MockDatabase {
  private workOrders: Map<string, WorkOrder> = new Map();
  private inventory: Map<string, TruckInventoryPart> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private profiles: Map<string, BusinessProfile> = new Map();
  private activeProfileId: string = 'hvac-fleet';
  private catalog: Map<string, CatalogItem> = new Map();

  constructor() {
    this.seed();
  }

  private seed() {
    // Work Orders Seed Data
    const initialWorkOrders: WorkOrder[] = [
      {
        id: 'WO-1042',
        clientName: 'Johnson Cold Storage',
        contactPerson: 'Marcus Johnson',
        phone: '+1-555-019-2834',
        email: 'marcus@johnsoncold.com',
        address: '440 Industrial Parkway, Bay 3, Austin, TX',
        equipment: 'Carrier WeatherMaker 5-Ton Commercial RTU (Model: 48TC-D06)',
        serialNumber: 'CAR-2021-99814',
        reportedIssue: 'Unit blowing ambient air; breaker tripping under heavy cooling load during peak hours.',
        status: 'IN_PROGRESS',
        hourlyRate: 125.0,
        isWarranty: false,
        dispatchedAt: '2026-09-21T08:15:00Z',
      },
      {
        id: 'WO-1043',
        clientName: 'Metro 24 Diner',
        contactPerson: 'Sarah Jenkins',
        phone: '+1-555-014-9921',
        email: 'sarah@metro24diner.com',
        address: '1202 S Congress Ave, Austin, TX',
        equipment: 'Bohn Walk-In Freezer Evaporator & Condenser Assembly',
        serialNumber: 'BOHN-2019-44102',
        reportedIssue: 'Walk-in freezer coil icing up; evaporator fan motor vibrating loudly.',
        status: 'DISPATCHED',
        hourlyRate: 125.0,
        isWarranty: false,
        dispatchedAt: '2026-09-21T10:00:00Z',
      },
      {
        id: 'WO-1044',
        clientName: 'Oakridge Dental Clinic',
        contactPerson: 'Dr. Robert Chen',
        phone: '+1-555-017-8812',
        email: 'office@oakridgedental.org',
        address: '7800 MoPac Expy, Suite 210, Austin, TX',
        equipment: 'Trane XR16 4-Ton Heat Pump with CleanEffects Air Cleaner',
        serialNumber: 'TRN-2022-77210',
        reportedIssue: 'Airflow restricted across operatory 2 and 3; thermostat reading error code 88.',
        status: 'DISPATCHED',
        hourlyRate: 135.0,
        isWarranty: true,
        dispatchedAt: '2026-09-21T11:30:00Z',
      },
      {
        id: 'WO-1045',
        clientName: 'Lincoln Logistics Warehouse',
        contactPerson: 'David Miller',
        phone: '+1-555-012-3344',
        email: 'dmiller@lincolnlogistics.net',
        address: '9500 Freight Way, Dock 14, Buda, TX',
        equipment: 'Lennox Landmark 10-Ton Rooftop Package Unit',
        serialNumber: 'LNX-2020-55112',
        reportedIssue: 'High pressure safety switch trip; condenser coils heavily fouled with dust and cottonwood.',
        status: 'DISPATCHED',
        hourlyRate: 125.0,
        isWarranty: false,
        dispatchedAt: '2026-09-21T13:00:00Z',
      },
    ];

    for (const wo of initialWorkOrders) {
      this.workOrders.set(wo.id, wo);
    }

    // Truck Inventory Seed Data (Van #14)
    const initialInventory: TruckInventoryPart[] = [
      {
        sku: 'CAP-45-5',
        name: 'Titan HD 45/5 MFD 440V Dual Run Round Capacitor',
        aliases: ['capacitor', '45 microfarad', '45/5', 'dual run capacitor', 'run cap', '45 cap'],
        truckStock: 4,
        minStockThreshold: 2,
        wholesaleCost: 22.5,
        retailPrice: 165.0,
        unit: 'unit',
      },
      {
        sku: 'CONT-24V-40A',
        name: 'Siemens 2-Pole 40A Definite Purpose Contactor (24V Coil)',
        aliases: ['contactor', '24v contactor', '40 amp contactor', 'relay', 'contactor switch'],
        truckStock: 3,
        minStockThreshold: 2,
        wholesaleCost: 17.5,
        retailPrice: 95.0,
        unit: 'unit',
      },
      {
        sku: 'REFR-410A-LBS',
        name: 'Virgin Puron R-410A Refrigerant',
        aliases: ['r410a', 'freon', '410a', 'refrigerant', 'puron', 'gas'],
        truckStock: 22,
        minStockThreshold: 10,
        wholesaleCost: 14.0,
        retailPrice: 45.0,
        unit: 'lbs',
      },
      {
        sku: 'CHEM-VIPER-FLUSH',
        name: 'Nu-Calgon Viper Drain & Condensate Line Chemical Flush',
        aliases: ['condensate flush', 'line flush', 'drain cleaner', 'viper flush', 'vinegar', 'flush gallon'],
        truckStock: 5,
        minStockThreshold: 2,
        wholesaleCost: 9.0,
        retailPrice: 35.0,
        unit: 'gal',
      },
      {
        sku: 'MOTOR-ECM-13',
        name: 'Century 1/3 HP 1075 RPM Condenser Fan Motor (Multi-mount)',
        aliases: ['fan motor', 'condenser motor', 'fan', 'motor', 'blower motor'],
        truckStock: 2,
        minStockThreshold: 1,
        wholesaleCost: 88.0,
        retailPrice: 245.0,
        unit: 'unit',
      },
      {
        sku: 'FILTER-MERV11-16X25',
        name: 'Dynamic Air Pleated Filter MERV 11 (16x25x1)',
        aliases: ['filter', 'air filter', 'merv 11', '16x25 filter'],
        truckStock: 8,
        minStockThreshold: 3,
        wholesaleCost: 7.2,
        retailPrice: 28.0,
        unit: 'unit',
      },
      {
        sku: 'WIRE-STAT-188',
        name: 'Southwire 18/8 Solid Copper Thermostat Wire (50ft spool)',
        aliases: ['thermostat wire', 'tstat wire', '18-8 wire', 'wire spool'],
        truckStock: 4,
        minStockThreshold: 2,
        wholesaleCost: 16.0,
        retailPrice: 48.0,
        unit: 'spool',
      },
      {
        sku: 'BRASS-SERVICE-VALVE',
        name: 'C&D 1/4" Flare Access Service Valve with Core',
        aliases: ['service valve', 'schraeder valve', 'flare valve', 'access port'],
        truckStock: 10,
        minStockThreshold: 4,
        wholesaleCost: 3.5,
        retailPrice: 18.0,
        unit: 'unit',
      },
    ];

    for (const item of initialInventory) {
      this.inventory.set(item.sku, item);
    }

    // Business Profiles Seed Data
    const initialProfiles: BusinessProfile[] = [
      // 🇮🇳 INDIA PROFILES (Government Statutory GST System)
      {
        id: 'custom-pc-builder',
        name: 'Apex Custom Tech & PC Studio',
        ownerName: 'Vikramaditya Roy',
        businessType: 'CUSTOM_PC_BUILDER',
        region: 'INDIA',
        businessCategory: 'RETAIL_SHOP',
        tradeType: 'PC_BUILDER',
        gstin: '29AABCA1234F1Z5',
        state: 'Karnataka',
        stateCode: '29',
        country: 'India',
        address: '#42 SP Road, Silicon Plaza, Bengaluru, Karnataka 560002',
        phone: '+91 98450 12345',
        email: 'orders@apexpcstudio.in',
        currency: 'INR',
        currencySymbol: '₹',
        taxSystem: 'GST_INDIA',
        upiId: 'apexpc@okhdfcbank',
        courierPartner: 'BlueDart Express Courier (Air & Surface Cargo)',
        bankDetails: {
          bankName: 'HDFC Bank',
          accountNumber: '50200084719283',
          ifscCode: 'HDFC0001234',
          branch: 'SP Road Commercial Branch, Bengaluru',
        },
      },
      {
        id: 'india-plumber',
        name: 'JalShakti Plumbing & Sanitary Works',
        ownerName: 'Ramesh Sharma',
        businessType: 'PLUMBER',
        region: 'INDIA',
        businessCategory: 'SERVICE_TRADE',
        tradeType: 'PLUMBER',
        gstin: '27AAACJ8899K1Z4',
        state: 'Maharashtra',
        stateCode: '27',
        country: 'India',
        address: 'Shop 14, Link Road Commercial Complex, Andheri West, Mumbai 400053',
        phone: '+91 98201 44556',
        email: 'service@jalshaktiplumbing.in',
        currency: 'INR',
        currencySymbol: '₹',
        taxSystem: 'GST_INDIA',
        upiId: 'jalshakti@upi',
        bankDetails: {
          bankName: 'State Bank of India',
          accountNumber: '30998822110',
          ifscCode: 'SBIN0001824',
          branch: 'Andheri West Commercial Branch, Mumbai',
        },
      },
      {
        id: 'india-electrician',
        name: 'PowerCraft Electricals & Home Wiring',
        ownerName: 'Rajesh Kumar',
        businessType: 'ELECTRICIAN',
        region: 'INDIA',
        businessCategory: 'SERVICE_TRADE',
        tradeType: 'ELECTRICIAN',
        gstin: '07AAACP4455L1Z1',
        state: 'Delhi',
        stateCode: '07',
        country: 'India',
        address: 'C-28 Connaught Place Outer Circle, New Delhi 110001',
        phone: '+91 98110 33221',
        email: 'contact@powercraftwiring.in',
        currency: 'INR',
        currencySymbol: '₹',
        taxSystem: 'GST_INDIA',
        upiId: 'powercraft@paytm',
        bankDetails: {
          bankName: 'Punjab National Bank',
          accountNumber: '018800210045678',
          ifscCode: 'PUNB0018800',
          branch: 'Connaught Place Branch, New Delhi',
        },
      },
      {
        id: 'india-technician',
        name: 'CoolCare AirCon & Appliance Service',
        ownerName: 'Sunil Rao',
        businessType: 'FIELD_SERVICE_TRADE',
        region: 'INDIA',
        businessCategory: 'SERVICE_TRADE',
        tradeType: 'HVAC_TECHNICIAN',
        gstin: '29AAACC1122M1Z8',
        state: 'Karnataka',
        stateCode: '29',
        country: 'India',
        address: '108 Indiranagar 100ft Road, Bengaluru 560038',
        phone: '+91 98800 77665',
        email: 'repairs@coolcareindia.in',
        currency: 'INR',
        currencySymbol: '₹',
        taxSystem: 'GST_INDIA',
        upiId: 'coolcare@icici',
      },
      {
        id: 'retail-store',
        name: 'Metro Garments & Book Mart',
        ownerName: 'Amitava Banerjee',
        businessType: 'GARMENT_RETAIL',
        region: 'INDIA',
        businessCategory: 'RETAIL_SHOP',
        tradeType: 'GARMENT_STORE',
        gstin: '19ABCDE5678G1Z2',
        state: 'West Bengal',
        stateCode: '19',
        country: 'India',
        address: '84 College Street, Kolkata, West Bengal 700073',
        phone: '+91 98301 98765',
        email: 'billing@metroretail.in',
        currency: 'INR',
        currencySymbol: '₹',
        taxSystem: 'GST_INDIA',
        upiId: 'metrobooks@upi',
        courierPartner: 'Delhivery Surface Logistics',
      },

      // 🌍 GLOBAL / OTHER PROFILES (Shopkeeper-Configured Custom Country Tax)
      {
        id: 'hvac-fleet',
        name: 'Apex Commercial HVAC Fleet',
        ownerName: 'David Miller',
        businessType: 'FIELD_SERVICE_TRADE',
        region: 'GLOBAL',
        businessCategory: 'SERVICE_TRADE',
        tradeType: 'HVAC_TECHNICIAN',
        state: 'Texas',
        stateCode: 'TX',
        country: 'United States',
        address: '1204 Industrial Blvd, Austin, TX 78701',
        phone: '(512) 555-0199',
        email: 'service@apexhvac.com',
        currency: 'USD',
        currencySymbol: '$',
        taxSystem: 'CUSTOM_TAX',
        customTaxRate: 0.0825,
        customTaxLabel: 'Travis County Sales Tax (8.25%)',
      },
      {
        id: 'global-pc-builder',
        name: 'Falcon Custom Rig Studios',
        ownerName: 'Tyler Vance',
        businessType: 'CUSTOM_PC_BUILDER',
        region: 'GLOBAL',
        businessCategory: 'RETAIL_SHOP',
        tradeType: 'PC_BUILDER',
        state: 'Washington',
        stateCode: 'WA',
        country: 'United States',
        address: '2201 4th Ave, Belltown, Seattle, WA 98121',
        phone: '(206) 555-0819',
        email: 'builds@falconrigs.com',
        currency: 'USD',
        currencySymbol: '$',
        taxSystem: 'CUSTOM_TAX',
        customTaxRate: 0.1025,
        customTaxLabel: 'King County & Seattle Tax (10.25%)',
      },
      {
        id: 'global-plumber',
        name: 'Precision Master Plumbing & Drain Co.',
        ownerName: "Patrick O'Connor",
        businessType: 'PLUMBER',
        region: 'GLOBAL',
        businessCategory: 'SERVICE_TRADE',
        tradeType: 'PLUMBER',
        state: 'Illinois',
        stateCode: 'IL',
        country: 'United States',
        address: '1840 W Fulton St, Chicago, IL 60612',
        phone: '(312) 555-0144',
        email: 'dispatch@precisionplumbingchi.com',
        currency: 'USD',
        currencySymbol: '$',
        taxSystem: 'CUSTOM_TAX',
        customTaxRate: 0.0900,
        customTaxLabel: 'Cook County Sales Tax (9.00%)',
      },
      {
        id: 'global-electrician',
        name: 'VoltMaster Commercial Electrical Services',
        ownerName: 'Elena Rostova',
        businessType: 'ELECTRICIAN',
        region: 'GLOBAL',
        businessCategory: 'SERVICE_TRADE',
        tradeType: 'ELECTRICIAN',
        state: 'Colorado',
        stateCode: 'CO',
        country: 'United States',
        address: '3300 Walnut St, Denver, CO 80205',
        phone: '(720) 555-0388',
        email: 'commercial@voltmasterelectric.com',
        currency: 'USD',
        currencySymbol: '$',
        taxSystem: 'CUSTOM_TAX',
        customTaxRate: 0.0765,
        customTaxLabel: 'Denver Metro Sales Tax (7.65%)',
      },
      {
        id: 'global-garments-books',
        name: 'Kingsway Books & Tailored Apparel',
        ownerName: 'Arthur Pendelton',
        businessType: 'GARMENT_RETAIL',
        region: 'GLOBAL',
        businessCategory: 'RETAIL_SHOP',
        tradeType: 'GARMENT_STORE',
        state: 'Greater London',
        stateCode: 'LON',
        country: 'United Kingdom',
        address: '45 Kingsway, Holborn, London WC2B 6TE',
        phone: '+44 20 7946 0912',
        email: 'info@kingswaylondon.co.uk',
        currency: 'GBP',
        currencySymbol: '£',
        taxSystem: 'CUSTOM_TAX',
        customTaxRate: 0.2000,
        customTaxLabel: 'UK Value Added Tax (20.00% VAT)',
      },
    ];

    for (const p of initialProfiles) {
      this.profiles.set(p.id, p);
    }

    // Shop Catalog Seed Data (Custom PC Components, Garments, Books & Logistics)
    const initialCatalog: CatalogItem[] = [
      {
        sku: 'CPU-AMD-5600X',
        name: 'AMD Ryzen 5 5600X 6-Core Processor',
        category: 'Processors',
        aliases: ['ryzen 5', '5600x', 'amd ryzen 5600x', 'ryzen 5 5600x processor', 'ryzen processor'],
        hsnCode: '8471',
        basePrice: 14200,
        gstRate: 0.18,
        stock: 12,
        minStockThreshold: 3,
        unit: 'pcs',
      },
      {
        sku: 'CPU-INTEL-13400F',
        name: 'Intel Core i5-13400F 10-Core Processor',
        category: 'Processors',
        aliases: ['i5 13400f', 'intel i5', '13400f', 'i5 processor', 'intel processor'],
        hsnCode: '8471',
        basePrice: 18500,
        gstRate: 0.18,
        stock: 6,
        minStockThreshold: 2,
        unit: 'pcs',
      },
      {
        sku: 'GPU-RTX-4060-8G',
        name: 'NVIDIA GeForce RTX 4060 8GB GDDR6',
        category: 'Graphics Cards',
        aliases: ['rtx 4060', '4060', 'geforce 4060', 'rtx 4060 graphics card', 'gpu', 'graphics card'],
        hsnCode: '8471',
        basePrice: 28500,
        gstRate: 0.18,
        stock: 7,
        minStockThreshold: 2,
        unit: 'pcs',
      },
      {
        sku: 'GPU-RTX-4070-12G',
        name: 'ZOTAC Gaming GeForce RTX 4070 Twin Edge 12GB',
        category: 'Graphics Cards',
        aliases: ['rtx 4070', '4070', 'rtx 4070 12gb', '4070 gpu'],
        hsnCode: '8471',
        basePrice: 53500,
        gstRate: 0.18,
        stock: 4,
        minStockThreshold: 1,
        unit: 'pcs',
      },
      {
        sku: 'MB-MSI-B550M',
        name: 'MSI B550M PRO-VDH WiFi Motherboard',
        category: 'Motherboards',
        aliases: ['b550m', 'b550', 'b550 motherboard', 'motherboard', 'msi b550m', 'msi board'],
        hsnCode: '8471',
        basePrice: 8900,
        gstRate: 0.18,
        stock: 9,
        minStockThreshold: 3,
        unit: 'pcs',
      },
      {
        sku: 'RAM-COR-16G-DDR4',
        name: 'Corsair Vengeance LPX 16GB DDR4 3200MHz',
        category: 'Memory',
        aliases: ['corsair ram', '16gb ram', 'ram', 'ddr4 ram', '16gb corsair ddr4', 'memory'],
        hsnCode: '8471',
        basePrice: 3400,
        gstRate: 0.18,
        stock: 24,
        minStockThreshold: 5,
        unit: 'pcs',
      },
      {
        sku: 'SSD-1TB-GEN4',
        name: 'Crucial P3 Plus 1TB PCIe M.2 NVMe SSD',
        category: 'Storage',
        aliases: ['1tb ssd', 'nvme ssd', '1tb nvme', 'm.2 ssd', 'crucial 1tb ssd', 'ssd', 'hard drive'],
        hsnCode: '8471',
        basePrice: 6200,
        gstRate: 0.18,
        stock: 15,
        minStockThreshold: 4,
        unit: 'pcs',
      },
      {
        sku: 'PSU-650W-BRONZE',
        name: 'DeepCool PK650D 650W 80+ Bronze Power Supply',
        category: 'Power Supplies',
        aliases: ['650w psu', 'power supply', 'psu', '650 watt smps', 'deepcool 650w', 'power pack'],
        hsnCode: '8471',
        basePrice: 4800,
        gstRate: 0.18,
        stock: 10,
        minStockThreshold: 3,
        unit: 'pcs',
      },
      {
        sku: 'CASE-ANT-ESPORTS-ICE',
        name: 'Ant Esports ICE-112 Mid-Tower Gaming Cabinet',
        category: 'Cabinets',
        aliases: ['cabinet', 'case', 'gaming cabinet', 'pc case', 'ant esports case', 'chassis'],
        hsnCode: '8471',
        basePrice: 4500,
        gstRate: 0.18,
        stock: 8,
        minStockThreshold: 2,
        unit: 'pcs',
      },
      {
        sku: 'SVC-PC-BUILD-TEST',
        name: 'Custom PC Assembly, Cable Routing & Stress Testing',
        category: 'Services',
        aliases: ['assembly', 'pc assembly', 'building charge', 'labour', 'assembly service', 'testing'],
        hsnCode: '9954',
        basePrice: 1500,
        gstRate: 0.18,
        stock: 999,
        minStockThreshold: 10,
        unit: 'service',
      },
      {
        sku: 'SHP-COURIER-AIR',
        name: 'Insured Air Cargo Courier Dispatch (BlueDart)',
        category: 'Logistics',
        aliases: ['courier', 'shipping', 'courier shipping', 'delivery charge', 'cargo', 'courier charge'],
        hsnCode: '9968',
        basePrice: 850,
        gstRate: 0.18,
        stock: 999,
        minStockThreshold: 10,
        unit: 'trip',
      },
      {
        sku: 'GAR-POLO-CTN-01',
        name: "Men's Premium Cotton Polo Shirt (Navy Blue)",
        category: 'Apparel',
        aliases: ['polo shirt', 't-shirt', 'shirt', 'cotton polo', 'tshirt'],
        hsnCode: '6109',
        basePrice: 899,
        gstRate: 0.05,
        stock: 35,
        minStockThreshold: 10,
        unit: 'pcs',
      },
      {
        sku: 'BK-TECH-PY-2026',
        name: 'Python Masterclass & AI Systems Architecture',
        category: 'Books',
        aliases: ['python book', 'coding book', 'book', 'programming book'],
        hsnCode: '4901',
        basePrice: 650,
        gstRate: 0.0,
        stock: 20,
        minStockThreshold: 5,
        unit: 'copies',
      },

      // 🚰 Plumbing & Sanitary Materials & Services (For Plumbers in India & Global)
      {
        sku: 'PLUMB-VALVE-BRASS-1IN',
        name: 'Heavy Duty 1-Inch Brass Ball Valve with Lever Handle',
        category: 'Plumbing',
        aliases: ['brass valve', 'ball valve', 'brass ball valve', 'water valve', 'shutoff valve', '1 inch valve', 'valve'],
        hsnCode: '8481',
        basePrice: 650,
        gstRate: 0.18,
        stock: 18,
        minStockThreshold: 4,
        unit: 'pcs',
      },
      {
        sku: 'PLUMB-PVC-PIPE-10FT',
        name: 'Astral 1.5-Inch Schedule 40 Rigid PVC Pressure Pipe (10ft)',
        category: 'Plumbing',
        aliases: ['pvc pipe', 'pipe', 'drain pipe', '1.5 inch pipe', 'water pipe', 'plastic pipe'],
        hsnCode: '3917',
        basePrice: 480,
        gstRate: 0.18,
        stock: 25,
        minStockThreshold: 5,
        unit: 'length',
      },
      {
        sku: 'PLUMB-FAUCET-CARTRIDGE',
        name: 'Quarter-Turn Ceramic Disc Tap & Faucet Cartridge',
        category: 'Plumbing',
        aliases: ['tap cartridge', 'faucet cartridge', 'tap valve', 'spindle', 'ceramic cartridge', 'faucet repair'],
        hsnCode: '8481',
        basePrice: 350,
        gstRate: 0.18,
        stock: 30,
        minStockThreshold: 5,
        unit: 'pcs',
      },
      {
        sku: 'SVC-PLUMB-AUGER-DRAIN',
        name: 'Motorized Drain Snake Augering & Severe Clog Clearance Service',
        category: 'Plumbing',
        aliases: ['drain snake', 'drain cleaning', 'clog removal', 'augering', 'snake service', 'unclog drain'],
        hsnCode: '9954',
        basePrice: 1200,
        gstRate: 0.18,
        stock: 999,
        minStockThreshold: 10,
        unit: 'service',
      },
      {
        sku: 'SVC-PLUMB-REPAIR-LABOR',
        name: 'Master Plumber Diagnostic & Pipe Fitting Service Labor',
        category: 'Plumbing',
        aliases: ['plumbing labor', 'plumber charge', 'pipe repair', 'plumbing service', 'fitting charge'],
        hsnCode: '9954',
        basePrice: 800,
        gstRate: 0.18,
        stock: 999,
        minStockThreshold: 10,
        unit: 'service',
      },

      // ⚡ Electrical Materials & Wiring Services (For Electricians in India & Global)
      {
        sku: 'ELEC-WIRE-COPPER-2.5',
        name: 'Havells 2.5 sq mm FR Flame Retardant Copper Wire (90m Coil)',
        category: 'Electrical',
        aliases: ['copper wire', 'wire roll', '2.5 wire', 'electrical wire', 'havells wire', 'house wire', 'cable'],
        hsnCode: '8544',
        basePrice: 2450,
        gstRate: 0.18,
        stock: 14,
        minStockThreshold: 3,
        unit: 'coil',
      },
      {
        sku: 'ELEC-MCB-32A-DP',
        name: 'Schneider Electric Acti9 32A Double Pole C-Curve MCB Breaker',
        category: 'Electrical',
        aliases: ['mcb', 'breaker', '32a mcb', 'circuit breaker', 'main switch', 'double pole mcb', 'mcb switch'],
        hsnCode: '8536',
        basePrice: 720,
        gstRate: 0.18,
        stock: 22,
        minStockThreshold: 5,
        unit: 'pcs',
      },
      {
        sku: 'ELEC-LED-PANEL-15W',
        name: 'Philips 15W Slim Round Recessed LED Ceiling Downlight',
        category: 'Electrical',
        aliases: ['led light', 'panel light', 'ceiling light', '15w led', 'downlight', 'led bulb'],
        hsnCode: '9405',
        basePrice: 490,
        gstRate: 0.12,
        stock: 40,
        minStockThreshold: 8,
        unit: 'pcs',
      },
      {
        sku: 'SVC-ELEC-WIRING-LABOR',
        name: 'Licensed Electrician Diagnostic & Panel Wiring Labor',
        category: 'Electrical',
        aliases: ['electrician labor', 'electrician charge', 'wiring service', 'wiring labor', 'electrical repair'],
        hsnCode: '9954',
        basePrice: 750,
        gstRate: 0.18,
        stock: 999,
        minStockThreshold: 10,
        unit: 'service',
      },
    ];

    for (const c of initialCatalog) {
      this.catalog.set(c.sku, c);
    }
  }

  // Business Profile methods
  public getAllProfiles(): BusinessProfile[] {
    return Array.from(this.profiles.values());
  }

  public getProfilesByRegion(region: 'INDIA' | 'GLOBAL'): BusinessProfile[] {
    return Array.from(this.profiles.values()).filter((p) => p.region === region);
  }

  public getActiveProfile(): BusinessProfile {
    const p = this.profiles.get(this.activeProfileId);
    if (!p) {
      // Fallback
      return Array.from(this.profiles.values())[0];
    }
    return p;
  }

  public setActiveProfile(id: string): BusinessProfile {
    if (this.profiles.has(id)) {
      this.activeProfileId = id;
    }
    return this.getActiveProfile();
  }

  public updateProfileTaxRate(
    profileId: string,
    customTaxRate: number,
    customTaxLabel?: string
  ): BusinessProfile | undefined {
    const p = this.profiles.get(profileId);
    if (!p) return undefined;
    p.customTaxRate = customTaxRate;
    if (customTaxLabel) p.customTaxLabel = customTaxLabel;
    this.profiles.set(profileId, p);
    return p;
  }

  // Work Orders methods
  public getWorkOrder(id: string): WorkOrder | undefined {
    return this.workOrders.get(id);
  }

  public getAllWorkOrders(): WorkOrder[] {
    return Array.from(this.workOrders.values());
  }

  public findWorkOrder(query: string): WorkOrder | undefined {
    const q = query.trim().toLowerCase();
    for (const wo of this.workOrders.values()) {
      if (
        wo.id.toLowerCase() === q ||
        wo.clientName.toLowerCase().includes(q) ||
        wo.contactPerson.toLowerCase().includes(q) ||
        wo.address.toLowerCase().includes(q)
      ) {
        return wo;
      }
    }
    return undefined;
  }

  public updateWorkOrder(id: string, updates: Partial<WorkOrder>): WorkOrder | undefined {
    const existing = this.workOrders.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.workOrders.set(id, updated);
    return updated;
  }

  // Shop Catalog methods
  public getAllCatalog(): CatalogItem[] {
    return Array.from(this.catalog.values());
  }

  public getCatalogItem(sku: string): CatalogItem | undefined {
    return this.catalog.get(sku);
  }

  public findCatalogItemByQuery(query: string): CatalogItem | undefined {
    const q = query.trim().toLowerCase();
    // Direct SKU match
    for (const item of this.catalog.values()) {
      if (item.sku.toLowerCase() === q) return item;
    }
    // Name exact / substring match
    for (const item of this.catalog.values()) {
      if (item.name.toLowerCase().includes(q) || q.includes(item.name.toLowerCase())) return item;
    }
    // Alias matches
    for (const item of this.catalog.values()) {
      for (const alias of item.aliases) {
        if (q.includes(alias.toLowerCase()) || alias.toLowerCase().includes(q)) {
          return item;
        }
      }
    }
    return undefined;
  }

  public addOrUpdateCatalogItem(item: Partial<CatalogItem> & { name: string }): CatalogItem {
    const sku = item.sku || `SKU-${Date.now().toString().slice(-6)}`;
    const existing = this.catalog.get(sku);
    const updated: CatalogItem = {
      sku,
      name: item.name,
      category: item.category || existing?.category || 'General',
      aliases: item.aliases || existing?.aliases || [item.name.toLowerCase()],
      hsnCode: item.hsnCode || existing?.hsnCode || '8471',
      basePrice: typeof item.basePrice === 'number' ? item.basePrice : existing?.basePrice || 100,
      gstRate: typeof item.gstRate === 'number' ? item.gstRate : existing?.gstRate ?? 0.18,
      stock: typeof item.stock === 'number' ? item.stock : existing?.stock || 10,
      minStockThreshold: typeof item.minStockThreshold === 'number' ? item.minStockThreshold : existing?.minStockThreshold || 2,
      unit: item.unit || existing?.unit || 'pcs',
    };
    this.catalog.set(sku, updated);
    return updated;
  }

  public deleteCatalogItem(sku: string): boolean {
    return this.catalog.delete(sku);
  }

  public deductCatalogStock(sku: string, quantity: number): { success: boolean; remaining: number; reorderNeeded: boolean } {
    const item = this.catalog.get(sku);
    if (!item) return { success: false, remaining: 0, reorderNeeded: false };

    item.stock = Math.max(0, item.stock - quantity);
    const reorderNeeded = item.stock <= item.minStockThreshold;
    return {
      success: true,
      remaining: item.stock,
      reorderNeeded,
    };
  }

  // Inventory methods
  public getAllInventory(): TruckInventoryPart[] {
    return Array.from(this.inventory.values());
  }

  public findPartByQuery(query: string): TruckInventoryPart | undefined {
    const q = query.trim().toLowerCase();
    
    // Direct SKU match in truck inventory
    for (const item of this.inventory.values()) {
      if (item.sku.toLowerCase() === q) return item;
    }

    // Name match in truck inventory
    for (const item of this.inventory.values()) {
      if (item.name.toLowerCase().includes(q)) return item;
    }

    // Alias matches in truck inventory
    for (const item of this.inventory.values()) {
      for (const alias of item.aliases) {
        if (q.includes(alias) || alias.includes(q)) {
          return item;
        }
      }
    }

    // Fallback: check in shop catalog and adapt to TruckInventoryPart!
    const catalogItem = this.findCatalogItemByQuery(query);
    if (catalogItem) {
      return {
        sku: catalogItem.sku,
        name: catalogItem.name,
        aliases: catalogItem.aliases,
        truckStock: catalogItem.stock,
        minStockThreshold: catalogItem.minStockThreshold,
        wholesaleCost: Math.round(catalogItem.basePrice * 0.8),
        retailPrice: catalogItem.basePrice,
        unit: catalogItem.unit,
        hsnCode: catalogItem.hsnCode,
        gstRate: catalogItem.gstRate,
      };
    }

    return undefined;
  }

  public deductInventory(sku: string, quantity: number): { success: boolean; remaining: number; reorderNeeded: boolean } {
    // If in truck inventory
    const item = this.inventory.get(sku);
    if (item) {
      item.truckStock = Math.max(0, item.truckStock - quantity);
      const reorderNeeded = item.truckStock <= item.minStockThreshold;
      return {
        success: true,
        remaining: item.truckStock,
        reorderNeeded,
      };
    }

    // If in shop catalog
    if (this.catalog.has(sku)) {
      return this.deductCatalogStock(sku, quantity);
    }

    return { success: false, remaining: 0, reorderNeeded: false };
  }

  // Invoices methods
  public saveInvoice(invoice: Invoice): Invoice {
    this.invoices.set(invoice.id, invoice);
    return invoice;
  }

  public getInvoice(id: string): Invoice | undefined {
    return this.invoices.get(id);
  }

  public findInvoice(query: string): Invoice | undefined {
    const q = query.trim().toLowerCase();
    for (const inv of this.invoices.values()) {
      if (
        inv.id.toLowerCase() === q ||
        inv.workOrderId.toLowerCase() === q ||
        inv.id.toLowerCase().includes(q)
      ) {
        return inv;
      }
    }
    return undefined;
  }

  public getAllInvoices(): Invoice[] {
    return Array.from(this.invoices.values());
  }

  public resetToDefault() {
    this.workOrders.clear();
    this.inventory.clear();
    this.invoices.clear();
    this.profiles.clear();
    this.catalog.clear();
    this.seed();
  }
}

export const db = new MockDatabase();
