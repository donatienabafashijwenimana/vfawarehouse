import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Search, Edit2, Trash2, X, AlertTriangle, Package } from 'lucide-react';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
const EMPTY = { item:'', category:'Seeds', qty:'', unit:'kg', minQty:'', price:'', location:'', lastUpdated:'' };
const CATS = ['Seeds','Inputs','Pesticides','Equipment','Tools','Other'];

export default function Inventory() {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useStore();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const filtered = inventory.filter(i => {
    const q = search.toLowerCase();
    return (catFilter === 'All' || i.category === catFilter) &&
      (i.item.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  });

  const lowStock = inventory.filter(i => i.qty <= i.minQty);

  const openAdd = () => { setForm({ ...EMPTY, lastUpdated: new Date().toISOString().split('T')[0] }); setModal('add'); };
  const openEdit = (it) => { setForm({ ...it }); setSelected(it); setModal('edit'); };
  const closeModal = () => { setModal(null); setSelected(null); };
  const handleSave = () => {
    if (modal === 'add') addInventoryItem(form);
    else updateInventoryItem(selected.id, form);
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Inventory Management</h1>
          <p className="text-sm text-gray-500">{inventory.length} items — {lowStock.length} low stock</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90"
          style={{ background:'linear-gradient(135deg,#2d9e2d,#1f7a1f)' }}>
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="font-semibold text-orange-700 text-sm">Low Stock Alert</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(i => (
              <span key={i.id} className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">{i.item}: {i.qty} {i.unit}</span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300" placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['All', ...CATS].map(c => (
          <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${catFilter===c ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-green-300'}`}>{c}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Item','Category','Qty','Min Qty','Unit Price (RWF)','Location','Last Updated','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const isLow = item.qty <= item.minQty;
                return (
                  <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50 ${isLow ? 'bg-orange-50/30' : i%2===0?'':'bg-gray-50/30'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-800">{item.item}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{item.category}</span></td>
                    <td className="px-4 py-3 font-bold text-gray-800">{item.qty}</td>
                    <td className="px-4 py-3 text-gray-500">{item.minQty}</td>
                    <td className="px-4 py-3 text-green-700 font-semibold">{parseInt(item.price).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.location}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{item.lastUpdated}</td>
                    <td className="px-4 py-3">
                      {isLow ? (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">Low</span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => { if(confirm('Delete item?')) deleteInventoryItem(item.id); }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-10 text-gray-400">No items found</div>}
        </div>
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal==='add' ? 'Add Inventory Item' : 'Edit Item'} onClose={closeModal}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Item Name</label>
              <input value={form.item} onChange={e => setForm(p=>({...p,item:e.target.value}))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))} className={inp}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
              <select value={form.unit} onChange={e => setForm(p=>({...p,unit:e.target.value}))} className={inp}>
                {['kg','L','m','bags','pcs','boxes'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            {[['Quantity','qty','number'],['Min Quantity','minQty','number'],['Price/unit (RWF)','price','number'],['Location','location','text']].map(([label,key,type]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type} value={form[key]||''} onChange={e => setForm(p=>({...p,[key]:e.target.value}))} className={inp} />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={closeModal} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
            <button onClick={handleSave} className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold" style={{ background:'linear-gradient(135deg,#2d9e2d,#1f7a1f)' }}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
