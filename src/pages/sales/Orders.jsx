import { useState } from 'react';
import { Plus, CheckCircle2, XCircle, Lock, CreditCard, Truck, Pencil, Trash2, Clock3, ShoppingCart } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Select, Input, Textarea, StatusBadge } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader, KPICard } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { formatDate, formatNumber, formatRWF, prettyLabel } from '../../lib/format';
import { availableQty, paymentStatus } from '../../lib/calc';

export default function Orders() {
  const store = useStore();
  const isCustomer = store.profile?.role === 'customer';
  const myCustomerId = store.profile?.customer_id;
  const run = useAction();

  const [createOpen, setCreateOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [invoicing, setInvoicing] = useState(null);
  const [paying, setPaying] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const allOrders = isCustomer ? store.orders.filter((o) => o.customer_id === myCustomerId) : store.orders;
  const rows = statusFilter ? allOrders.filter((o) => o.status === statusFilter) : allOrders;

  const customerName = (id) => store.customers.find((c) => c.id === id)?.name ?? '—';
  const productName = (id) => store.products.find((p) => p.id === id)?.name ?? '—';

  const canConfirm = !isCustomer;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCustomer ? 'My Orders' : 'Order Management'}
        subtitle={isCustomer ? 'Place orders and follow their progress through delivery.' : 'Confirm orders to reserve stock (spec §22, §36)'}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Place Order</Button>}
      />

      {isCustomer ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KPICard icon={ShoppingCart} label="Total Orders" value={allOrders.length} tone="blue" />
          <KPICard icon={Clock3} label="Awaiting Confirmation" value={allOrders.filter((order) => order.status === 'PENDING').length} tone="amber" />
          <KPICard icon={CheckCircle2} label="Delivered" value={allOrders.filter((order) => order.status === 'COMPLETED').length} tone="green" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard icon={Plus} label="Pending" value={allOrders.filter((o) => o.status === 'PENDING').length} tone="amber" />
          <KPICard icon={Lock} label="Confirmed / Reserved" value={allOrders.filter((o) => ['CONFIRMED', 'PROCESSING', 'READY'].includes(o.status)).length} tone="blue" />
          <KPICard icon={CheckCircle2} label="Completed" value={allOrders.filter((o) => o.status === 'COMPLETED').length} tone="green" />
          <KPICard icon={XCircle} label="Cancelled" value={allOrders.filter((o) => o.status === 'CANCELLED').length} tone="red" />
        </div>
      )}

      {isCustomer && <div><h2 className="text-base font-bold text-gray-800">Order progress</h2><p className="mt-1 text-sm text-gray-500">Review requested items, warehouse allocation, and each order’s delivery status.</p></div>}
      <DataTable
        columns={[
          { key: 'order_number', label: 'Order', render: (o) => (
            <div>
              <div className="font-mono font-semibold text-gray-700">{o.order_number}</div>
              <div className="text-xs text-gray-400">{formatDate(o.created_at)}</div>
            </div>
          )},
          !isCustomer && { key: 'customer_id', label: 'Customer', render: (o) => <span className="text-gray-600">{customerName(o.customer_id)}</span> },
          { key: 'items', label: 'Items', sortable: false, render: (o) => (
            <div className="text-sm text-gray-600">
              {o.items.map((it, i) => (
                <div key={i} className="text-xs">
                  <div>{it.quantity} × {productName(it.product_id)}</div>
                  {['CONFIRMED', 'PROCESSING', 'READY', 'COMPLETED'].includes(o.status) && (
                    <div className="font-medium text-gray-600">Unit price: {formatRWF(it.unit_price ?? 0)}/{store.products.find((product) => product.id === it.product_id)?.unit ?? 'unit'}</div>
                  )}
                  <div className="text-gray-400">{it.warehouse_id ? store.warehouses.find((warehouse) => warehouse.id === it.warehouse_id)?.name ?? 'Warehouse unavailable' : 'Warehouse not assigned'}</div>
                </div>
              ))}
            </div>
          )},
          { key: 'expected', label: 'Expected', render: (o) => {
            if (isCustomer && o.status !== 'COMPLETED') return '—';
            const invoice = store.sales.find((sale) => sale.order_id === o.id);
            return <span className="font-semibold text-gray-700">{formatRWF(invoice?.total ?? orderTotal(o))}</span>;
          } },
          { key: 'paid_amount', label: 'Paid', render: (o) => {
            if (isCustomer && o.status !== 'COMPLETED') return '—';
            const invoice = store.sales.find((sale) => sale.order_id === o.id);
            return <span className="text-green-600">{formatRWF(invoice?.paid_amount ?? orderPaid(o))}</span>;
          } },
          { key: 'remaining', label: 'Remaining', render: (o) => {
            if (isCustomer && o.status !== 'COMPLETED') return '—';
            const invoice = store.sales.find((sale) => sale.order_id === o.id);
            const balance = invoice ? Math.max(0, invoice.total - (invoice.paid_amount ?? 0)) : orderRemaining(o);
            return <span className={balance > 0 ? 'font-semibold text-red-500' : 'font-semibold text-green-600'}>{formatRWF(balance)}</span>;
          } },
          { key: 'status', label: 'Status', render: (o) => <StatusBadge status={o.status} /> },
          { key: 'actions', label: '', sortable: false, render: (o) => (
            <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              {o.status === 'PENDING' && canConfirm && (
                <Button size="sm" onClick={() => setConfirming(o)}>
                  <Lock className="h-3.5 w-3.5" /> Confirm
                </Button>
              )}
              {o.status === 'PENDING' && (canConfirm || o.customer_id === myCustomerId) && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(o)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(o)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </>
              )}
              {['CONFIRMED', 'PROCESSING', 'READY'].includes(o.status) && canConfirm && (
                <Button size="sm" onClick={() => setInvoicing(o)}>
                  <Truck className="h-3.5 w-3.5" /> Deliver
                </Button>
              )}
              {o.status === 'COMPLETED' && canConfirm && (() => {
                const sale = store.sales.find((invoice) => invoice.order_id === o.id);
                if (!sale) return null;
                const orderPayments = store.payments.filter((payment) => payment.sale_id === sale.id || payment.order_id === o.id);
                return <>
                  {sale.total > (sale.paid_amount ?? 0) && <Button size="sm" variant="secondary" onClick={() => setPaying(sale)}><CreditCard className="h-3.5 w-3.5" /> Add payment</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setPaymentHistory({ order: o, sale, payments: orderPayments })}>Payment history ({orderPayments.length})</Button>
                </>;
              })()}
              {['PENDING', 'CONFIRMED', 'PROCESSING', 'READY'].includes(o.status) && canConfirm && (
                <Button size="sm" variant="ghost" onClick={() => run(() => store.cancelOrder(o.id), 'Order cancelled — reserved stock released')}>
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
            </div>
          )},
        ].filter(Boolean)}
        rows={rows}
        searchKeys={['order_number']}
        searchPlaceholder="Search order number…"
        emptyHint={isCustomer ? 'No orders yet. Place an order to get started.' : 'No orders match these filters.'}
        filters={
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All statuses"
            options={['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'].map((s) => ({ value: s, label: prettyLabel(s) }))}
          />
        }
        pageSize={8}
      />

      <CreateOrderModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditOrderModal
        key={editing?.id ?? 'edit-closed'}
        order={editing}
        onClose={() => setEditing(null)}
        onSubmit={(changes) => {
          run(() => store.updateOrder(editing.id, changes), 'Pending order updated');
          setEditing(null);
        }}
      />
      <DeletePendingOrderModal
        order={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          run(() => store.deletePendingOrder(deleting.id), 'Pending order deleted');
          setDeleting(null);
        }}
      />
      <InvoiceOrderModal
        key={invoicing?.id ?? 'delivery-closed'}
        order={invoicing}
        onClose={() => setInvoicing(null)}
      />
      <DeliveryPaymentModal
        key={paying?.id ?? 'payment-closed'}
        sale={paying}
        onClose={() => setPaying(null)}
        onSubmit={(data) => {
          run(() => store.addPayment({ sale_id: paying.id, amount: Number(data.amount), method: data.method, payment_date: data.payment_date, reference: data.reference }), 'Payment recorded');
          setPaying(null);
        }}
      />
      <OrderPaymentHistoryModal data={paymentHistory} onClose={() => setPaymentHistory(null)} />
      <ConfirmOrderModal
        key={confirming?.id ?? 'confirm-closed'}
        order={confirming}
        onClose={() => setConfirming(null)}
        onConfirm={(items) => {
          const expectedAmount = orderTotal({ items });
          const paidAmount = orderPaid(confirming);
          run(() => {
            store.confirmOrder(confirming.id, items);
            store.updateOrder(confirming.id, {
              expected_amount: expectedAmount,
              remaining_amount: expectedAmount - paidAmount,
              payment_status: paymentStatus(expectedAmount, paidAmount),
            });
          }, 'Order confirmed — stock reserved');
          setConfirming(null);
        }}
      />
    </div>
  );
}

function DeletePendingOrderModal({ order, onClose, onConfirm }) {
  if (!order) return null;
  return (
    <Modal open onClose={onClose} title={`Delete ${order.order_number}?`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">This permanently removes the pending order. Confirmed or paid orders cannot be deleted.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Keep order</Button>
          <Button type="button" variant="danger" onClick={onConfirm}><Trash2 className="h-4 w-4" /> Delete order</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditOrderModal({ order, onClose, onSubmit }) {
  const store = useStore();
  const pushToast = useStore((state) => state.pushToast);
  const [items, setItems] = useState(() => order?.items?.map((item) => ({ ...item, quantity: String(item.quantity), unit_price: String(item.unit_price ?? 0) })) ?? []);
  const [notes, setNotes] = useState(order?.notes ?? '');
  if (!order) return null;

  const expected = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
  const paid = orderPaid(order);
  const valid = items.length > 0 && items.every((item) => item.product_id && Number(item.quantity) > 0 && Number(item.unit_price) >= 0) && expected >= paid;

  function submit(event) {
    event.preventDefault();
    if (expected < paid) return pushToast('Order total cannot be less than the amount already paid', 'error');
    if (!items.length || items.some((item) => !item.product_id || Number(item.quantity) <= 0 || Number(item.unit_price) < 0)) {
      return pushToast('Choose a product and enter a valid quantity and price for every item', 'error');
    }
    onSubmit({
      items: items.map((item) => ({ ...item, quantity: Number(item.quantity), unit_price: Number(item.unit_price) })),
      notes,
      expected_amount: expected,
      remaining_amount: expected - paid,
      payment_status: paymentStatus(expected, paid),
    });
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${order.order_number}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">Update this pending order before it is confirmed. The warehouse is selected during confirmation.</p>
        <div className="space-y-3">
          {items.map((item, index) => {
            const choices = store.products.filter((product) => product.status === 'ACTIVE' || product.id === item.product_id);
            return <div key={index} className="grid grid-cols-1 items-end gap-3 rounded-xl border border-gray-100 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Select label="Product" value={item.product_id} onChange={(event) => {
                const product = store.products.find((candidate) => candidate.id === event.target.value);
                setItems((current) => current.map((line, i) => i === index ? { ...line, product_id: event.target.value, batch_id: null, warehouse_id: undefined, unit_price: String(product?.selling_price ?? line.unit_price ?? 0) } : line));
              }} required>
                <option value="">Select product…</option>
                {choices.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </Select>
              <Input label="Quantity (kg)" type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => setItems((current) => current.map((line, i) => i === index ? { ...line, quantity: event.target.value } : line))} required />
              <Input label="Unit price (RWF)" type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => setItems((current) => current.map((line, i) => i === index ? { ...line, unit_price: event.target.value } : line))} required />
              {items.length > 1 && <Button type="button" variant="ghost" aria-label="Remove item" onClick={() => setItems((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>}
            </div>;
          })}
        </div>
        <Button type="button" variant="secondary" onClick={() => setItems((current) => [...current, { product_id: '', quantity: '', unit_price: '0', batch_id: null, warehouse_id: undefined }])}>Add item</Button>
        <Textarea label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <div className="flex justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm"><span className="text-gray-600">Updated expected total</span><strong>{formatRWF(expected)}</strong></div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!valid}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateOrderModal({ open, onClose }) {
  const store = useStore();
  const pushToast = useStore((s) => s.pushToast);
  const isCustomer = store.profile?.role === 'customer';
  const orderableProducts = store.products.filter((product) => product.status === 'ACTIVE');
  const [form, setForm] = useState({ customer_id: '', product_id: '', quantity: '', unit_price: '', notes: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const selectedProduct = orderableProducts.find((product) => product.id === form.product_id);
  const expected = (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);

  function submit(e) {
    e.preventDefault();
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return pushToast('Quantity must be positive', 'error');
    const price = Number(form.unit_price);
    if (!selectedProduct) return pushToast('Select a product', 'error');
    if (!Number.isFinite(price) || price < 0) return pushToast('Unit price cannot be negative', 'error');
    try {
      store.placeOrder({
        customer_id: isCustomer ? store.profile?.customer_id : form.customer_id,
        items: [{ product_id: selectedProduct.id, quantity: qty, unit_price: price }],
        notes: form.notes,
      });
      pushToast('Order placed', 'success');
      setForm({ customer_id: '', product_id: '', quantity: '', unit_price: '', notes: '' });
      onClose();
    } catch (err) {
      pushToast(err.message, 'error');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Place Order">
      <form onSubmit={submit} className="space-y-4">
        {!isCustomer && (
          <Select label="Customer" value={form.customer_id} onChange={set('customer_id')} required>
            <option value="">Select customer…</option>
            {store.customers.filter((c) => c.status === 'ACTIVE').map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        )}
        <Select label="Product" value={form.product_id} onChange={(event) => {
          const product = orderableProducts.find((item) => item.id === event.target.value);
          setForm((current) => ({ ...current, product_id: event.target.value, quantity: '', unit_price: product ? String(product.selling_price ?? 0) : '' }));
        }} required>
          <option value="">Select a product…</option>
          {orderableProducts.map((product) => (
            <option key={product.id} value={product.id}>{product.name}</option>
          ))}
        </Select>
        <p className="text-xs text-gray-500">Choose the warehouse when the order is confirmed.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Quantity (kg)" type="number" min="0.01" step="0.01" value={form.quantity} onChange={set('quantity')} required />
          <Input label="Unit price (RWF)" type="number" min="0" step="0.01" value={form.unit_price} onChange={set('unit_price')} required />
        </div>
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
          <div className="flex justify-between text-gray-600"><span>Expected to pay</span><strong>{formatRWF(expected)}</strong></div>
          <div className="mt-1 flex justify-between border-t border-gray-200 pt-2 font-bold text-red-500"><span>Balance due after delivery</span><span>{formatRWF(expected)}</span></div>
        </div>
        <Textarea label="Notes" value={form.notes} onChange={set('notes')} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Place Order</Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Deliver a confirmed order: creates the invoice (stock decreased + reservation
 * released via createSale) and completes the order lifecycle (§22, §36).
 */
function InvoiceOrderModal({ order, onClose }) {
  const store = useStore();
  const pushToast = useStore((s) => s.pushToast);
  const [discount, setDiscount] = useState('0');
  const [items, setItems] = useState(() => order?.items?.map((item) => ({ ...item, quantity: String(item.quantity) })) ?? []);
  if (!order) return null;

  const expectedAmount = orderTotal({ items });
  const paidAmount = orderPaid(order);
  const discountNum = Math.min(Math.max(0, Number(discount) || 0), expectedAmount);
  const total = expectedAmount - discountNum;
  const remaining = Math.max(0, total - paidAmount);

  function submit(e) {
    e.preventDefault();
    try {
      store.createSale({
        customer_id: order.customer_id,
        items: items.map((item) => ({ ...item, quantity: Number(item.quantity) })),
        discount: discountNum,
        order_id: order.id,
        notes: `Fulfilled order ${order.order_number}`,
      });
      pushToast(`Order ${order.order_number} delivered — invoice created and stock updated`, 'success');
      onClose();
    } catch (err) {
      pushToast(err.message, 'error');
    }
  }

  return (
    <Modal open onClose={onClose} title={`Deliver ${order.order_number}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">Enter the quantity delivered. Reserved stock is used first; any extra quantity must be available in the same warehouse and batch.</p>
        <div className="overflow-hidden rounded-xl border border-gray-100 text-sm">
          {items.map((item, i) => {
            const reservedForLine = Number(order.items[i]?.quantity) || 0;
            const maxDelivery = reservedForLine;
            return (
              <div key={i} className="grid grid-cols-1 items-end gap-3 border-b border-gray-100 px-3 py-3 last:border-0 sm:grid-cols-[1fr_auto]">
                <div>
                  <div className="font-medium text-gray-700">{store.products.find((p) => p.id === item.product_id)?.name ?? '—'}</div>
                  <div className="mt-1 text-xs text-gray-500">Ordered: {formatNumber(reservedForLine)} kg</div>
                </div>
                <Input label={`Delivered quantity (kg) · ${formatRWF(item.unit_price)}/kg`} type="number" min="0.01" step="0.01" max={maxDelivery} value={item.quantity} onChange={(event) => setItems((current) => current.map((line, index) => index === i ? { ...line, quantity: event.target.value } : line))} required />
              </div>
            );
          })}
        </div>
        <Input label="Discount (RWF)" type="number" min="0" step="0.01" max={expectedAmount} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><strong>{formatRWF(expectedAmount)}</strong></div>
          <div className="mt-1 flex justify-between text-gray-600"><span>Discount</span><strong>−{formatRWF(discountNum)}</strong></div>
          <div className="mt-1 flex justify-between text-green-600"><span>Paid</span><strong>{formatRWF(paidAmount)}</strong></div>
          <div className="mt-1 flex justify-between text-gray-600"><span>Balance due after delivery</span><strong>{formatRWF(remaining)}</strong></div>
        </div>
        <p className="text-xs text-gray-500">Record payment after delivery from the Payments page.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit"><Truck className="h-4 w-4" /> Confirm delivery</Button>
        </div>
      </form>
    </Modal>
  );
}

function DeliveryPaymentModal({ sale, onClose, onSubmit }) {
  const [form, setForm] = useState({ amount: '', method: 'Cash', payment_date: new Date().toISOString().slice(0, 10), reference: '' });
  const [showWays, setShowWays] = useState(false);
  const [amountWarning, setAmountWarning] = useState(false);
  if (!sale) return null;
  const outstanding = Math.max(0, Number(sale.total) - Number(sale.paid_amount ?? 0));
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setAmount = (event) => {
    const value = event.target.value;
    setAmountWarning(Boolean(value) && Number(value) > outstanding);
    setForm((current) => ({ ...current, amount: value }));
  };

  return (
    <Modal open onClose={onClose} title={`Record payment — ${sale.invoice_number}`}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="space-y-4">
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">Remaining balance: <strong className="text-red-600">{formatRWF(outstanding)}</strong></div>
        <Input label="Paid amount (RWF)" type="number" min="1" step="0.01" max={outstanding} value={form.amount} onChange={setAmount} aria-invalid={amountWarning} required />
        {amountWarning && <p role="alert" className="text-sm font-medium text-red-600">Payment cannot be greater than the remaining balance of {formatRWF(outstanding)}.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Payment method" value={form.method} onChange={set('method')}>
            {['Cash', 'Bank Transfer', 'Mobile Money', 'Other'].map((method) => <option key={method} value={method}>{method}</option>)}
          </Select>
          <Input label="Payment date" type="date" value={form.payment_date} onChange={set('payment_date')} required />
        </div>
        <Input label="Reference (optional)" value={form.reference} onChange={set('reference')} placeholder="Mobile money reference or bank slip number" />
        <Button type="button" variant="secondary" onClick={() => setShowWays((visible) => !visible)}>
          {showWays ? 'Hide payment options' : 'How can the remaining balance be paid?'}
        </Button>
        {showWays && <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">Accepted payment methods</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Cash: receive it at the cashier.</li>
            <li>Bank Transfer: use the organization’s bank details and enter the transfer reference.</li>
            <li>Mobile Money: pay to the organization’s registered number and enter the transaction reference.</li>
          </ul>
          <p className="mt-2 text-xs">Ask your cashier for the current bank or mobile money details.</p>
        </div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!Number(form.amount) || Number(form.amount) > outstanding}><CreditCard className="h-4 w-4" /> Record payment</Button>
        </div>
      </form>
    </Modal>
  );
}

function OrderPaymentHistoryModal({ data, onClose }) {
  if (!data) return null;
  const { order, sale, payments } = data;
  return (
    <Modal open onClose={onClose} title={`Payment history — ${order.order_number}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
          <div className="flex justify-between text-gray-600"><span>Invoice total</span><strong>{formatRWF(sale.total)}</strong></div>
          <div className="mt-1 flex justify-between text-green-700"><span>Total paid</span><strong>{formatRWF(sale.paid_amount ?? 0)}</strong></div>
          <div className="mt-1 flex justify-between border-t border-gray-200 pt-2 font-bold text-red-600"><span>Balance remaining</span><span>{formatRWF(Math.max(0, sale.total - (sale.paid_amount ?? 0)))}</span></div>
        </div>
        {payments.length ? <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Reference</th></tr></thead>
            <tbody>{payments.slice().sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)).map((payment) => (
              <tr key={payment.id} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-600">{formatDate(payment.payment_date)}</td>
                <td className="px-3 py-2 text-gray-600">{payment.method}</td>
                <td className="px-3 py-2 font-semibold text-green-700">{formatRWF(payment.amount)}</td>
                <td className="px-3 py-2 text-gray-500">{payment.reference || '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div> : <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No payments have been recorded for this order yet.</p>}
        <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Close</Button></div>
      </div>
    </Modal>
  );
}

function ConfirmOrderModal({ order, onClose, onConfirm }) {
  const store = useStore();
  const [items, setItems] = useState(() => order?.items?.map((item) => ({ ...item, warehouse_id: item.warehouse_id ?? '' })) ?? []);
  if (!order) return null;
  const productName = (id) => store.products.find((product) => product.id === id)?.name ?? '—';
  const availability = items.map((item, index) => {
    const warehouseStock = store.warehouses.map((warehouse) => ({
      ...warehouse,
      available: store.inventory
        .filter((inventory) => inventory.product_id === item.product_id && inventory.warehouse_id === warehouse.id && (item.batch_id == null || inventory.batch_id === item.batch_id))
        .reduce((sum, inventory) => sum + availableQty(inventory), 0),
    }));
    const selectedWarehouse = warehouseStock.find((warehouse) => warehouse.id === item.warehouse_id);
    return { ...item, index, warehouseStock, available: selectedWarehouse?.available ?? 0 };
  });
  const expectedAmount = orderTotal({ items });
  const paidAmount = orderPaid(order);
  const canReserve = availability.every((item) => item.warehouse_id && Number(item.quantity) > 0 && item.available >= Number(item.quantity)) && paidAmount <= expectedAmount;
  return (
    <Modal open onClose={onClose} title={`Confirm ${order.order_number}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Choose a warehouse and confirm the quantity to reserve. The confirmed quantity may be lower than the original request.</p>
        <div className="overflow-hidden rounded-xl border border-gray-100 text-sm">
          {availability.map((item) => <div key={item.index} className="grid grid-cols-1 gap-2 border-b border-gray-100 px-3 py-3 last:border-0 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <span className="pb-2 text-gray-700">{productName(item.product_id)}</span>
            <Select label="Warehouse" value={item.warehouse_id} onChange={(event) => setItems((current) => current.map((line, index) => index === item.index ? { ...line, warehouse_id: event.target.value } : line))} required>
              <option value="">Select warehouse…</option>
              {item.warehouseStock.map((warehouse) => <option key={warehouse.id} value={warehouse.id} disabled={warehouse.available <= 0}>{warehouse.name} — {warehouse.available.toLocaleString()} kg available</option>)}
            </Select>
            <span className="pb-2 text-xs font-semibold text-green-700">{item.available.toLocaleString()} kg available</span>
            <Input label="Confirm kg" type="number" min="0.01" step="0.01" max={item.available || undefined} value={item.quantity} onChange={(event) => setItems((current) => current.map((line, index) => index === item.index ? { ...line, quantity: event.target.value } : line))} className="sm:w-32" required />
          </div>)}
        </div>
        {!canReserve && <p className="text-sm text-red-600">Select a warehouse with enough available stock for every item before confirming.</p>}
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
          <div className="flex justify-between text-gray-600"><span>Expected to pay</span><strong>{formatRWF(expectedAmount)}</strong></div>
          <div className="mt-1 flex justify-between text-green-600"><span>Paid</span><strong>{formatRWF(paidAmount)}</strong></div>
          <div className="mt-1 flex justify-between border-t border-gray-200 pt-2 font-bold text-red-500"><span>Remaining</span><span>{formatRWF(Math.max(0, expectedAmount - paidAmount))}</span></div>
        </div>
        {paidAmount > expectedAmount && <p className="text-sm text-red-600">The paid amount is higher than this confirmed quantity. Increase the confirmed quantity or correct the payment first.</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(items)} disabled={!canReserve}><Lock className="h-4 w-4" /> Confirm & reserve</Button>
        </div>
      </div>
    </Modal>
  );
}

function orderTotal(order) {
  return (order.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
}

function orderPaid(order) {
  return Math.max(0, Number(order.paid_amount) || 0);
}

function orderRemaining(order) {
  return Math.max(0, orderTotal(order) - orderPaid(order));
}
