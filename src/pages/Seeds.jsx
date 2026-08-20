import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Search, Edit2, X, CheckCircle, Clock, AlertCircle, FileCheck } from 'lucide-react';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
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

const EMPTY = { batchNo:'', variety:'', class:'Pre-Basic', farmId:'', quantity:'', status:'Pending', certDate:'', price:'', inspector:'' };

export default function Seeds() {
  const { seedProduction, farms, addSeedBatch, updateSeedBatch } = useStore();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const filtered = seedProduction.filter(b => {
    const q = search.toLowerCase();
    return b.batchNo.toLowerCase().includes(q) || b.variety.toLowerCase().includes(q) || b.status.toLowerCase().includes(q);
  });

  const getFarm = (id) => farms.find(f => f.id === parseInt(id))?.name || 'N/A';

  const statusIcon = (s) => {
    if (s === 'Certified') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (s === 'Pending') return <Clock className="w-4 h-4 text-yellow-500" />;
    if (s === 'Under Review') return <FileCheck className="w-4 h-4 text-blue-500" />;
    return <AlertCircle className="w-4 h-4 text-red-500" />;
  };

  const statusColor = (s) => ({
    'Certified': 'bg-green-100 text-green-700',
    'Pending': 'bg-yellow-100 text-yellow-700',
    'Under Review': 'bg-blue-100 text-blue-700',
    'Rejected': 'bg-red-100 text-red-700',
  }[s] || 'bg-gray-100 text-gray-600');

  const openAdd = () => { setForm({ ...EMPTY, batchNo: `VFA-2025-${String(seedProduction.length + 5).padStart(3,'0')}` }); setModal('add'); };
  const openEdit = (b) => { setForm({ ...b }); setSelected(b); setModal('edit'); };
  const closeModal = () => { setModal(null); setSelected(null); };
  const handleSave = () => {
    if (modal === 'add') addSeedBatch(form);
    else updateSeedBatch(selected.id, form);
    closeModal();
  };

  const totalCertified = seedProduction.filter(b => b.status === 'Certified').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Seed Production Tracking</h1>
          <p className="text-sm text-gray-500">{totalCertified} certified batches of {seedProduction.length} total</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90"
          style={{ background:'linear-gradient(135deg,#2d9e2d,#1f7a1f)' }}>
          <Plus className="w-4 h-4" /> New Batch
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Certified', count: seedProduction.filter(b=>b.status==='Certified').length, Icon: CheckCircle, color:'text-green-600', bg:'bg-green-50 border-green-200' },
          { label:'Pending', count: seedProduction.filter(b=>b.status==='Pending').length, Icon: Clock, color:'text-yellow-600', bg:'bg-yellow-50 border-yellow-200' },
          { label:'Under Review', count: seedProduction.filter(b=>b.status==='Under Review').length, Icon: FileCheck, color:'text-blue-600', bg:'bg-blue-50 border-blue-200' },
          { label:'Rejected', count: seedProduction.filter(b=>b.status==='Rejected').length, Icon: AlertCircle, color:'text-red-600', bg:'bg-red-50 border-red-200' },
        ].map(({ label, count, Icon, color, bg }) => (
          <div key={label} className={`border rounded-xl p-4 flex items-center gap-3 ${bg}`}>
            <Icon className={`w-8 h-8 ${color}`} />
            <div>
              <div className={`text-xl font-bold ${color}`}>{count}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300" placeholder="Search batches..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Batch cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(batch => (
          <div key={batch.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm card-hover">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-mono text-sm font-bold text-green-700">{batch.batchNo}</div>
                <div className="font-display text-lg font-semibold text-gray-800 mt-0.5">{batch.variety}</div>
                <div className="text-xs text-gray-400">{batch.class} Class</div>
              </div>
              <div className="flex items-center gap-2">
                {statusIcon(batch.status)}
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColor(batch.status)}`}>{batch.status}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="text-xs text-gray-400">Farm</div>
                <div className="font-medium text-gray-700 text-xs mt-0.5 truncate">{getFarm(batch.farmId)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="text-xs text-gray-400">Quantity</div>
                <div className="font-medium text-gray-700 text-xs mt-0.5">{batch.quantity}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="text-xs text-gray-400">Price/kg</div>
                <div className="font-medium text-green-700 text-xs mt-0.5">{batch.price?.toLocaleString()} RWF</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="text-xs text-gray-400">Cert Date</div>
                <div className="font-medium text-gray-700 text-xs mt-0.5">{batch.certDate || '—'}</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 mb-3">Inspector: {batch.inspector}</div>
            <button onClick={() => openEdit(batch)} className="w-full py-2 border border-green-200 text-green-700 rounded-xl text-sm hover:bg-green-50 transition flex items-center justify-center gap-2">
              <Edit2 className="w-3.5 h-3.5" /> Edit Batch
            </button>
          </div>
        ))}
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal==='add' ? 'New Seed Batch' : 'Edit Seed Batch'} onClose={closeModal}>
          <div className="grid grid-cols-2 gap-4">
            {[['Batch No','batchNo','text'],['Variety','variety','text'],['Quantity','quantity','text'],['Price/kg (RWF)','price','number'],['Inspector','inspector','text'],['Cert Date','certDate','date']].map(([label,key,type]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type} value={form[key]||''} onChange={e => setForm(p=>({...p,[key]:e.target.value}))} className={inp} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
              <select value={form.class} onChange={e => setForm(p=>({...p,class:e.target.value}))} className={inp}>
                {['Pre-Basic','Basic','Certified','Commercial'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p=>({...p,status:e.target.value}))} className={inp}>
                {['Pending','Under Review','Certified','Rejected'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Farm</label>
              <select value={form.farmId} onChange={e => setForm(p=>({...p,farmId:e.target.value}))} className={inp}>
                <option value="">Select farm...</option>
                {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
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
