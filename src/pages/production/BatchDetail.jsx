import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, Check, PackageCheck, ShieldCheck } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Button, StatusBadge, Input, Select, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/KPICard';
import { useAction } from '../../hooks/useAction';
import { formatNumber, formatDateTime, prettyLabel } from '../../lib/format';
import { productionEfficiency } from '../../lib/calc';

/**
 * Batch detail page — seed traceability (spec §38):
 * batch → variety → dates → stages → quality → quantity → warehouse → sales → customers.
 */
export default function BatchDetail() {
  const { id } = useParams();
  const batches = useStore((s) => s.batches);
  const products = useStore((s) => s.products);
  const varieties = useStore((s) => s.varieties);
  const seedClasses = useStore((s) => s.seedClasses);
  const warehouses = useStore((s) => s.warehouses);
  const stages = useStore((s) => s.stages);
  const qualityChecks = useStore((s) => s.qualityChecks);
  const inventory = useStore((s) => s.inventory);
  const movements = useStore((s) => s.movements);
  const sales = useStore((s) => s.sales);
  const customers = useStore((s) => s.customers);
  const users = useStore((s) => s.users);
  const startStage = useStore((s) => s.startStage);
  const completeStage = useStore((s) => s.completeStage);
  const addQualityCheck = useStore((s) => s.addQualityCheck);
  const run = useAction();

  const [qcOpen, setQcOpen] = useState(false);
  const [completing, setCompleting] = useState(null); // stage id

  const batch = batches.find((b) => b.id === id);
  if (!batch) {
    return (
      <div className="space-y-4">
        <Link to="/app/production" className="inline-flex items-center gap-2 text-sm text-green-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to batches
        </Link>
        <p className="text-gray-500">Batch not found.</p>
      </div>
    );
  }

  const product = products.find((p) => p.id === batch.product_id);
  const variety = varieties.find((v) => v.id === batch.variety_id);
  const seedClass = seedClasses.find((c) => c.id === batch.seed_class_id);
  const creator = users.find((u) => u.id === batch.created_by);
  const batchStages = stages.filter((st) => st.batch_id === batch.id).sort((a, b) => a.sequence - b.sequence);
  const batchQCs = qualityChecks.filter((q) => q.batch_id === batch.id);
  const batchInv = inventory.filter((i) => i.batch_id === batch.id);
  const batchMovs = movements.filter((m) => m.reference_id === batch.id || m.batch_id === batch.id);
  const salesWithBatch = sales.filter((s) => s.items.some((it) => it.batch_id === batch.id));

  const eff = productionEfficiency(batch.input_qty, batch.output_qty);

  return (
    <div className="space-y-6">
      <Link to="/app/production" className="inline-flex items-center gap-2 text-sm text-green-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to batches
      </Link>

      <PageHeader
        title={`Batch ${batch.batch_number}`}
        subtitle={`${product?.name ?? '—'} · ${variety?.name ?? '—'} · ${seedClass?.name ?? '—'}`}
        actions={<><StatusBadge status={batch.status} /><StatusBadge status={batch.quality_status} /></>}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-400">Input</div>
          <div className="mt-1 text-xl font-bold text-gray-800">{formatNumber(batch.input_qty)} kg</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-400">Output</div>
          <div className="mt-1 text-xl font-bold text-green-700">{formatNumber(batch.output_qty)} kg</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-400">Rejected</div>
          <div className="mt-1 text-xl font-bold text-red-500">{formatNumber(batch.rejected_qty)} kg</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-400">Efficiency</div>
          <div className={`mt-1 text-xl font-bold ${eff >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>{eff > 0 ? `${eff}%` : '—'}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-400">Created by</div>
          <div className="mt-1 text-sm font-semibold text-gray-700">{creator?.fullName ?? '—'}</div>
          <div className="text-xs text-gray-400">{formatDateTime(batch.created_at)}</div>
        </div>
      </div>

      {/* Stage pipeline */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-700">Production stages</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {batchStages.map((st) => (
            <div key={st.id} className={`rounded-xl border p-4 ${st.status === 'COMPLETED' ? 'border-green-100 bg-green-50/60' : st.status === 'IN_PROGRESS' ? 'border-yellow-200 bg-yellow-50/60' : 'border-gray-100 bg-gray-50/50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{st.sequence}. {st.name}</span>
                <StatusBadge status={st.status} />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {st.started_at ? `Started ${formatDateTime(st.started_at)}` : 'Not started'}
                {st.completed_at && ` · Finished ${formatDateTime(st.completed_at)}`}
              </div>
              {st.notes && <p className="mt-1 text-xs text-gray-500">{st.notes}</p>}
              {st.status === 'PENDING' && batch.status === 'IN_PROGRESS' && (
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => run(() => startStage(st.id), `Stage "${st.name}" started`)}>
                  <Play className="h-3 w-3" /> Start
                </Button>
              )}
              {st.status === 'IN_PROGRESS' && (
                <Button size="sm" className="mt-3" onClick={() => setCompleting(st.id)}>
                  <Check className="h-3 w-3" /> Complete
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quality checks */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Quality checks</h3>
            {batch.status === 'COMPLETED' && (
              <Button size="sm" onClick={() => setQcOpen(true)}><ShieldCheck className="h-3.5 w-3.5" /> Record check</Button>
            )}
          </div>
          {batchQCs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No quality checks recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {batchQCs.map((q) => (
                <div key={q.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">{q.inspector}</span>
                    <StatusBadge status={q.status} />
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {formatDateTime(q.inspection_date)} · Grade {q.grade} · Accepted {formatNumber(q.accepted_qty)} kg · Rejected {formatNumber(q.rejected_qty)} kg
                  </div>
                  {q.comments && <p className="mt-2 text-sm text-gray-600">{q.comments}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Whereabouts */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold text-gray-700">Warehouse location &amp; stock</h3>
            {batchInv.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No stock from this batch in any warehouse.</p>
            ) : (
              <div className="space-y-2">
                {batchInv.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-gray-700">{warehouses.find((w) => w.id === inv.warehouse_id)?.name ?? '—'}</div>
                      <div className="text-xs text-gray-400">
                        Reserved {inv.reserved_qty ?? 0} · Quarantined {inv.quarantined_qty ?? 0} · Damaged {inv.damaged_qty ?? 0}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-gray-700">{formatNumber(inv.quantity)} kg</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold text-gray-700">Sales &amp; customers who received this batch</h3>
            {salesWithBatch.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">Not yet sold from this batch.</p>
            ) : (
              <div className="space-y-2">
                {salesWithBatch.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-2.5">
                    <div>
                      <div className="text-sm font-semibold text-gray-700">{s.invoice_number}</div>
                      <div className="text-xs text-gray-400">{customers.find((c) => c.id === s.customer_id)?.name ?? '—'}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {s.items.filter((it) => it.batch_id === batch.id).reduce((sum, it) => sum + it.quantity, 0)} kg
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Movement history */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-700">Movement history for this batch</h3>
        {batchMovs.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">No stock movements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Qty (kg)</th>
                  <th className="px-3 py-2">Warehouse</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">By</th>
                </tr>
              </thead>
              <tbody>
                {batchMovs.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2 text-gray-500">{formatDateTime(m.created_at)}</td>
                    <td className="px-3 py-2"><StatusBadge status={m.movement_type} /></td>
                    <td className="px-3 py-2 font-semibold text-gray-700">{formatNumber(m.quantity)}</td>
                    <td className="px-3 py-2 text-gray-600">{warehouses.find((w) => w.id === m.warehouse_id)?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{m.notes}</td>
                    <td className="px-3 py-2 text-gray-500">{m.created_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Complete stage modal */}
      <CompleteStageModal
        stage={batchStages.find((st) => st.id === completing)}
        onClose={() => setCompleting(null)}
        onConfirm={(notes) => { run(() => completeStage(completing, notes), 'Stage completed'); setCompleting(null); }}
      />

      {/* Quality check modal */}
      <QcModal
        open={qcOpen}
        onClose={() => setQcOpen(false)}
        batch={batch}
        onSubmit={(data) => { run(() => addQualityCheck({ ...data, batch_id: batch.id }), 'Quality check recorded'); setQcOpen(false); }}
      />
    </div>
  );
}

function CompleteStageModal({ stage, onClose, onConfirm }) {
  const [notes, setNotes] = useState('');
  if (!stage) return null;
  return (
    <Modal open={!!stage} onClose={onClose} title={`Complete stage: ${stage.name}`}>
      <Textarea label="Stage notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations, treatments applied…" />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onConfirm(notes)}><PackageCheck className="h-4 w-4" /> Mark completed</Button>
      </div>
    </Modal>
  );
}

function QcModal({ open, onClose, batch, onSubmit }) {
  const [form, setForm] = useState({
    inspection_date: new Date().toISOString().slice(0, 10),
    status: 'APPROVED',
    grade: 'A',
    accepted_qty: '',
    rejected_qty: '',
    comments: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title={`Quality check — ${batch?.batch_number ?? ''}`}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
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
          <Button type="submit">Save check</Button>
        </div>
      </form>
    </Modal>
  );
}
