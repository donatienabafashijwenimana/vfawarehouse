import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, Textarea, StatusBadge } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { formatRWF, formatDate } from '../../lib/format';

const EMPTY = {
  name: '', sku: '', category_id: '', variety_id: '', seed_class_id: '',
  description: '', unit: 'kg', selling_price: '', minimum_stock: '', status: 'ACTIVE',
};

export default function Products() {
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const varieties = useStore((s) => s.varieties);
  const seedClasses = useStore((s) => s.seedClasses);
  const inventory = useStore((s) => s.inventory);
  const addProduct = useStore((s) => s.addProduct);
  const updateProduct = useStore((s) => s.updateProduct);
  const deleteProduct = useStore((s) => s.deleteProduct);
  const run = useAction();
  const [modal, setModal] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  const stockOf = (productId) =>
    inventory
      .filter((i) => i.product_id === productId)
      .reduce((s, i) => s + Math.max(0, i.quantity - (i.reserved_qty ?? 0) - (i.quarantined_qty ?? 0) - (i.damaged_qty ?? 0)), 0);

  const catName = (id) => categories.find((c) => c.id === id)?.name ?? '—';
  const varName = (id) => varieties.find((v) => v.id === id)?.name ?? '—';
  const clsName = (id) => seedClasses.find((c) => c.id === id)?.name ?? '—';

  const rows = categoryFilter ? products.filter((p) => p.category_id === categoryFilter) : products;

  function save(form) {
    const data = {
      ...form,
      selling_price: Number(form.selling_price),
      minimum_stock: Number(form.minimum_stock),
    };
    if (modal.mode === 'create') run(() => addProduct(data), 'Product created');
    else run(() => updateProduct(modal.product.id, data), 'Product updated');
    setModal(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Management"
        subtitle="Seed products with variety, class, pricing and stock thresholds"
        actions={<Button onClick={() => setModal({ mode: 'create' })}><Plus className="h-4 w-4" /> Add Product</Button>}
      />

      <DataTable
        columns={[
          { key: 'name', label: 'Product', render: (p) => (
            <div>
              <div className="font-semibold text-gray-700">{p.name}</div>
              <div className="font-mono text-xs text-gray-400">{p.sku}</div>
            </div>
          )},
          { key: 'category_id', label: 'Category', render: (p) => <span className="text-gray-600">{catName(p.category_id)}</span> },
          { key: 'variety_id', label: 'Variety', render: (p) => <span className="text-gray-600">{varName(p.variety_id)}</span> },
          { key: 'seed_class_id', label: 'Seed Class', render: (p) => <span className="text-gray-600">{clsName(p.seed_class_id)}</span> },
          { key: 'selling_price', label: 'Price', render: (p) => <span className="font-semibold text-gray-700">{formatRWF(p.selling_price)}</span> },
          { key: 'stock', label: 'Stock', render: (p) => {
            const stock = stockOf(p.id);
            const low = (p.minimum_stock ?? 0) > 0 && stock <= p.minimum_stock;
            return <span className={low ? 'font-semibold text-red-600' : 'text-gray-600'}>{stock.toLocaleString()} {p.unit}</span>;
          }},
          { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
          { key: 'updated_at', label: 'Updated', render: (p) => <span className="text-gray-400">{formatDate(p.updated_at ?? p.created_at)}</span> },
          { key: 'actions', label: '', sortable: false, render: (p) => (
            <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="secondary" onClick={() => setModal({ mode: 'edit', product: p })}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => run(() => deleteProduct(p.id), 'Product deleted')}>Delete</Button>
            </div>
          )},
        ]}
        rows={rows}
        searchKeys={['name', 'sku']}
        searchPlaceholder="Search name or SKU…"
        filters={
          <FilterSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="All categories"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        }
        pageSize={8}
      />

      <ProductModal
        modal={modal}
        onClose={() => setModal(null)}
        onSave={save}
        categories={categories}
        varieties={varieties}
        seedClasses={seedClasses}
      />
    </div>
  );
}

function ProductModal({ modal, onClose, onSave, categories, varieties, seedClasses }) {
  const [form, setForm] = useState(() => (modal?.mode === 'edit' ? { ...modal.product } : { ...EMPTY }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={!!modal} onClose={onClose} title={modal?.mode === 'edit' ? 'Edit Product' : 'Add Product'} width="max-w-2xl">
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Product name" value={form.name} onChange={set('name')} required />
          <Input label="SKU" value={form.sku} onChange={set('sku')} required placeholder="VFA-XXX-XXX" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Category" value={form.category_id} onChange={set('category_id')} required>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Variety" value={form.variety_id} onChange={set('variety_id')} required>
            <option value="">Select…</option>
            {varieties.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
          <Select label="Seed class" value={form.seed_class_id} onChange={set('seed_class_id')} required>
            <option value="">Select…</option>
            {seedClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <Textarea label="Description" value={form.description} onChange={set('description')} />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Unit" value={form.unit} onChange={set('unit')} required />
          <Input label={modal?.mode === 'create' ? 'Initial selling price (RWF)' : 'Selling price (RWF)'} type="number" min="0" step="any" value={form.selling_price} onChange={set('selling_price')} required />
          <Input label="Minimum stock" type="number" min="0" value={form.minimum_stock} onChange={set('minimum_stock')} required />
        </div>
        {modal?.mode === 'create' && (
          <p className="-mt-2 text-xs text-gray-500">This is the starting price customers will see when ordering this product. You can change it later.</p>
        )}
        <Select label="Status" value={form.status} onChange={set('status')}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{modal?.mode === 'edit' ? 'Save Changes' : 'Add Product'}</Button>
        </div>
      </form>
    </Modal>
  );
}
