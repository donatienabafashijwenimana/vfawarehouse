import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, StatusBadge } from '../../components/ui/primitives';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { usePermissions } from '../../hooks/usePermissions';
import { formatRWF, formatDate } from '../../lib/format';
import { customersApi, usersApi } from '../../services/dataService';

const TYPES = ['Farmer', 'Cooperative', 'Agro-dealer', 'Distributor', 'Organization', 'Individual', 'Other'];
const EMPTY = { name: '', phone: '', email: '', address: '', customer_type: 'Farmer', status: 'ACTIVE' };

export default function Customers() {
  const customers = useStore((s) => s.customers);
  const addCustomer = useStore((s) => s.addCustomer);
  const updateCustomer = useStore((s) => s.updateCustomer);
  const users = useStore((s) => s.users);
  const orders = useStore((s) => s.orders);
  const sales = useStore((s) => s.sales);
  const payments = useStore((s) => s.payments);
  const loadWorkspace = useStore((s) => s.loadWorkspace);
  const pushToast = useStore((s) => s.pushToast);
  const { can } = usePermissions();
  const customerOutstanding = useStore((s) => s.customerOutstanding);
  const run = useAction();

  const [modal, setModal] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
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

  async function confirmDeleteCustomer() {
    if (!customerToDelete || deleting) return;
    const customer = customerToDelete;
    const hasHistory = orders.some((order) => order.customer_id === customer.id)
      || sales.some((sale) => sale.customer_id === customer.id)
      || payments.some((payment) => payment.customer_id === customer.id);
    if (hasHistory) {
      pushToast('This customer has orders, sales, or payments. Deactivate the customer to preserve transaction history.', 'error');
      setCustomerToDelete(null);
      return;
    }

    setDeleting(true);
    const linkedProfile = customer.user_id ? users.find((user) => user.id === customer.user_id) : null;
    try {
      if (linkedProfile) await usersApi.update(linkedProfile.id, { status: 'INACTIVE' });
      try {
        await customersApi.remove(customer.id);
      } catch (error) {
        if (linkedProfile) await usersApi.update(linkedProfile.id, { status: linkedProfile.status }).catch(() => {});
        throw error;
      }
      await loadWorkspace();
      pushToast('Customer deleted', 'success');
      setCustomerToDelete(null);
    } catch (error) {
      pushToast(error?.message ?? 'Could not delete customer', 'error');
    } finally {
      setDeleting(false);
    }
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
              {can('customers.delete') && <Button size="sm" variant="ghost" onClick={() => setCustomerToDelete(c)}>Delete</Button>}
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
      <ConfirmDialog
        open={!!customerToDelete}
        onClose={() => !deleting && setCustomerToDelete(null)}
        title="Delete customer"
        message={`Delete ${customerToDelete?.name ?? 'this customer'}? Its linked login, if any, will be deactivated. Customers with transaction history must be deactivated instead.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete customer'}
        onConfirm={confirmDeleteCustomer}
      />
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
