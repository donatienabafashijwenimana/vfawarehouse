import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Search, Edit2, Trash2, Eye, MapPin, X } from 'lucide-react';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-display font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const EMPTY = { name:'', owner:'', location:'', size:'', type:'Potato Seed', status:'Active', contact:'', email:'', crops:[] };

export default function Farms() {
  const { farms, addFarm, updateFarm, deleteFarm } = useStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'view'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const filtered = farms.filter(f => {
    const q = search.toLowerCase();
    return (filter === 'All' || f.status === filter) &&
      (f.name.toLowerCase().includes(q) || f.owner.toLowerCase().includes(q) || f.location.toLowerCase().includes(q));
  });

  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (f) => { setForm({ ...f }); setSelected(f); setModal('edit'); };
  const openView = (f) => { setSelected(f); setModal('view'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleSave = () => {
    if (modal === 'add') addFarm({ ...form, joined: new Date().toISOString().split('T')[0], totalHarvest: '0t' });
    else updateFarm(selected.id, form);
    closeModal();
  };

  const handleDelete = (id) => { if (confirm('Delete this farm?')) deleteFarm(id); };

  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Farm Registry</h1>
          <p className="text-sm text-gray-500">{farms.length} registered farms</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold shadow-lg hover:opacity-90 transition"
          style={{ background: 'linear-gradient(135deg,#2d9e2d,#1f7a1f)' }}>
          <Plus className="w-4 h-4" /> Register Farm
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300" placeholder="Search farms..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['All','Active','Inactive'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${filter===s ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-green-300'}`}>{s}</button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Farm Name','Owner','Location','Size','Type','Status','Harvest','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr key={f.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{f.name}</td>
                  <td className="px-4 py-3 text-gray-600">{f.owner}</td>
                  <td className="px-4 py-3 text-gray-500"><div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{f.location}</div></td>
                  <td className="px-4 py-3 text-gray-600">{f.size}</td>
                  <td className="px-4 py-3 text-gray-600">{f.type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${f.status==='Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{f.status}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-green-700">{f.totalHarvest}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openView(f)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(f)} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(f.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-10 text-gray-400">No farms found</div>}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'add' ? 'Register New Farm' : 'Edit Farm'} onClose={closeModal}>
          <div className="grid grid-cols-2 gap-4">
            {[['Farm Name','name','text'],['Owner Name','owner','text'],['Location','location','text'],['Size (ha)','size','text'],['Contact Phone','contact','tel'],['Email','email','email']].map(([label,key,type]) => (
              <div key={key} className={key==='name'||key==='owner'||key==='location' ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type} value={form[key]||''} onChange={e => setForm(p=>({...p,[key]:e.target.value}))} className={inp} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(p=>({...p,type:e.target.value}))} className={inp}>
                {['Potato Seed','Greenhouse','Hybrid Seed','Open Field'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p=>({...p,status:e.target.value}))} className={inp}>
                <option>Active</option><option>Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={closeModal} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90" style={{ background:'linear-gradient(135deg,#2d9e2d,#1f7a1f)' }}>
              {modal === 'add' ? 'Register' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* View Modal */}
      {modal === 'view' && selected && (
        <Modal title="Farm Details" onClose={closeModal}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-green-50 border border-green-100">
              <div className="font-display text-xl font-bold text-green-800">{selected.name}</div>
              <div className="text-sm text-green-600 mt-1">{selected.type} • {selected.size}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['Owner',selected.owner],['Location',selected.location],['Contact',selected.contact],['Email',selected.email],['Joined',selected.joined],['Total Harvest',selected.totalHarvest],['Status',selected.status]].map(([k,v]) => (
                <div key={k} className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400">{k}</div>
                  <div className="font-medium text-gray-700 mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-2">Crops</div>
              <div className="flex flex-wrap gap-2">
                {(selected.crops || []).map(c => (
                  <span key={c} className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">{c}</span>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
