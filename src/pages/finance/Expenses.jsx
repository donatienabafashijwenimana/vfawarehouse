import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, StatusBadge } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader, KPICard } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { formatDate, formatRWF } from '../../lib/format';

const EMPTY = { category: '', description: '', amount: '', expense_date: '', payment_method: 'Cash' };

export default function Expenses() {
  const expenses = useStore((s) => s.expenses);
  const expenseCategories = [...new Set(expenses.map((expense) => expense.category).filter(Boolean))].sort();
  const addExpense = useStore((s) => s.addExpense);
  const updateExpense = useStore((s) => s.updateExpense);
  const deleteExpense = useStore((s) => s.deleteExpense);
  const run = useAction();

  const [modal, setModal] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  const rows = categoryFilter ? expenses.filter((e) => e.category === categoryFilter) : expenses;
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMonth = expenses
    .filter((e) => (e.expense_date ?? '').slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((s, e) => s + e.amount, 0);

  function save(form) {
    const data = { ...form, amount: Number(form.amount) };
    if (modal.mode === 'create') run(() => addExpense(data), 'Expense recorded');
    else run(() => updateExpense(modal.expense.id, data), 'Expense updated');
    setModal(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Management"
        subtitle="Track production, packaging, transport, labor, and other operating costs"
        actions={<Button onClick={() => setModal({ mode: 'create' })}><Plus className="h-4 w-4" /> Add Expense</Button>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KPICard icon={Plus} label="Total Expenses" value={formatRWF(total)} sub={`${expenses.length} records`} tone="amber" />
        <KPICard icon={Plus} label="This Month" value={formatRWF(thisMonth)} tone="red" />
      </div>

      <DataTable
        columns={[
          { key: 'expense_date', label: 'Date', render: (e) => <span className="text-gray-500">{formatDate(e.expense_date)}</span> },
          { key: 'category', label: 'Category', render: (e) => <span className="font-medium text-gray-700">{e.category}</span> },
          { key: 'description', label: 'Description', render: (e) => <span className="text-gray-600">{e.description}</span> },
          { key: 'amount', label: 'Amount', render: (e) => <span className="font-semibold text-red-500">{formatRWF(e.amount)}</span> },
          { key: 'payment_method', label: 'Method', render: (e) => <StatusBadge status={e.payment_method === 'Cash' ? 'COMPLETED' : 'CONFIRMED'} /> },
          { key: 'recorded_by', label: 'Recorded by', render: (e) => <span className="text-gray-500">{e.recorded_by}</span> },
          { key: 'actions', label: '', sortable: false, render: (e) => (
            <div className="flex justify-end gap-1.5" onClick={(e2) => e2.stopPropagation()}>
              <Button size="sm" variant="secondary" onClick={() => setModal({ mode: 'edit', expense: e })}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => run(() => deleteExpense(e.id), 'Expense deleted')}>Delete</Button>
            </div>
          )},
        ]}
        rows={rows}
        searchKeys={['description', 'category']}
        searchPlaceholder="Search expenses…"
        filters={
          <FilterSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="All categories"
            options={expenseCategories.map((category) => ({ value: category, label: category }))}
          />
        }
        pageSize={8}
      />

      <ExpenseModal modal={modal} onClose={() => setModal(null)} onSave={save} />
    </div>
  );
}

function ExpenseModal({ modal, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    modal?.mode === 'edit'
      ? { ...modal.expense }
      : { ...EMPTY, expense_date: new Date().toISOString().slice(0, 10) }
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={!!modal} onClose={onClose} title={modal?.mode === 'edit' ? 'Edit Expense' : 'Add Expense'}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Category" value={form.category} onChange={set('category')} placeholder="Enter an expense category" required />
          <Input label="Date" type="date" value={form.expense_date} onChange={set('expense_date')} required />
        </div>
        <Input label="Description" value={form.description} onChange={set('description')} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount (RWF)" type="number" min="1" value={form.amount} onChange={set('amount')} required />
          <Select label="Payment method" value={form.payment_method} onChange={set('payment_method')}>
            {['Cash', 'Bank Transfer', 'Mobile Money', 'Other'].map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{modal?.mode === 'edit' ? 'Save Changes' : 'Add Expense'}</Button>
        </div>
      </form>
    </Modal>
  );
}
