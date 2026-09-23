import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Badge } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/KPICard';
import { useAction } from '../../hooks/useAction';
import { formatRWF } from '../../lib/format';

export default function PortalProducts() {
  const store = useStore();
  const run = useAction();
  const [order, setOrder] = useState(null); // { product }
  const [qty, setQty] = useState('');

  const availableOf = (productId) =>
    store.inventory
      .filter((i) => i.product_id === productId)
      .reduce((s, i) => s + Math.max(0, i.quantity - (i.reserved_qty ?? 0) - (i.quarantined_qty ?? 0) - (i.damaged_qty ?? 0)), 0);

  const varName = (id) => store.varieties.find((v) => v.id === id)?.name ?? '—';
  const clsName = (id) => store.seedClasses.find((c) => c.id === id)?.name ?? '—';

  const ordersEnabled = store.settings.enableCustomerOrders;

  function placeOrder() {
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) return store.pushToast('Quantity must be positive', 'error');
    if (quantity > availableOf(order.product.id)) return store.pushToast('Quantity exceeds available stock', 'error');
    run(() => store.placeOrder({
      customer_id: store.profile?.customer_id,
      items: [{ product_id: order.product.id, quantity, unit_price: order.product.selling_price }],
    }), 'Order placed — awaiting confirmation');
    setOrder(null);
    setQty('');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Browse Certified Seed"
        subtitle="Irish potato seed produced and quality-approved by VFA"
      />

      {!ordersEnabled && (
        <div className="rounded-xl border border-yellow-100 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          Ordering is currently disabled. Please contact VFA directly to place your order.
        </div>
      )}

      <DataTable
        columns={[
          { key: 'name', label: 'Product', render: (p) => (
            <div>
              <div className="font-semibold text-gray-700">{p.name}</div>
              <div className="text-xs text-gray-400">{varName(p.variety_id)} · {clsName(p.seed_class_id)} · {p.unit}</div>
            </div>
          )},
          { key: 'description', label: 'Description', render: (p) => <span className="text-sm text-gray-500">{p.description}</span> },
          { key: 'selling_price', label: 'Price', render: (p) => <span className="font-bold text-green-700">{formatRWF(p.selling_price)}/{p.unit}</span> },
          { key: 'stock', label: 'Availability', render: (p) => {
            const a = availableOf(p.id);
            return a > 0
              ? <Badge color="green">{formatRWF === null ? null : `${a.toLocaleString()} ${p.unit} available`}</Badge>
              : <Badge color="red">Out of stock</Badge>;
          }},
          { key: 'actions', label: '', sortable: false, render: (p) => (
            ordersEnabled && availableOf(p.id) > 0 ? (
              <Button size="sm" onClick={() => setOrder({ product: p })}>
                <ShoppingCart className="h-3.5 w-3.5" /> Order
              </Button>
            ) : null
          )},
        ]}
        rows={store.products.filter((p) => p.status === 'ACTIVE')}
        searchKeys={['name', 'description']}
        searchPlaceholder="Search seed products…"
        pageSize={8}
      />

      <Modal open={!!order} onClose={() => setOrder(null)} title={`Order ${order?.product?.name ?? ''}`}>
        {order && (
          <form onSubmit={(e) => { e.preventDefault(); placeOrder(); }} className="space-y-4">
            <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
              Price: <strong>{formatRWF(order.product.selling_price)}</strong>/{order.product.unit} ·
              Available: <strong>{availableOf(order.product.id).toLocaleString()} {order.product.unit}</strong>
            </div>
            <Input
              label={`Quantity (${order.product.unit})`}
              type="number"
              min="1"
              max={availableOf(order.product.id)}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
            <div className="text-sm text-gray-500">
              Estimated total: <strong className="text-gray-700">{formatRWF((Number(qty) || 0) * order.product.selling_price)}</strong>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOrder(null)}>Cancel</Button>
              <Button type="submit"><ShoppingCart className="h-4 w-4" /> Place Order</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
