import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Search, Edit2, Trash2, X, CheckCircle, Clock, Sprout } from 'lucide-react';

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

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300';

const CROP_EMPTY = { farmId:'', name:'', variety:'', season:'Season A 2025', plantDate:'', harvestDate:'', area:'', status:'Germinating', expectedYield:'', actualYield:'', notes:'' };

export default function Crops() {
  const { crops, farms, addCrop, updateCrop, deleteCrop } = useStore();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(CROP_EMPTY);

  const filtered = crops.filter(c => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.variety.toLowerCase().includes(q) || c.season.toLowerCase().includes(q);
  });

  const getFarmName = (id) => farms.find(f => f.id === parseInt(id))?.name || 'N/A';

  const statusColor = (s) => {
    if (s === 'Growing') return 'bg-green-100 text-green-700';
    if (s === 'Germinating') return 'bg-blue-100 text-blue-700';
    if (s === 'Harvested') return 'bg-gray-100 text-gray-600';
    if (s === 'Diseased') return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const openAdd = () => { setForm(CROP_EMPTY); setModal('add'); };
  const openEdit = (c) => { setForm({ ...c }); setSelected(c); setModal('edit'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleSave = () => {
    if (modal === 'add') addCrop(form);
    else updateCrop(selected.id, form);
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Crop Records</h1>
          <p className="text-sm text-gray-500">{crops.length} crop entries across all farms</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold shadow-lg hover:opacity-90"
          style={{ background:'linear-gradient(135deg,#2d9e2d,#1f7a1f)' }}>
          <Plus className="w-4 h-4" /> Add Crop Record
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Growing', count: crops.filter(c=>c.status==='Growing').length, color:'text-green-600', bg:'bg-green-50 border-green-100' },
          { label:'Germinating', count: crops.filter(c=>c.status==='Germinating').length, color:'text-blue-600', bg:'bg-blue-50 border-blue-100' },
          { label:'Harvested', count: crops.filter(c=>c.status==='Harvested').length, color:'text-gray-600', bg:'bg-gray-50 border-gray-100' },
          { label:'Diseased', count: crops.filter(c=>c.status==='Diseased').length, color:'text-red-600', bg:'bg-red-50 border-red-100' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <div className={`text-2xl font-bold ${color}`}>{count}</div>
            <div className="text-sm text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full max-w-sm pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300" placeholder="Search crops..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Crop / Variety','Farm','Season','Plant Date','Harvest Date','Area','Expected','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2===0?'':'bg-gray-50/30'}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-400">{c.variety}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{getFarmName(c.farmId)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{c.season}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.plantDate}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.harvestDate}</td>
                  <td className="px-4 py-3 text-gray-600">{c.area}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">{c.expectedYield}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor(c.status)}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => { if(confirm('Delete?')) deleteCrop(c.id); }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-10 text-gray-400">No crop records found</div>}
        </div>
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal==='add' ? 'Add Crop Record' : 'Edit Crop Record'} onClose={closeModal}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Farm</label>
              <select value={form.farmId} onChange={e => setForm(p=>({...p,farmId:e.target.value}))} className={inp}>
                <option value="">Select farm...</option>
                {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            {[['Crop Name','name','text'],['Variety','variety','text'],['Season','season','text'],['Area (ha)','area','text'],['Expected Yield','expectedYield','text'],['Actual Yield','actualYield','text']].map(([label,key,type]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type} value={form[key]||''} onChange={e => setForm(p=>({...p,[key]:e.target.value}))} className={inp} />
              </div>
            ))}
            {[['Plant Date','plantDate'],['Harvest Date','harvestDate']].map(([label,key]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type="date" value={form[key]||''} onChange={e => setForm(p=>({...p,[key]:e.target.value}))} className={inp} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p=>({...p,status:e.target.value}))} className={inp}>
                {['Germinating','Growing','Flowering','Harvested','Diseased'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes||''} onChange={e => setForm(p=>({...p,notes:e.target.value}))} rows={2} className={inp} />
            </div>
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
