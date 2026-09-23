import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Button, Input, Textarea, Select, StatusBadge } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/KPICard';
import { useAction } from '../../hooks/useAction';
import { formatNumber } from '../../lib/format';

const EMPTY = { name: '', location: '', description: '', manager: '', status: 'ACTIVE' };

export default function Warehouses() {
  const warehouses = useStore((s) => s.warehouses);
  const inventory = useStore((s) => s.inventory);
  const addWarehouse = useStore((s) => s.addWarehouse);
  const updateWarehouse = useStore((s) => s.updateWarehouse);
  const run = useAction();
  const [modal, setModal] = useState(null);

  const stockOf = (wid) =>
    inventory.filter((i) => i.warehouse_id === wid).reduce((s, i) => s + i.quantity, 0);

  function save(form) {
    if (modal.mode === 'create') run(() => addWarehouse(form), 'Warehouse created');
    else run(() => updateWarehouse(modal.warehouse.id, form), 'Warehouse updated');
    setModal(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        subtitle="Storage locations for finished seed"
        actions={<Button onClick={() => setModal({ mode: 'create' })}><Plus className="h-4 w-4" /> Add Warehouse</Button>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {warehouses.map((w) => (
          <div key={w.id} className="card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-800">{w.name}</h3>
                <p className="mt-0.5 text-xs text-gray-400">{w.location}</p>
              </div>
              <StatusBadge status={w.status} />
            </div>
            <p className="mt-3 text-sm text-gray-500">{w.description}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-green-50 px-3 py-2.5">
                <div className="text-xs text-green-600">Total stock</div>
                <div className="text-lg font-bold text-green-800">{formatNumber(stockOf(w.id))} kg</div>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                <div className="text-xs text-gray-400">Manager</div>
                <div className="truncate text-sm font-semibold text-gray-700">{w.manager || '—'}</div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setModal({ mode: 'edit', warehouse: w })}>Edit</Button>
            </div>
          </div>
        ))}
      </div>

      <WarehouseModal modal={modal} onClose={() => setModal(null)} onSave={save} />
    </div>
  );
}

function WarehouseModal({ modal, onClose, onSave }) {
  const [form, setForm] = useState(() => (modal?.mode === 'edit' ? { ...modal.warehouse } : { ...EMPTY }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={!!modal} onClose={onClose} title={modal?.mode === 'edit' ? 'Edit Warehouse' : 'Add Warehouse'}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
        <Input label="Warehouse name" value={form.name} onChange={set('name')} required />
        <Input label="Location" value={form.location} onChange={set('location')} required />
        <Textarea label="Description" value={form.description} onChange={set('description')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Manager" value={form.manager} onChange={set('manager')} />
          <Select label="Status" value={form.status} onChange={set('status')}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{modal?.mode === 'edit' ? 'Save Changes' : 'Add Warehouse'}</Button>
        </div>
      </form>
    </Modal>
  );
}
