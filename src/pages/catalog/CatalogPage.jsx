import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, Textarea, StatusBadge } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/KPICard';
import { useAction } from '../../hooks/useAction';
import { formatDate } from '../../lib/format';

/**
 * Generic catalog page for simple reference entities
 * (categories, varieties, seed classes) per spec §9–11.
 */
export default function CatalogPage({
  title, subtitle, entityKey, columns, fields, addKey, updateKey, deleteKey, addLabel,
}) {
  const rows = useStore((s) => s[entityKey]);
  const addAction = useStore((s) => s[addKey]);
  const updateAction = useStore((s) => s[updateKey]);
  const deleteAction = useStore((s) => s[deleteKey]);
  const run = useAction();
  const [modal, setModal] = useState(null);

  function save(form) {
    if (modal.mode === 'create') run(() => addAction(form), `${addLabel} created`);
    else run(() => updateAction(modal.row.id, form), `${addLabel} updated`);
    setModal(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={<Button onClick={() => setModal({ mode: 'create' })}><Plus className="h-4 w-4" /> Add {addLabel}</Button>}
      />

      <DataTable
        columns={[
          ...columns,
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'created_at', label: 'Created', render: (r) => <span className="text-gray-400">{formatDate(r.created_at)}</span> },
          { key: 'actions', label: '', sortable: false, render: (r) => (
            <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="secondary" onClick={() => setModal({ mode: 'edit', row: r })}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => run(() => deleteAction(r.id), `${addLabel} deleted`)}>Delete</Button>
            </div>
          )},
        ]}
        rows={rows}
        pageSize={8}
      />

      {modal && (
        <CatalogModal
          open={!!modal}
          onClose={() => setModal(null)}
          onSave={save}
          fields={fields}
          initial={modal.mode === 'edit' ? modal.row : {}}
          title={`${modal.mode === 'edit' ? 'Edit' : 'Add'} ${addLabel}`}
        />
      )}
    </div>
  );
}

function CatalogModal({ open, onClose, onSave, fields, initial, title }) {
  const [form, setForm] = useState({ status: 'ACTIVE', ...initial });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
        {fields.map((f) => {
          if (f.type === 'select') {
            return (
              <Select key={f.key} label={f.label} value={form[f.key] ?? ''} onChange={set(f.key)} required={f.required}>
                <option value="">Select…</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            );
          }
          if (f.type === 'textarea') {
            return <Textarea key={f.key} label={f.label} value={form[f.key] ?? ''} onChange={set(f.key)} />;
          }
          return (
            <Input key={f.key} label={f.label} type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={set(f.key)} required={f.required} />
          );
        })}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
