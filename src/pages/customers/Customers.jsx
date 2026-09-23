import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, StatusBadge } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { formatRWF, formatDate } from '../../lib/format';

const TYPES = ['Farmer', 'Cooperative', 'Agro-dealer', 'Distributor', 'Organization', 'Individual', 'Other'];
const EMPTY = { name: '', phone: '', email: '', address: '', customer_type: 'Farmer', status: 'ACTIVE' };

export default function Customers() {
  const customers = useStore((s) => s.customers);
  const addCustomer = useStore((s) => s.addCustomer);
  const updateCustomer = useStore((s) => s.updateCustomer);
  const deleteCustomer = useStore((s) => s.deleteCustomer);
  const customerOutstanding = useStore((s) => s.customerOutstanding);
  const run = useAction();

  const [modal, setModal] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');

  const outstandingFor = (id) => customerOutstanding(id);

  const rows = typeFilter ? customers.filter((c) => c.customer_type === typeFilter) : customers;

  function save(form) {
    if (modal.mode === 'create') {
      run(() => addCustomer(form), 'Customer created');
    } else {
      run(() => updateCustomer(modal.customer.id, form), 'Customer updated');
    }
    setModal(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Farmers, cooperatives, agro-dealers and organizations buying VFA seed"
        actions={<Button onClick={() => setModal({ mode: 'create' })}><Plus className="h-4 w-4" /> Add Customer</Button>}
      />

      <DataTable
        columns={[
          { key: 'name', label: 'Customer', render: (c) => (
            <div>
              <div className="font-semibold text-gray-700">{c.name}</div>
              <div className="text-xs text-gray-400">{c.email}</div>
            </div>
          )},
          { key: 'phone', label: 'Phone', render: (c) => <span className="text-gray-600">{c.phone}</span> },
          { key: 'customer_type', label: 'Type' },
          { key: 'address', label: 'Address', render: (c) => <span className="text-gray-500">{c.address}</span> },
          { key: 'status', label: 'Status', render: (c) => <StatusBadge status={c.status} /> },
          { key: 'outstanding', label: 'Outstanding', sortable: true, render: (c) => {
            const val = outstandingFor(c.id);
            return <span className={`font-semibold ${val > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatRWF(val)}</span>;
          }},
          { key: 'created_at', label: 'Since', render: (c) => <span className="text-gray-400">{formatDate(c.created_at)}</span> },
          { key: 'actions', label: '', sortable: false, render: (c) => (
            <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="secondary" onClick={() => setModal({ mode: 'edit', customer: c })}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => run(() => deleteCustomer(c.id), 'Customer deleted')}>
                Delete
              </Button>
            </div>
          )},
        ]}
        rows={rows}
        searchKeys={['name', 'email', 'phone']}
        searchPlaceholder="Search customers…"
        filters={
          <FilterSelect
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="All types"
            options={TYPES.map((t) => ({ value: t, label: t }))}
          />
        }
        pageSize={8}
      />

      <CustomerModal modal={modal} onClose={() => setModal(null)} onSave={save} />
    </div>
  );
}

function CustomerModal({ modal, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    modal?.mode === 'edit' ? { ...modal.customer } : { ...EMPTY }
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={!!modal} onClose={onClose} title={modal?.mode === 'edit' ? 'Edit Customer' : 'Add Customer'}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
        <Input label="Full name / Organization" value={form.name} onChange={set('name')} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone" value={form.phone} onChange={set('phone')} required />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} />
        </div>
        <Input label="Address / District" value={form.address} onChange={set('address')} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Customer type" value={form.customer_type} onChange={set('customer_type')}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select label="Status" value={form.status} onChange={set('status')}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{modal?.mode === 'edit' ? 'Save Changes' : 'Add Customer'}</Button>
        </div>
      </form>
    </Modal>
  );
}
