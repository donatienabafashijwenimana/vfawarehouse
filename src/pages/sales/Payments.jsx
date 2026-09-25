import { useState } from 'react';
import { CreditCard, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Select, Input, StatusBadge } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader, KPICard } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { formatDate, formatRWF } from '../../lib/format';
import { PAYMENT_METHODS } from '../../store/slices/salesSlice';
import { usePermissions } from '../../hooks/usePermissions';

export default function Payments() {
  const store = useStore();
  const isCustomer = store.profile?.role === 'customer';
  const myCustomerId = store.profile?.customer_id;
  const run = useAction();
  const { can } = usePermissions();
  const canConfirmRequests = can('payments.update');

  const [payModal, setPayModal] = useState(null); // sale being paid
  const [requestSale, setRequestSale] = useState(null);
  const [methodFilter, setMethodFilter] = useState('');

  const allSales = isCustomer ? store.sales.filter((s) => s.customer_id === myCustomerId) : store.sales;
  const allPayments = isCustomer ? store.payments.filter((payment) => {
    if (payment.customer_id === myCustomerId) return true;
    const saleCustomerId = store.sales.find((sale) => sale.id === payment.sale_id)?.customer_id;
    const orderCustomerId = store.orders.find((order) => order.id === payment.order_id)?.customer_id;
    return saleCustomerId === myCustomerId || orderCustomerId === myCustomerId;
  }) : store.payments;

  const outstandingSales = allSales.filter((s) => (s.total - (s.paid_amount ?? 0)) > 0);
  const pendingRequests = store.payments.filter((payment) => payment.status === 'PENDING');
  const rows = methodFilter ? allPayments.filter((p) => p.method === methodFilter) : allPayments;

  const totals = {
    received: allPayments.filter((payment) => !['PENDING', 'REJECTED'].includes(payment.status)).reduce((s, p) => s + (Number(p.amount) || 0), 0),
    outstanding: allSales.reduce((s, x) => s + Math.max(0, (Number(x.total) || 0) - (Number(x.paid_amount) || 0)), 0),
  };

  const customerName = (id) => store.customers.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCustomer ? 'My Payments' : 'Payment Management'}
        subtitle={isCustomer ? 'Track payments received and the balance remaining on your invoices.' : 'Record customer payments against invoices'}
      />

      {isCustomer ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KPICard icon={CreditCard} label="Confirmed Payments" value={allPayments.filter((payment) => !['PENDING', 'REJECTED'].includes(payment.status)).length} tone="blue" />
          <KPICard icon={CreditCard} label="Total Paid" value={formatRWF(totals.received)} tone="green" />
          <KPICard icon={CreditCard} label="Awaiting Confirmation" value={allPayments.filter((payment) => payment.status === 'PENDING').length} tone="amber" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <KPICard icon={CreditCard} label="Total Received" value={formatRWF(totals.received)} tone="green" />
          <KPICard icon={CreditCard} label="Outstanding" value={formatRWF(totals.outstanding)} tone={totals.outstanding > 0 ? 'amber' : 'green'} />
          <KPICard icon={CreditCard} label="Invoices with balance" value={outstandingSales.length} tone="blue" />
        </div>
      )}

      {isCustomer && <div><h2 className="text-base font-bold text-gray-800">Payment transactions</h2><p className="mt-1 text-sm text-gray-500">Each row is a payment recorded against one of your invoices.</p></div>}
      {/* Outstanding invoices — quick pay */}
      {!isCustomer && outstandingSales.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-700">Outstanding invoices</h3>
          <div className="space-y-2">
            {outstandingSales.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-2.5">
                <div>
                  <div className="text-sm font-semibold text-gray-700">{s.invoice_number}</div>
                  <div className="text-xs text-gray-400">{customerName(s.customer_id)} · paid {formatRWF(s.paid_amount ?? 0)} of {formatRWF(s.total)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-red-500">{formatRWF(s.total - (s.paid_amount ?? 0))}</span>
                  <Button size="sm" onClick={() => setPayModal(s)}>Record payment</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCustomer && outstandingSales.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-1 font-semibold text-gray-800">Request payment confirmation</h3>
          <p className="mb-3 text-sm text-gray-500">Submit details of a payment you have made. It will count toward your balance after a manager confirms it.</p>
          <div className="space-y-2">
            {outstandingSales.map((sale) => {
              const pendingAmount = allPayments.filter((payment) => payment.sale_id === sale.id && payment.status === 'PENDING').reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
              const requestable = Math.max(0, Number(sale.total) - Number(sale.paid_amount ?? 0) - pendingAmount);
              return <div key={sale.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
                <div><div className="font-mono text-sm font-semibold text-gray-700">{sale.invoice_number}</div><div className="text-xs text-gray-500">Balance {formatRWF(Math.max(0, sale.total - (sale.paid_amount ?? 0)))}{pendingAmount ? ` · ${formatRWF(pendingAmount)} awaiting confirmation` : ''}</div></div>
                {requestable > 0 ? <Button size="sm" onClick={() => setRequestSale({ ...sale, requestable })}>Submit payment details</Button> : <span className="text-xs font-medium text-amber-700">Payment request awaiting confirmation</span>}
              </div>;
            })}
          </div>
        </div>
      )}

      {!isCustomer && canConfirmRequests && pendingRequests.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm">
          <h3 className="mb-1 font-semibold text-gray-800">Payment requests awaiting confirmation</h3>
          <p className="mb-3 text-sm text-gray-500">Confirm only after checking that the payment was received.</p>
          <div className="space-y-2">
            {pendingRequests.map((payment) => {
              const sale = store.sales.find((item) => item.id === payment.sale_id);
              return <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
                <div><div className="font-semibold text-gray-700">{customerName(payment.customer_id)} · {sale?.invoice_number ?? payment.order_number ?? 'Payment request'}</div><div className="text-xs text-gray-500">{formatRWF(payment.amount)} · {payment.method} · {formatDate(payment.payment_date)}{payment.reference ? ` · ${payment.reference}` : ''}</div>{payment.evidence && <EvidenceLink evidence={payment.evidence} label="View payment evidence" />}</div>
                <div className="flex gap-2"><Button size="sm" onClick={() => run(() => store.confirmPaymentRequest(payment.id), 'Payment confirmed')}><CheckCircle2 className="h-3.5 w-3.5" /> Confirm</Button><Button size="sm" variant="secondary" onClick={() => run(() => store.rejectPaymentRequest(payment.id), 'Payment request rejected')}><XCircle className="h-3.5 w-3.5" /> Reject</Button></div>
              </div>;
            })}
          </div>
        </div>
      )}

      <DataTable
        columns={[
          { key: 'payment_date', label: 'Date', render: (p) => <span className="text-gray-500">{formatDate(p.payment_date)}</span> },
          !isCustomer && { key: 'customer_id', label: 'Customer', render: (p) => <span className="text-gray-600">{customerName(p.customer_id)}</span> },
          { key: 'sale_id', label: 'Invoice', sortable: false, render: (p) => (
            <span className="font-mono text-gray-600">
              {store.sales.find((s) => s.id === p.sale_id)?.invoice_number ?? (p.order_number ? `Order ${p.order_number}` : '—')}
            </span>
          )},
          { key: 'amount', label: 'Amount', render: (p) => <span className="font-semibold text-green-700">{formatRWF(p.amount)}</span> },
          { key: 'method', label: 'Method' },
          { key: 'status', label: 'Confirmation', render: (p) => <StatusBadge status={p.status ?? 'CONFIRMED'} /> },
          { key: 'reference', label: 'Reference', render: (p) => <span className="text-xs text-gray-400">{p.reference || '—'}</span> },
          { key: 'evidence', label: 'Evidence', sortable: false, render: (p) => p.evidence ? <EvidenceLink evidence={p.evidence} label="View evidence" /> : <span className="text-xs text-gray-400">—</span> },
          { key: 'recorded_by', label: 'Recorded by', render: (p) => <span className="text-gray-500">{p.recorded_by}</span> },
        ].filter(Boolean)}
        rows={rows}
        searchKeys={['reference', 'recorded_by', 'method', (payment) => store.sales.find((sale) => sale.id === payment.sale_id)?.invoice_number ?? payment.order_number]}
        searchPlaceholder="Search invoice or payment reference…"
        emptyHint={isCustomer ? 'No payments recorded yet.' : 'No payments match this filter.'}
        filters={
          <FilterSelect
            value={methodFilter}
            onChange={setMethodFilter}
            placeholder="All methods"
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
          />
        }
        pageSize={8}
      />

      <PayModal
        sale={payModal}
        onClose={() => setPayModal(null)}
        onSubmit={(data) => {
          run(() => store.addPayment({
            sale_id: payModal.id,
            amount: Number(data.amount),
            method: data.method,
            reference: data.reference,
            payment_date: data.payment_date,
            evidence: data.evidence,
          }), 'Payment recorded');
          setPayModal(null);
        }}
      />
      <RequestPaymentModal
        key={requestSale?.id ?? 'request-payment-closed'}
        sale={requestSale}
        onClose={() => setRequestSale(null)}
        onSubmit={(data) => {
          run(() => store.requestPayment({ sale_id: requestSale.id, amount: Number(data.amount), method: data.method, reference: data.reference, payment_date: data.payment_date, evidence: data.evidence }), 'Payment claim submitted — awaiting manager confirmation');
          setRequestSale(null);
        }}
      />
    </div>
  );
}

function PayModal({ sale, onClose, onSubmit }) {
  const [form, setForm] = useState({
    amount: '',
    method: 'Cash',
    reference: '',
    payment_date: new Date().toISOString().slice(0, 10),
    evidence: null,
  });
  const [amountWarning, setAmountWarning] = useState(false);
  const [fileError, setFileError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!sale) return null;
  const outstanding = Math.max(0, Number(sale.total) - Number(sale.paid_amount ?? 0));
  const setAmount = (event) => {
    const value = event.target.value;
    setAmountWarning(Boolean(value) && Number(value) > outstanding);
    setForm((current) => ({ ...current, amount: value }));
  };

  return (
    <Modal open={!!sale} onClose={onClose} title={`Record payment — ${sale.invoice_number}`}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Outstanding balance: <strong className="text-red-500">{formatRWF(outstanding)}</strong>
        </div>
        <Input label="Amount (RWF)" type="number" min="1" max={outstanding} value={form.amount} onChange={setAmount} aria-invalid={amountWarning} required />
        {amountWarning && <p role="alert" className="text-sm font-medium text-red-600">Payment cannot be greater than the remaining balance of {formatRWF(outstanding)}.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Payment method" value={form.method} onChange={set('method')}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Input label="Payment date" type="date" value={form.payment_date} onChange={set('payment_date')} required />
        </div>
        <Input label="Reference (optional)" value={form.reference} onChange={set('reference')} placeholder="MOMO ref, bank slip…" />
        <label className="block text-sm font-medium text-gray-700">Payment evidence <span className="text-red-600">*</span> <span className="font-normal text-gray-400">(image or PDF, up to 5 MB)</span>
          <input className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" type="file" accept="image/*,application/pdf" required onChange={(event) => {
            const file = event.target.files?.[0];
            setFileError('');
            if (!file) return;
            if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) { setFileError('Choose an image or PDF file.'); event.target.value = ''; return; }
            if (file.size > 5 * 1024 * 1024) { setFileError('Choose a file smaller than 5 MB.'); event.target.value = ''; return; }
            const reader = new FileReader();
            reader.onload = () => setForm((current) => ({ ...current, evidence: { name: file.name, type: file.type, data: reader.result } }));
            reader.onerror = () => setFileError('The selected file could not be read.');
            reader.readAsDataURL(file);
          }} />
        </label>
        {fileError && <p role="alert" className="text-sm text-red-600">{fileError}</p>}
        {form.evidence && <p className="text-xs text-gray-500">Attached: {form.evidence.name}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!Number(form.amount) || Number(form.amount) > outstanding || !form.evidence || Boolean(fileError)}><CreditCard className="h-4 w-4" /> Record Payment</Button>
        </div>
      </form>
    </Modal>
  );
}

function RequestPaymentModal({ sale, onClose, onSubmit }) {
  const [form, setForm] = useState({ amount: '', method: 'Cash', reference: '', payment_date: new Date().toISOString().slice(0, 10), evidence: null });
  const [warning, setWarning] = useState(false);
  const [fileError, setFileError] = useState('');
  if (!sale) return null;
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setAmount = (event) => {
    const value = event.target.value;
    setWarning(Boolean(value) && Number(value) > sale.requestable);
    setForm((current) => ({ ...current, amount: value }));
  };
  return (
    <Modal open onClose={onClose} title={`Submit payment — ${sale.invoice_number}`}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="space-y-4">
        <p className="text-sm text-gray-600">Claim a payment you have already made. Attach a receipt or transaction screenshot. A manager must confirm your claim before it changes your invoice balance.</p>
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">Maximum requestable amount: <strong>{formatRWF(sale.requestable)}</strong></div>
        <Input label="Amount paid (RWF)" type="number" min="1" step="0.01" max={sale.requestable} value={form.amount} onChange={setAmount} aria-invalid={warning} required />
        {warning && <p role="alert" className="text-sm font-medium text-red-600">Request cannot exceed {formatRWF(sale.requestable)}.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Payment method" value={form.method} onChange={set('method')}>
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
          </Select>
          <Input label="Payment date" type="date" value={form.payment_date} onChange={set('payment_date')} required />
        </div>
        <Input label="Reference" value={form.reference} onChange={set('reference')} placeholder="Transaction or bank reference" required />
        <label className="block text-sm font-medium text-gray-700">Payment evidence <span className="text-red-600">*</span> <span className="font-normal text-gray-400">(image or PDF, up to 5 MB)</span>
          <input className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" type="file" accept="image/*,application/pdf" onChange={(event) => {
            const file = event.target.files?.[0];
            setFileError('');
            if (!file) return;
            if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) { setFileError('Choose an image or PDF file.'); event.target.value = ''; return; }
            if (file.size > 5 * 1024 * 1024) { setFileError('Choose a file smaller than 5 MB.'); event.target.value = ''; return; }
            const reader = new FileReader();
            reader.onload = () => setForm((current) => ({ ...current, evidence: { name: file.name, type: file.type, data: reader.result } }));
            reader.onerror = () => setFileError('The selected file could not be read.');
            reader.readAsDataURL(file);
          }} />
        </label>
        {fileError && <p role="alert" className="text-sm text-red-600">{fileError}</p>}
        {form.evidence && <p className="text-xs text-gray-500">Attached: {form.evidence.name}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!Number(form.amount) || Number(form.amount) > sale.requestable || !form.reference.trim() || !form.evidence || Boolean(fileError)}>Submit payment claim</Button>
        </div>
      </form>
    </Modal>
  );
}

function EvidenceLink({ evidence, label }) {
  const href = typeof evidence === 'string' ? evidence : evidence?.data ?? evidence?.url;
  const name = label ?? (typeof evidence === 'string' ? 'View evidence' : evidence?.name ?? 'View evidence');
  if (!href) return null;
  return <a className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800" href={href} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" />{name}</a>;
}
