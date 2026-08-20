import { create } from 'zustand';

const today = new Date();
const fmt = (d) => d.toISOString().split('T')[0];
const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };

export const useStore = create((set, get) => ({
  
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),

  farms: [
    { id: 1, name: 'Karongi Seed Farm', owner: 'Uwimana Jean', location: 'Karongi, Western', size: '2.5 ha', type: 'Potato Seed', status: 'Active', joined: '2024-01-15', contact: '0788123456', email: 'uwimana@gmail.com', crops: ['CIP-Kinigi', 'Victoria'], totalHarvest: '12.4t', lat: -2.07, lng: 29.39 },
    { id: 2, name: 'Musanze Highland Seeds', owner: 'Mukamana Alice', location: 'Musanze, Northern', size: '3.8 ha', type: 'Greenhouse', status: 'Active', joined: '2024-02-20', contact: '0722456789', email: 'mukamana@vfa.rw', crops: ['CIP-Victoria', 'Gihota'], totalHarvest: '18.2t', lat: -1.50, lng: 29.63 },
    { id: 3, name: 'Nyamagabe Green Farm', owner: 'Habimana Etienne', location: 'Nyamagabe, Southern', size: '1.9 ha', type: 'Hybrid Seed', status: 'Inactive', joined: '2023-11-10', contact: '0733789012', email: 'habimana@agri.rw', crops: ['Gihota', 'CIP-Kinigi'], totalHarvest: '8.7t', lat: -2.48, lng: 29.47 },
    { id: 4, name: 'Rubavu Lakeside Seeds', owner: 'Nirere Peace', location: 'Rubavu, Western', size: '4.2 ha', type: 'Potato Seed', status: 'Active', joined: '2024-03-01', contact: '0755012345', email: 'nirere@seeds.rw', crops: ['Victoria', 'CIP-Kinigi'], totalHarvest: '21.0t', lat: -1.69, lng: 29.36 },
  ],
  addFarm: (farm) => set(s => ({ farms: [...s.farms, { ...farm, id: Date.now() }] })),
  updateFarm: (id, data) => set(s => ({ farms: s.farms.map(f => f.id === id ? { ...f, ...data } : f) })),
  deleteFarm: (id) => set(s => ({ farms: s.farms.filter(f => f.id !== id) })),
               
  crops: [
    { id: 1, farmId: 1, name: 'CIP-Kinigi', variety: 'Kinigi', season: 'Season A 2025', plantDate: '2025-02-10', harvestDate: '2025-06-15', area: '1.2 ha', status: 'Growing', expectedYield: '6.0t', actualYield: null, notes: 'Healthy growth, minor aphid control applied' },
    { id: 2, farmId: 1, name: 'Victoria', variety: 'Victoria', season: 'Season A 2025', plantDate: '2025-02-12', harvestDate: '2025-06-20', area: '1.3 ha', status: 'Growing', expectedYield: '7.8t', actualYield: null, notes: 'Good soil moisture levels' },
    { id: 3, farmId: 2, name: 'CIP-Victoria', variety: 'Victoria', season: 'Season B 2024', plantDate: '2024-08-05', harvestDate: '2024-12-10', area: '2.0 ha', status: 'Harvested', expectedYield: '10.0t', actualYield: '9.8t', notes: 'Slightly below target due to late rains' },
    { id: 4, farmId: 4, name: 'CIP-Kinigi', variety: 'Kinigi', season: 'Season A 2025', plantDate: '2025-03-01', harvestDate: '2025-07-05', area: '2.5 ha', status: 'Germinating', expectedYield: '15.0t', actualYield: null, notes: 'Optimal planting conditions' },
    { id: 5, farmId: 3, name: 'Gihota', variety: 'Gihota', season: 'Season B 2024', plantDate: '2024-09-10', harvestDate: '2025-01-15', area: '1.9 ha', status: 'Harvested', expectedYield: '8.5t', actualYield: '8.7t', notes: 'Exceeded target' },
  ],
  addCrop: (crop) => set(s => ({ crops: [...s.crops, { ...crop, id: Date.now() }] })),
  updateCrop: (id, data) => set(s => ({ crops: s.crops.map(c => c.id === id ? { ...c, ...data } : c) })),
  deleteCrop: (id) => set(s => ({ crops: s.crops.filter(c => c.id !== id) })),
            
  seedProduction: [
    { id: 1, batchNo: 'VFA-2025-001', variety: 'CIP-Kinigi', class: 'Pre-Basic', farmId: 1, quantity: '500 kg', status: 'Certified', certDate: '2025-05-01', price: 2500, inspector: 'RAB Inspector - Nkusi' },
    { id: 2, batchNo: 'VFA-2025-002', variety: 'Victoria', class: 'Basic', farmId: 4, quantity: '1200 kg', status: 'Pending', certDate: null, price: 1800, inspector: 'RAB Inspector - Gakwandi' },
    { id: 3, batchNo: 'VFA-2024-018', variety: 'Gihota', class: 'Certified', farmId: 3, quantity: '3500 kg', status: 'Certified', certDate: '2024-12-20', price: 1200, inspector: 'RAB Inspector - Nkusi' },
    { id: 4, batchNo: 'VFA-2025-003', variety: 'CIP-Victoria', class: 'Pre-Basic', farmId: 2, quantity: '800 kg', status: 'Under Review', certDate: null, price: 2500, inspector: 'RAB Inspector - Uwera' },
  ],                
  addSeedBatch: (batch) => set(s => ({ seedProduction: [...s.seedProduction, { ...batch, id: Date.now() }] })),
  updateSeedBatch: (id, data) => set(s => ({ seedProduction: s.seedProduction.map(b => b.id === id ? { ...b, ...data } : b) })),
                  
  greenhouse: [
    { id: 1, name: 'GH-01 Musanze', farmId: 2, temp: 22.4, humidity: 68, co2: 412, soilMoisture: 74, light: 8200, status: 'Optimal', lastUpdate: new Date().toISOString() },
    { id: 2, name: 'GH-02 Musanze', farmId: 2, temp: 24.1, humidity: 72, co2: 435, soilMoisture: 61, light: 7950, status: 'Warning', lastUpdate: new Date().toISOString() },
    { id: 3, name: 'GH-03 Karongi', farmId: 1, temp: 20.8, humidity: 65, co2: 398, soilMoisture: 78, light: 8100, status: 'Optimal', lastUpdate: new Date().toISOString() },
  ],
           
  inventory: [
    { id: 1, item: 'CIP-Kinigi Seeds (Pre-Basic)', category: 'Seeds', qty: 450, unit: 'kg', minQty: 100, price: 2500, location: 'Store A', lastUpdated: fmt(today) },
    { id: 2, item: 'Victoria Seeds (Basic)', category: 'Seeds', qty: 820, unit: 'kg', minQty: 200, price: 1800, location: 'Store A', lastUpdated: fmt(today) },
    { id: 3, item: 'NPK Fertilizer 17-17-17', category: 'Inputs', qty: 2400, unit: 'kg', minQty: 500, price: 850, location: 'Store B', lastUpdated: addDays(-2) },
    { id: 4, item: 'Dithane Fungicide', category: 'Pesticides', qty: 85, unit: 'L', minQty: 20, price: 12000, location: 'Store B', lastUpdated: addDays(-1) },
    { id: 5, item: 'Irrigation Pipes (1")', category: 'Equipment', qty: 340, unit: 'm', minQty: 100, price: 1200, location: 'Yard', lastUpdated: addDays(-5) },
    { id: 6, item: 'Peat Moss Substrate', category: 'Inputs', qty: 12, unit: 'bags', minQty: 5, price: 25000, location: 'GH Store', lastUpdated: addDays(-3) },
  ],
  addInventoryItem: (item) => set(s => ({ inventory: [...s.inventory, { ...item, id: Date.now() }] })),
  updateInventoryItem: (id, data) => set(s => ({ inventory: s.inventory.map(i => i.id === id ? { ...i, ...data } : i) })),
  deleteInventoryItem: (id) => set(s => ({ inventory: s.inventory.filter(i => i.id !== id) })),
              
  sales: [
    { id: 1, invoiceNo: 'INV-2025-041', customer: 'Bugesera Agri Coop', date: addDays(-3), items: [{ name: 'CIP-Kinigi Seeds', qty: 200, unit: 'kg', price: 2500 }], total: 500000, status: 'Paid', payMethod: 'Mobile Money' },
    { id: 2, invoiceNo: 'INV-2025-042', customer: 'MINIAGRI Project Gicumbi', date: addDays(-7), items: [{ name: 'Victoria Seeds', qty: 500, unit: 'kg', price: 1800 }, { name: 'NPK Fertilizer', qty: 200, unit: 'kg', price: 850 }], total: 1070000, status: 'Paid', payMethod: 'Bank Transfer' },
    { id: 3, invoiceNo: 'INV-2025-043', customer: 'Musanze Cooperative', date: addDays(-1), items: [{ name: 'CIP-Kinigi Seeds', qty: 100, unit: 'kg', price: 2500 }], total: 250000, status: 'Pending', payMethod: 'Cash' },
    { id: 4, invoiceNo: 'INV-2025-044', customer: 'Rwanda Agricultural Board', date: fmt(today), items: [{ name: 'Pre-Basic Seeds Batch', qty: 300, unit: 'kg', price: 2500 }], total: 750000, status: 'Draft', payMethod: 'Bank Transfer' },
    { id: 5, invoiceNo: 'INV-2025-039', customer: 'FAO Rwanda Program', date: addDays(-14), items: [{ name: 'Victoria Seeds', qty: 1000, unit: 'kg', price: 1800 }], total: 1800000, status: 'Paid', payMethod: 'Bank Transfer' },
  ],
  addSale: (sale) => set(s => ({ sales: [...s.sales, { ...sale, id: Date.now() }] })),
  updateSale: (id, data) => set(s => ({ sales: s.sales.map(sa => sa.id === id ? { ...sa, ...data } : sa) })),
  
  alerts: [
    { id: 1, type: 'warning', title: 'Low Stock Alert', message: 'Peat Moss Substrate below minimum threshold (12 bags remaining)', time: addDays(-1), read: false },
    { id: 2, type: 'info', title: 'Certification Due', message: 'Batch VFA-2025-002 Victoria Seeds inspection scheduled in 3 days', time: fmt(today), read: false },
    { id: 3, type: 'success', title: 'Payment Received', message: 'INV-2025-042 payment confirmed: RWF 1,070,000 from MINIAGRI', time: addDays(-7), read: true },
    { id: 4, type: 'danger', title: 'Greenhouse Warning', message: 'GH-02 Musanze humidity above optimal range (72% > 70%)', time: fmt(today), read: false },
  ],
  markAlertRead: (id) => set(s => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, read: true } : a) })),
  addAlert: (alert) => set(s => ({ alerts: [{ ...alert, id: Date.now(), read: false }, ...s.alerts] })),
}));
