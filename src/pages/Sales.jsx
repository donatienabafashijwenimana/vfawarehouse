import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Search, Edit2, Eye, X, Download } from 'lucide-react';
import logo from '../assets/logo.JPG';

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${wide ? 'w-full max-w-2xl' : 'w-full max-w-lg'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-display font-bold text-gray-800">{title}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300';

export default function Sales() {
  const { sales, addSale, updateSale } = useStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ invoiceNo:'', customer:'', date:'', items:[{ name:'', qty:'', unit:'kg', price:'' }], status:'Draft', payMethod:'Mobile Money' });

  const filtered = sales.filter(s => {
    const q = search.toLowerCase();
    return (filter === 'All' || s.status === filter) &&
      (s.invoiceNo.toLowerCase().includes(q) || s.customer.toLowerCase().includes(q));
  });

  const totalRevenue = sales.filter(s=>s.status==='Paid').reduce((a,b)=>a+b.total,0);
  const pending = sales.filter(s=>s.status==='Pending').reduce((a,b)=>a+b.total,0);

  const statusColor = (s) => ({
    'Paid':'bg-green-100 text-green-700',
    'Pending':'bg-yellow-100 text-yellow-700',
    'Draft':'bg-gray-100 text-gray-600',
    'Cancelled':'bg-red-100 text-red-700',
  }[s] || 'bg-gray-100 text-gray-600');

  const openAdd = () => {
    const nextNo = `INV-2025-${String(sales.length + 45).padStart(3,'0')}`;
    setForm({ invoiceNo:nextNo, customer:'', date:new Date().toISOString().split('T')[0], items:[{name:'',qty:'',unit:'kg',price:''}], status:'Draft', payMethod:'Mobile Money' });
    setModal('add');
  };
  const openView = (s) => { setSelected(s); setModal('view'); };
  const openEdit = (s) => { setForm({...s}); setSelected(s); setModal('edit'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const calcTotal = (items) => items.reduce((a, it) => a + (parseFloat(it.qty||0) * parseFloat(it.price||0)), 0);

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { name:'', qty:'', unit:'kg', price:'' }] }));
  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_,idx) => idx !== i) }));
  const updateItem = (i, key, val) => setForm(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? {...it, [key]:val} : it) }));

  const handleSave = () => {
    const total = calcTotal(form.items);
    if (modal === 'add') addSale({ ...form, total });
    else updateSale(selected.id, { ...form, total });
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Sales & Invoicing</h1>
          <p className="text-sm text-gray-500">{sales.length} total invoices</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90"
          style={{ background:'linear-gradient(135deg,#2d9e2d,#1f7a1f)' }}>
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Revenue cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-600 rounded-2xl p-4 text-white">
          <div className="text-sm opacity-80">Total Revenue</div>
          <div className="text-2xl font-bold mt-1">{(totalRevenue/1000000).toFixed(2)}M</div>
          <div className="text-xs opacity-70 mt-1">RWF — Paid invoices</div>
        </div>
        <div className="bg-yellow-500 rounded-2xl p-4 text-white">
          <div className="text-sm opacity-80">Pending</div>
          <div className="text-2xl font-bold mt-1">{(pending/1000000).toFixed(2)}M</div>
          <div className="text-xs opacity-70 mt-1">RWF — Awaiting payment</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-sm text-gray-500">Paid Invoices</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{sales.filter(s=>s.status==='Paid').length}</div>
          <div className="text-xs text-gray-400 mt-1">of {sales.length} total</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-sm text-gray-500">This Month</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{sales.filter(s=>s.status!=='Cancelled').length}</div>
          <div className="text-xs text-gray-400 mt-1">Active transactions</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['All','Draft','Pending','Paid','Cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${filter===s ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-green-300'}`}>{s}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Invoice No','Customer','Date','Items','Total (RWF)','Payment','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2===0?'':'bg-gray-50/30'}`}>
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-green-700">{s.invoiceNo}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{s.customer}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.date}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.items?.length} item(s)</td>
                  <td className="px-4 py-3 font-bold text-gray-800">{s.total?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.payMethod}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColor(s.status)}`}>{s.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openView(s)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(s)} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Invoice */}
      {modal === 'view' && selected && (
        <Modal title={`Invoice ${selected.invoiceNo}`} onClose={closeModal} wide>
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center overflow-hidden border border-green-100">
                  <img src={logo} alt="VFA logo" className="w-10 h-10 object-contain" />
                </div>
                <div>
                  <div className="font-display text-xl font-bold text-gray-800">VFA Greenhouse Seeds Hub Ltd</div>
                  <div className="text-sm text-gray-500">Kigali, Rwanda | vfa.rw | +250 XXX XXX XXX</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-bold text-green-700">{selected.invoiceNo}</div>
                <div className="text-sm text-gray-500">Date: {selected.date}</div>
              </div>
            </div>
            <div className="border-t border-b border-gray-100 py-3">
              <div className="text-xs text-gray-400">Billed to</div>
              <div className="font-semibold text-gray-800 mt-1">{selected.customer}</div>
              <div className="text-sm text-gray-500">Payment: {selected.payMethod}</div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs text-gray-500 uppercase">Item</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 uppercase">Qty</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 uppercase">Unit</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 uppercase">Price</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                {selected.items?.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-right">{item.qty}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{item.unit}</td>
                    <td className="px-3 py-2 text-right">{parseInt(item.price).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold">{(parseInt(item.qty) * parseInt(item.price)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right">
              <div className="text-lg font-bold text-green-700">Total: {selected.total?.toLocaleString()} RWF</div>
            </div>
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                selected.status==='Paid'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'
              }`}>{selected.status}</span>
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm hover:bg-green-700">
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add/Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal==='add'?'New Invoice':'Edit Invoice'} onClose={closeModal} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Invoice No</label>
                <input value={form.invoiceNo} onChange={e=>setForm(p=>({...p,invoiceNo:e.target.value}))} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className={inp} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer</label>
                <input value={form.customer} onChange={e=>setForm(p=>({...p,customer:e.target.value}))} className={inp} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Line Items</label>
                <button onClick={addItem} className="text-xs text-green-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Add item</button>
              </div>
              <div className="space-y-2">
                {form.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input placeholder="Item name" value={it.name} onChange={e=>updateItem(i,'name',e.target.value)} className={`col-span-4 ${inp}`} />
                    <input placeholder="Qty" type="number" value={it.qty} onChange={e=>updateItem(i,'qty',e.target.value)} className={`col-span-2 ${inp}`} />
                    <select value={it.unit} onChange={e=>updateItem(i,'unit',e.target.value)} className={`col-span-2 ${inp}`}>
                      {['kg','L','m','bags','pcs'].map(u=><option key={u}>{u}</option>)}
                    </select>
                    <input placeholder="Price" type="number" value={it.price} onChange={e=>updateItem(i,'price',e.target.value)} className={`col-span-3 ${inp}`} />
                    <button onClick={() => removeItem(i)} className="col-span-1 text-red-400 hover:text-red-600 text-center"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="text-right mt-2 text-sm font-bold text-green-700">Total: {calcTotal(form.items).toLocaleString()} RWF</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} className={inp}>
                  {['Draft','Pending','Paid','Cancelled'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                <select value={form.payMethod} onChange={e=>setForm(p=>({...p,payMethod:e.target.value}))} className={inp}>
                  {['Mobile Money','Bank Transfer','Cash','Cheque'].map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={closeModal} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
            <button onClick={handleSave} className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold" style={{ background:'linear-gradient(135deg,#2d9e2d,#1f7a1f)' }}>Save Invoice</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
