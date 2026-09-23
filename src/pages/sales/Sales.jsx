import { useState } from 'react';
import { Plus, FileText, CreditCard, Wallet, Clock3 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Select, Input, StatusBadge } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader, KPICard } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { formatDate, formatRWF, prettyLabel } from '../../lib/format';

export default function Sales() {
  const store = useStore();
  const isCustomer = store.profile?.role === 'customer';
  const myCustomerId = store.profile?.customer_id;

  const [createOpen, setCreateOpen] = useState(false);
  const [payStatusFilter, setPayStatusFilter] = useState('');
  const [detail, setDetail] = useState(null);

  const allSales = isCustomer ? store.sales.filter((s) => s.customer_id === myCustomerId) : store.sales;
  const rows = payStatusFilter ? allSales.filter((s) => s.payment_status === payStatusFilter) : allSales;

  const customerName = (id) => store.customers.find((c) => c.id === id)?.name ?? '—';
  const productName = (id) => store.products.find((p) => p.id === id)?.name ?? '—';

  const totals = {
    revenue: allSales.reduce((s, x) => s + (Number(x.total) || 0), 0),
    paid: allSales.reduce((s, x) => s + (Number(x.paid_amount) || 0), 0),
    outstanding: allSales.reduce((s, x) => s + Math.max(0, (Number(x.total) || 0) - (Number(x.paid_amount) || 0)), 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCustomer ? 'My Invoices' : 'Sales Management'}
        subtitle={isCustomer ? 'Review invoice totals, amounts paid, and balances due.' : 'Confirm a sale to decrease stock (spec §21, §36)'}
        actions={!isCustomer && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New Sale</Button>}
      />

      {isCustomer ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KPICard icon={FileText} label="Invoices" value={allSales.length} sub="Delivered orders and sales" tone="blue" />
          <KPICard icon={CreditCard} label="Total Paid" value={formatRWF(totals.paid)} tone="green" />
          <KPICard icon={Clock3} label="Balance Due" value={formatRWF(totals.outstanding)} tone={totals.outstanding ? 'amber' : 'green'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <KPICard icon={FileText} label="Total Sales" value={formatRWF(totals.revenue)} sub={`${allSales.length} invoices`} tone="green" />
          <KPICard icon={FileText} label="Payments Received" value={formatRWF(totals.paid)} tone="blue" />
          <KPICard icon={FileText} label="Outstanding" value={formatRWF(totals.outstanding)} tone={totals.outstanding > 0 ? 'amber' : 'green'} />
        </div>
      )}

      {isCustomer && <div><h2 className="text-base font-bold text-gray-800">Invoice statements</h2><p className="mt-1 text-sm text-gray-500">Review delivered quantities, invoice totals, payments received, and balances due.</p></div>}
      <DataTable
        columns={[
          { key: 'invoice_number', label: 'Invoice', render: (s) => (
            <button className="flex items-center gap-1.5 font-mono font-semibold text-green-700 hover:underline" onClick={(e) => { e.stopPropagation(); setDetail(s); }}>
              <FileText className="h-3.5 w-3.5" /> {s.invoice_number}
            </button>
          )},
          { key: 'sale_date', label: 'Date', render: (s) => <span className="text-gray-500">{formatDate(s.sale_date)}</span> },
          !isCustomer && { key: 'customer_id', label: 'Customer', render: (s) => <span className="text-gray-600">{customerName(s.customer_id)}</span> },
          { key: 'items', label: 'Items', sortable: false, render: (s) => (
            <span className="text-xs text-gray-500">{s.items.map((it) => `${it.quantity} kg ${productName(it.product_id)}`).join(', ')}</span>
          )},
          { key: 'total', label: 'Total', render: (s) => <span className="font-semibold text-gray-700">{formatRWF(s.total)}</span> },
          { key: 'paid_amount', label: 'Paid', render: (s) => <span className="text-green-600">{formatRWF(s.paid_amount ?? 0)}</span> },
          { key: 'balance', label: 'Balance Due', render: (s) => {
            const balance = Math.max(0, Number(s.total) - Number(s.paid_amount ?? 0));
            return <span className={balance > 0 ? 'font-semibold text-red-500' : 'font-semibold text-green-600'}>{formatRWF(balance)}</span>;
          } },
          { key: 'payment_status', label: 'Payment', render: (s) => <StatusBadge status={s.payment_status} /> },
        ].filter(Boolean)}
        rows={rows}
        searchKeys={['invoice_number']}
        searchPlaceholder="Search invoice number…"
        emptyHint={isCustomer ? 'No invoices yet. An invoice appears here after an order is delivered.' : 'No invoices match this filter.'}
        filters={
          <FilterSelect
            value={payStatusFilter}
            onChange={setPayStatusFilter}
            placeholder="All payment statuses"
            options={['PAID', 'PARTIAL', 'UNPAID'].map((s) => ({ value: s, label: prettyLabel(s) }))}
          />
        }
        pageSize={8}
      />

      {/* Invoice detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Invoice ${detail?.invoice_number ?? ''}`}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
              <div>
                <div className="text-xs text-gray-400">Customer</div>
                <div className="font-semibold text-gray-700">{customerName(detail.customer_id)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Date</div>
                <div className="text-sm text-gray-600">{formatDate(detail.sale_date)}</div>
              </div>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
                  <th className="py-2">Product</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Price</th>
                  <th className="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700">{productName(it.product_id)}</td>
                    <td className="py-2 text-gray-600">{it.quantity} kg</td>
                    <td className="py-2 text-gray-600">{it.unit_price?.toLocaleString()}</td>
                    <td className="py-2 text-right font-medium text-gray-700">{(it.quantity * (it.unit_price ?? 0)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatRWF(detail.subtotal)}</span></div>
              {detail.discount > 0 && <div className="flex justify-between text-gray-500"><span>Discount</span><span>−{formatRWF(detail.discount)}</span></div>}
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-800"><span>Total</span><span>{formatRWF(detail.total)}</span></div>
              <div className="flex justify-between text-green-600"><span>Paid</span><span>{formatRWF(detail.paid_amount ?? 0)}</span></div>
              <div className="flex justify-between font-semibold text-red-500"><span>Outstanding</span><span>{formatRWF(detail.total - (detail.paid_amount ?? 0))}</span></div>
            </div>
          </div>
        )}
      </Modal>

      {!isCustomer && (
        <CreateSaleModal open={createOpen} onClose={() => setCreateOpen(false)} />
      )}
    </div>
  );
}

function CreateSaleModal({ open, onClose }) {
  const store = useStore();
  const pushToast = useStore((s) => s.pushToast);
  const [form, setForm] = useState({ customer_id: '', product_id: '', quantity: '', unit_price: '', discount: '0' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const product = store.products.find((p) => p.id === form.product_id);

  function submit(e) {
    e.preventDefault();
    const qty = Number(form.quantity);
    const price = Number(form.unit_price || product?.selling_price);
    if (!form.customer_id) return pushToast('Select a customer', 'error');
    if (!form.product_id) return pushToast('Select a product', 'error');
    if (!Number.isFinite(qty) || qty <= 0) return pushToast('Quantity must be positive', 'error');
    try {
      store.createSale({
        customer_id: form.customer_id,
        items: [{ product_id: form.product_id, quantity: qty, unit_price: price }],
        discount: Number(form.discount || 0),
      });
      pushToast('Sale created — stock updated', 'success');
      setForm({ customer_id: '', product_id: '', quantity: '', unit_price: '', discount: '0' });
      onClose();
    } catch (err) {
      pushToast(err.message, 'error');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Sale">
      <form onSubmit={submit} className="space-y-4">
        <Select label="Customer" value={form.customer_id} onChange={set('customer_id')} required>
          <option value="">Select customer…</option>
          {store.customers.filter((c) => c.status === 'ACTIVE').map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select label="Product" value={form.product_id} onChange={set('product_id')} required>
          <option value="">Select product…</option>
          {store.products.filter((p) => p.status === 'ACTIVE').map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {formatRWF(p.selling_price)}/kg</option>
          ))}
        </Select>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Quantity (kg)" type="number" min="1" value={form.quantity} onChange={set('quantity')} required />
          <Input label="Unit price (RWF)" type="number" min="0" value={form.unit_price} onChange={set('unit_price')} placeholder={product ? String(product.selling_price) : ''} />
          <Input label="Discount (RWF)" type="number" min="0" value={form.discount} onChange={set('discount')} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create Sale</Button>
        </div>
      </form>
    </Modal>
  );
}
