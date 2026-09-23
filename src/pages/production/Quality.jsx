import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, Textarea, StatusBadge } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader, KPICard } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { formatDate, formatNumber, prettyLabel } from '../../lib/format';

export default function Quality() {
  const batches = useStore((s) => s.batches);
  const products = useStore((s) => s.products);
  const qualityChecks = useStore((s) => s.qualityChecks);
  const addQualityCheck = useStore((s) => s.addQualityCheck);
  const run = useAction();
  const [modal, setModal] = useState(null); // { batch }
  const [statusFilter, setStatusFilter] = useState('');

  const completedBatches = batches.filter((b) => b.status === 'COMPLETED' && b.quality_status === 'PENDING');
  const batchLabel = (b) => {
    if (!b) return '—';
    const p = products.find((p) => p.id === b.product_id);
    return `${b.batch_number} — ${p?.name ?? ''}`;
  };

  const rows = statusFilter ? qualityChecks.filter((q) => q.status === statusFilter) : qualityChecks;

  const kpis = {
    approved: qualityChecks.filter((q) => q.status === 'APPROVED').length,
    rejected: qualityChecks.filter((q) => q.status === 'REJECTED').length,
    quarantined: qualityChecks.filter((q) => q.status === 'QUARANTINED').length,
    pending: batches.filter((b) => b.status === 'COMPLETED' && b.quality_status === 'PENDING').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quality Control"
        subtitle="Inspect completed batches — only approved seed becomes sellable stock (spec §16)"
        actions={completedBatches.length > 0 && (
          <Button onClick={() => setModal({ batch: completedBatches[0] })}>
            <ShieldCheck className="h-4 w-4" /> Inspect next batch
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={ShieldCheck} label="Approved" value={kpis.approved} tone="green" />
        <KPICard icon={ShieldCheck} label="Rejected" value={kpis.rejected} tone="red" />
        <KPICard icon={ShieldCheck} label="Quarantined" value={kpis.quarantined} tone="purple" />
        <KPICard icon={ShieldCheck} label="Awaiting inspection" value={kpis.pending} tone="amber" />
      </div>

      <DataTable
        columns={[
          { key: 'batch_id', label: 'Batch', render: (q) => <span className="font-mono font-semibold text-gray-700">{batchLabel(batches.find((b) => b.id === q.batch_id))}</span> },
          { key: 'inspector', label: 'Inspector' },
          { key: 'inspection_date', label: 'Date', render: (q) => <span className="text-gray-500">{formatDate(q.inspection_date)}</span> },
          { key: 'grade', label: 'Grade', render: (q) => <span className="font-bold text-gray-700">{q.grade}</span> },
          { key: 'accepted_qty', label: 'Accepted', render: (q) => <span className="text-green-600">{formatNumber(q.accepted_qty)} kg</span> },
          { key: 'rejected_qty', label: 'Rejected', render: (q) => <span className="text-red-500">{formatNumber(q.rejected_qty)} kg</span> },
          { key: 'status', label: 'Status', render: (q) => <StatusBadge status={q.status} /> },
          { key: 'comments', label: 'Comments', render: (q) => <span className="text-gray-500">{q.comments}</span> },
        ]}
        rows={rows}
        searchKeys={['inspector', 'comments']}
        searchPlaceholder="Search inspector or comments…"
        filters={
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All statuses"
            options={['PENDING', 'APPROVED', 'REJECTED', 'QUARANTINED'].map((s) => ({ value: s, label: prettyLabel(s) }))}
          />
        }
        pageSize={8}
      />

      <QcModal
        modal={modal}
        onClose={() => setModal(null)}
        batches={completedBatches}
        onSubmit={(data) => {
          run(() => addQualityCheck({ ...data, batch_id: modal.batch.id }), 'Quality check recorded');
          setModal(null);
        }}
      />
    </div>
  );
}

function QcModal({ modal, onClose, batches, onSubmit }) {
  const [form, setForm] = useState({
    inspection_date: new Date().toISOString().slice(0, 10),
    status: 'APPROVED',
    grade: 'A',
    accepted_qty: '',
    rejected_qty: '',
    comments: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!modal) return null;
  return (
    <Modal open={!!modal} onClose={onClose} title={`Inspect batch ${modal.batch?.batch_number ?? ''}`}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
        {batches.length > 1 && (
          <Select label="Batch" value={modal.batch.id} disabled>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.batch_number}</option>)}
          </Select>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Inspection date" type="date" value={form.inspection_date} onChange={set('inspection_date')} required />
          <Select label="Quality status" value={form.status} onChange={set('status')}>
            {['APPROVED', 'REJECTED', 'QUARANTINED'].map((s) => <option key={s} value={s}>{prettyLabel(s)}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Grade" value={form.grade} onChange={set('grade')}>
            {['A', 'B', 'C'].map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
          <Input label="Accepted (kg)" type="number" min="0" value={form.accepted_qty} onChange={set('accepted_qty')} required />
          <Input label="Rejected (kg)" type="number" min="0" value={form.rejected_qty} onChange={set('rejected_qty')} />
        </div>
        <Textarea label="Comments" value={form.comments} onChange={set('comments')} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Record check</Button>
        </div>
      </form>
    </Modal>
  );
}
