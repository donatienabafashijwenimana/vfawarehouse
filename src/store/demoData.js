// Demo/seed data (spec §41) — used only in demo mode (no Supabase configured).

export const DEFAULT_STAGES = [
  'Selection',
  'Sorting',
  'Preparation',
  'Treatment',
  'Quality Checking',
  'Packaging',
  'Storage',
];

const today = new Date();
const fmt = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return fmt(d);
};
const id = () => `demo_${Math.random().toString(36).slice(2, 10)}`;

const U = {
  mgr: 'u_manager',
  staff1: 'u_staff1',
  staff2: 'u_staff2',
  cust: 'u_customer',
};

const C = {
  kinigi: 'cat_kinigi',
  victoria: 'cat_victoria',
  girinka: 'cat_girinka',
};

const SC = {
  prebasic: 'sc_prebasic',
  basic: 'sc_basic',
  certified: 'sc_certified',
};

const P = {
  kinigiCert: 'p_kinigi_cert',
  kinigiBasic: 'p_kinigi_basic',
  victoria: 'p_victoria',
  girinka: 'p_girinka',
};

const W = {
  main: 'w_main',
  cold: 'w_cold',
};

const B = {
  b1: 'b_2026_001',
  b2: 'b_2026_002',
  b3: 'b_2026_003',
  b4: 'b_2025_014',
};

const CU = {
  coop1: 'c_coop1',
  coop2: 'c_coop2',
  farmer1: 'c_farmer1',
  agro1: 'c_agro1',
};

const S = {
  s1: 's_2026_0001',
  s2: 's_2026_0002',
  s3: 's_2026_0003',
};

const O = {
  o1: 'o_2026_001',
  o2: 'o_2026_002',
};

function build() {
  const users = [
    {
      id: U.mgr,
      fullName: 'Aline Uwase',
      email: 'manager@vfa.rw',
      password: 'vfa2025',
      role: 'manager',
      roleLabel: 'Manager',
      status: 'ACTIVE',
      registered: '2024-01-05',
    },
    {
      id: U.staff1,
      fullName: 'Jean Bosco Nkurunziza',
      email: 'staff@vfa.rw',
      password: 'vfa2025',
      role: 'staff',
      roleLabel: 'Staff',
      status: 'ACTIVE',
      registered: '2024-03-12',
      permissions: [
        'dashboard.view', 'production.view', 'production.create', 'production.update',
        'quality.view', 'quality.create', 'inventory.view', 'inventory.update',
        'products.view', 'varieties.view', 'orders.view', 'orders.update',
      ],
    },
    {
      id: U.staff2,
      fullName: 'Claudine Mukamana',
      email: 'warehouse@vfa.rw',
      password: 'vfa2025',
      role: 'staff',
      roleLabel: 'Staff',
      status: 'ACTIVE',
      registered: '2024-06-20',
      permissions: [
        'dashboard.view', 'inventory.view', 'inventory.update', 'inventory.adjust',
        'warehouses.view', 'products.view', 'sales.view', 'sales.create',
      ],
    },
    {
      id: U.cust,
      fullName: 'Bugesera Agri Cooperative',
      email: 'customer@vfa.rw',
      password: 'vfa2025',
      role: 'customer',
      roleLabel: 'Customer',
      status: 'ACTIVE',
      registered: '2024-09-01',
      customer_id: CU.coop1,
    },
  ];

  const categories = [
    { id: 'cat_seed', name: 'Irish Potato Seeds', description: 'Certified seed potatoes produced by VFA', status: 'ACTIVE', created_at: daysAgo(500) },
    { id: 'cat_pkg', name: 'Packaging Materials', description: 'Bags and crates for seed packaging', status: 'ACTIVE', created_at: daysAgo(480) },
    { id: 'cat_prod', name: 'Production Materials', description: 'Inputs used in seed production', status: 'ACTIVE', created_at: daysAgo(460) },
    { id: 'cat_other', name: 'Other', description: 'Miscellaneous items', status: 'ACTIVE', created_at: daysAgo(400) },
  ];

  const seedClasses = [
    { id: SC.prebasic, name: 'Pre-basic', description: 'Early generation seed under lab control', status: 'ACTIVE' },
    { id: SC.basic, name: 'Basic', description: 'First field generation from pre-basic', status: 'ACTIVE' },
    { id: SC.certified, name: 'Certified', description: 'Certified seed for commercial growers', status: 'ACTIVE' },
  ];

  const varieties = [
    { id: C.kinigi, name: 'Kinigi', description: 'High-yield table & seed variety, popular in the north', seed_class_id: SC.certified, recommended_use: 'High altitude areas', status: 'ACTIVE' },
    { id: C.victoria, name: 'Victoria', description: 'Widely grown, good storage quality', seed_class_id: SC.certified, recommended_use: 'Mid altitude', status: 'ACTIVE' },
    { id: C.girinka, name: 'Girinka', description: 'Disease tolerant variety', seed_class_id: SC.basic, recommended_use: 'Disease-prone zones', status: 'ACTIVE' },
  ];

  const products = [
    {
      id: P.kinigiCert, name: 'Kinigi Certified Seed', sku: 'VFA-KIN-CER', category_id: 'cat_seed',
      variety_id: C.kinigi, seed_class_id: SC.certified, description: 'Certified Kinigi seed, graded 28–45 mm',
      unit: 'kg', selling_price: 900, minimum_stock: 500, status: 'ACTIVE',
      created_at: daysAgo(300), updated_at: daysAgo(10),
    },
    {
      id: P.kinigiBasic, name: 'Kinigi Basic Seed', sku: 'VFA-KIN-BAS', category_id: 'cat_seed',
      variety_id: C.kinigi, seed_class_id: SC.basic, description: 'Basic generation Kinigi seed',
      unit: 'kg', selling_price: 1200, minimum_stock: 300, status: 'ACTIVE',
      created_at: daysAgo(300), updated_at: daysAgo(8),
    },
    {
      id: P.victoria, name: 'Victoria Certified Seed', sku: 'VFA-VIC-CER', category_id: 'cat_seed',
      variety_id: C.victoria, seed_class_id: SC.certified, description: 'Certified Victoria seed, graded',
      unit: 'kg', selling_price: 850, minimum_stock: 400, status: 'ACTIVE',
      created_at: daysAgo(280), updated_at: daysAgo(15),
    },
    {
      id: P.girinka, name: 'Girinka Basic Seed', sku: 'VFA-GIR-BAS', category_id: 'cat_seed',
      variety_id: C.girinka, seed_class_id: SC.basic, description: 'Basic Girinka seed',
      unit: 'kg', selling_price: 1100, minimum_stock: 250, status: 'ACTIVE',
      created_at: daysAgo(200), updated_at: daysAgo(20),
    },
  ];

  const warehouses = [
    { id: W.main, name: 'Main Warehouse — Huye', location: 'Huye, Southern Province', description: 'Primary storage facility', manager: 'Claudine Mukamana', status: 'ACTIVE' },
    { id: W.cold, name: 'Cold Store — Musanze', location: 'Musanze, Northern Province', description: 'Cold storage for pre-basic seed', manager: 'Jean Bosco Nkurunziza', status: 'ACTIVE' },
  ];

  const batches = [
    {
      id: B.b4, batch_number: 'PB-2025-014', product_id: P.victoria, variety_id: C.victoria,
      seed_class_id: SC.certified, input_qty: 2000, output_qty: 1720, rejected_qty: 280,
      start_date: daysAgo(150), end_date: daysAgo(130), status: 'COMPLETED', quality_status: 'APPROVED',
      approved: true, notes: 'Season 2025 B production', created_by: U.staff1, created_at: daysAgo(150),
    },
    {
      id: B.b1, batch_number: 'PB-2026-001', product_id: P.kinigiCert, variety_id: C.kinigi,
      seed_class_id: SC.certified, input_qty: 1000, output_qty: 850, rejected_qty: 150,
      start_date: daysAgo(90), end_date: daysAgo(60), status: 'COMPLETED', quality_status: 'APPROVED',
      approved: true, notes: 'Flagship Kinigi batch', created_by: U.staff1, created_at: daysAgo(90),
    },
    {
      id: B.b2, batch_number: 'PB-2026-002', product_id: P.kinigiBasic, variety_id: C.kinigi,
      seed_class_id: SC.basic, input_qty: 800, output_qty: 0, rejected_qty: 0,
      start_date: daysAgo(30), end_date: null, status: 'IN_PROGRESS', quality_status: 'PENDING',
      approved: false, notes: 'Treatment stage ongoing', created_by: U.staff1, created_at: daysAgo(30),
    },
    {
      id: B.b3, batch_number: 'PB-2026-003', product_id: P.girinka, variety_id: C.girinka,
      seed_class_id: SC.basic, input_qty: 500, output_qty: 0, rejected_qty: 0,
      start_date: daysAgo(5), end_date: null, status: 'PLANNED', quality_status: 'PENDING',
      approved: false, notes: 'Planned for cold store', created_by: U.mgr, created_at: daysAgo(5),
    },
  ];

  const stages = [];
  batches.forEach((b, bi) => {
    DEFAULT_STAGES.forEach((name, i) => {
      const done = b.status === 'COMPLETED' || (b.status === 'IN_PROGRESS' && i < 3);
      stages.push({
        id: id(), batch_id: b.id, name, sequence: i + 1,
        status: done ? 'COMPLETED' : b.status === 'IN_PROGRESS' && i === 3 ? 'IN_PROGRESS' : 'PENDING',
        started_at: done || (b.status === 'IN_PROGRESS' && i === 3) ? daysAgo(60 - bi * 10 - i) : null,
        completed_at: done ? daysAgo(58 - bi * 10 - i) : null,
        notes: '',
      });
    });
  });

  const qualityChecks = [
    {
      id: id(), batch_id: B.b4, inspector: 'Aline Uwase', inspection_date: daysAgo(131),
      status: 'APPROVED', grade: 'A', accepted_qty: 1720, rejected_qty: 280,
      comments: 'Excellent uniformity, minor oversize tubers removed.', created_at: daysAgo(131),
    },
    {
      id: id(), batch_id: B.b1, inspector: 'Aline Uwase', inspection_date: daysAgo(61),
      status: 'APPROVED', grade: 'A', accepted_qty: 850, rejected_qty: 150,
      comments: 'Meets certified seed standards.', created_at: daysAgo(61),
    },
  ];

  const inventory = [
    { id: id(), product_id: P.kinigiCert, batch_id: B.b1, warehouse_id: W.main, quantity: 620, reserved_qty: 0, quarantined_qty: 0, damaged_qty: 0, updated_at: daysAgo(2) },
    { id: id(), product_id: P.kinigiCert, batch_id: B.b1, warehouse_id: W.cold, quantity: 150, reserved_qty: 0, quarantined_qty: 0, damaged_qty: 0, updated_at: daysAgo(2) },
    { id: id(), product_id: P.victoria, batch_id: B.b4, warehouse_id: W.main, quantity: 900, reserved_qty: 100, quarantined_qty: 0, damaged_qty: 20, updated_at: daysAgo(1) },
    { id: id(), product_id: P.kinigiBasic, batch_id: null, warehouse_id: W.main, quantity: 90, reserved_qty: 0, quarantined_qty: 0, damaged_qty: 0, updated_at: daysAgo(3) },
    { id: id(), product_id: P.girinka, batch_id: null, warehouse_id: W.cold, quantity: 40, reserved_qty: 0, quarantined_qty: 0, damaged_qty: 0, updated_at: daysAgo(6) },
  ];

  const movements = [
    { id: id(), product_id: P.victoria, batch_id: B.b4, warehouse_id: W.main, movement_type: 'PRODUCTION', quantity: 1720, reference_type: 'production_batch', reference_id: B.b4, notes: 'Batch PB-2025-014 completed', created_by: 'Jean Bosco Nkurunziza', created_at: daysAgo(130) },
    { id: id(), product_id: P.kinigiCert, batch_id: B.b1, warehouse_id: W.main, movement_type: 'PRODUCTION', quantity: 850, reference_type: 'production_batch', reference_id: B.b1, notes: 'Batch PB-2026-001 completed', created_by: 'Jean Bosco Nkurunziza', created_at: daysAgo(60) },
    { id: id(), product_id: P.kinigiCert, batch_id: B.b1, warehouse_id: W.main, movement_type: 'SALE', quantity: 200, reference_type: 'sale', reference_id: S.s1, notes: 'Invoice INV-2026-0001', created_by: 'Claudine Mukamana', created_at: daysAgo(12) },
    { id: id(), product_id: P.victoria, batch_id: B.b4, warehouse_id: W.main, movement_type: 'SALE', quantity: 500, reference_type: 'sale', reference_id: S.s2, notes: 'Invoice INV-2026-0002', created_by: 'Claudine Mukamana', created_at: daysAgo(8) },
    { id: id(), product_id: P.victoria, batch_id: B.b4, warehouse_id: W.main, movement_type: 'RESERVATION', quantity: 100, reference_type: 'order', reference_id: O.o1, notes: 'Reserved for order ORD-2026-001', created_by: 'system', created_at: daysAgo(1) },
    { id: id(), product_id: P.kinigiBasic, batch_id: null, warehouse_id: W.main, movement_type: 'ADJUSTMENT_OUT', quantity: 10, reference_type: 'manual', reference_id: null, notes: 'Spoilage found during count', created_by: 'Claudine Mukamana', created_at: daysAgo(4) },
  ];

  const customers = [
    { id: CU.coop1, name: 'Bugesera Agri Cooperative', phone: '+250 788 123 456', email: 'info@bugeseracoop.rw', address: 'Bugesera District', customer_type: 'Cooperative', status: 'ACTIVE', created_at: daysAgo(220) },
    { id: CU.coop2, name: 'Musanze Farming Cooperative', phone: '+250 788 555 100', email: 'musanzecoop@vfa.rw', address: 'Musanze District', customer_type: 'Cooperative', status: 'ACTIVE', created_at: daysAgo(180) },
    { id: CU.farmer1, name: 'Uwimana Jean', phone: '+250 788 777 220', email: 'uwimana.j@gmail.com', address: 'Karongi District', customer_type: 'Farmer', status: 'ACTIVE', created_at: daysAgo(90) },
    { id: CU.agro1, name: 'Kigali Agro-Dealer Ltd', phone: '+250 788 999 300', email: 'sales@kigaliagro.rw', address: 'Kigali, Gasabo', customer_type: 'Agro-dealer', status: 'ACTIVE', created_at: daysAgo(60) },
  ];

  const orders = [
    {
      id: O.o1, order_number: 'ORD-2026-001', customer_id: CU.coop1, status: 'CONFIRMED',
      items: [{ product_id: P.victoria, quantity: 100, unit_price: 850 }],
      notes: 'Deliver to Musanze depot', created_at: daysAgo(1),
    },
    {
      id: O.o2, order_number: 'ORD-2026-002', customer_id: CU.farmer1, status: 'PENDING',
      items: [{ product_id: P.kinigiCert, quantity: 50, unit_price: 900 }],
      notes: '', created_at: daysAgo(0),
    },
  ];

  const sales = [
    {
      id: S.s1, invoice_number: 'INV-2026-0001', customer_id: CU.coop1, order_id: null,
      items: [{ product_id: P.kinigiCert, quantity: 200, unit_price: 900, subtotal: 180000 }],
      subtotal: 180000, discount: 0, total: 180000,
      paid_amount: 180000, payment_status: 'PAID',
      notes: '', sale_date: daysAgo(12), created_by: 'Claudine Mukamana', created_at: daysAgo(12),
    },
    {
      id: S.s2, invoice_number: 'INV-2026-0002', customer_id: CU.coop2, order_id: null,
      items: [
        { product_id: P.victoria, quantity: 500, unit_price: 850, subtotal: 425000 },
        { product_id: P.kinigiBasic, quantity: 100, unit_price: 1200, subtotal: 120000 },
      ],
      subtotal: 545000, discount: 25000, total: 520000,
      paid_amount: 300000, payment_status: 'PARTIAL',
      notes: '', sale_date: daysAgo(8), created_by: 'Claudine Mukamana', created_at: daysAgo(8),
    },
    {
      id: S.s3, invoice_number: 'INV-2026-0003', customer_id: CU.agro1, order_id: null,
      items: [{ product_id: P.girinka, quantity: 60, unit_price: 1100, subtotal: 66000 }],
      subtotal: 66000, discount: 0, total: 66000,
      paid_amount: 0, payment_status: 'UNPAID',
      notes: '', sale_date: daysAgo(2), created_by: 'Aline Uwase', created_at: daysAgo(2),
    },
  ];

  const payments = [
    { id: id(), sale_id: S.s1, customer_id: CU.coop1, amount: 180000, method: 'Mobile Money', reference: 'MOMO-88123', payment_date: daysAgo(12), recorded_by: 'Claudine Mukamana', created_at: daysAgo(12) },
    { id: id(), sale_id: S.s2, customer_id: CU.coop2, amount: 300000, method: 'Bank Transfer', reference: 'BK-4471-A', payment_date: daysAgo(7), recorded_by: 'Claudine Mukamana', created_at: daysAgo(7) },
  ];

  const expenses = [
    { id: id(), category: 'Production costs', description: 'Seed treatment chemicals — March', amount: 320000, expense_date: daysAgo(40), payment_method: 'Bank Transfer', recorded_by: 'Aline Uwase', created_at: daysAgo(40) },
    { id: id(), category: 'Labor', description: 'Seasonal sorting labor (2 weeks)', amount: 210000, expense_date: daysAgo(30), payment_method: 'Cash', recorded_by: 'Aline Uwase', created_at: daysAgo(30) },
    { id: id(), category: 'Packaging', description: '5,000 mesh bags', amount: 125000, expense_date: daysAgo(18), payment_method: 'Mobile Money', recorded_by: 'Claudine Mukamana', created_at: daysAgo(18) },
    { id: id(), category: 'Transport', description: 'Delivery to Musanze coops', amount: 80000, expense_date: daysAgo(9), payment_method: 'Cash', recorded_by: 'Claudine Mukamana', created_at: daysAgo(9) },
    { id: id(), category: 'Utilities', description: 'Cold store electricity — August', amount: 96000, expense_date: daysAgo(5), payment_method: 'Bank Transfer', recorded_by: 'Aline Uwase', created_at: daysAgo(5) },
  ];

  const notifications = [
    { id: id(), type: 'warning', title: 'Low stock', message: 'Kinigi Basic Seed at 90 (min 300).', read: false, created_at: daysAgo(1) },
    { id: id(), type: 'info', title: 'New order', message: 'Order ORD-2026-002 awaiting confirmation.', read: false, created_at: daysAgo(0) },
    { id: id(), type: 'success', title: 'Payment received', message: '300,000 RWF on invoice INV-2026-0002.', read: true, created_at: daysAgo(7) },
  ];

  const auditLogs = [
    { id: id(), user: 'Aline Uwase', role: 'manager', action: 'Recorded expense: Cold store electricity — August', module: 'Expenses', created_at: daysAgo(5) },
    { id: id(), user: 'Claudine Mukamana', role: 'staff', action: 'Sale INV-2026-0003 created', module: 'Sales', created_at: daysAgo(2) },
    { id: id(), user: 'Jean Bosco Nkurunziza', role: 'staff', action: 'Started stage "Treatment"', module: 'Production Stages', created_at: daysAgo(3) },
  ];

  return {
    users,
    demoUsers: users,
    categories, seedClasses, varieties, products,
    warehouses, inventory, movements, batches, stages, qualityChecks,
    customers, orders, sales, payments,
    expenses, notifications, auditLogs,
  };
}

export const demoData = build();
