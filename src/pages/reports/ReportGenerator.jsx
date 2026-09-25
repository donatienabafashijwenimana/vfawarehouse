import { useMemo, useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PageHeader } from '../../components/ui/KPICard';
import { Button, Select, Input } from '../../components/ui/primitives';
import { formatDate, formatNumber, formatRWF, prettyLabel } from '../../lib/format';

const REPORTS = ['Sales', 'Payments', 'Production', 'Inventory', 'Financial'];
const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

export default function Reports() {
  const data = useStore();
  const [draft, setDraft] = useState({ report: 'Sales', from: monthStart, to: today, customer: '', product: '', warehouse: '', status: '' });
  const [generated, setGenerated] = useState(null);
  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));
  const hasDateRange = ['Sales', 'Payments', 'Production', 'Financial'].includes(draft.report);
  const hasCustomer = ['Sales', 'Payments', 'Financial'].includes(draft.report);
  const hasProduct = ['Sales', 'Production', 'Inventory'].includes(draft.report);
  const hasWarehouse = draft.report === 'Inventory';
  const hasStatus = ['Sales', 'Payments', 'Production'].includes(draft.report);
  const dateError = hasDateRange && (!draft.from || !draft.to || draft.from > draft.to);

  const report = useMemo(() => generated ? buildReport(data, generated) : null, [data, generated]);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader title="Reports & Analytics" subtitle="Generate detailed reports for a selected period, review the tables, then print or save as PDF." />
      </div>

      <section className="no-print rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-800"><FileText className="h-4 w-4 text-green-700" /> Report setup</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Report" value={draft.report} onChange={(event) => setDraft((current) => ({ ...current, report: event.target.value, customer: '', product: '', warehouse: '', status: '' }))}>
            {REPORTS.map((item) => <option key={item}>{item}</option>)}
          </Select>
          {hasDateRange && <>
            <Input label="From" type="date" value={draft.from} onChange={set('from')} required />
            <Input label="To" type="date" value={draft.to} onChange={set('to')} required />
          </>}
          {hasCustomer && <Select label="Customer" value={draft.customer} onChange={set('customer')}><option value="">All customers</option>{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</Select>}
          {hasProduct && <Select label="Product" value={draft.product} onChange={set('product')}><option value="">All products</option>{data.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</Select>}
          {hasWarehouse && <Select label="Warehouse" value={draft.warehouse} onChange={set('warehouse')}><option value="">All warehouses</option>{data.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</Select>}
          {hasStatus && <Select label="Status" value={draft.status} onChange={set('status')}><option value="">All statuses</option>{(draft.report === 'Sales' ? ['PAID', 'PARTIAL', 'UNPAID'] : draft.report === 'Payments' ? ['PENDING', 'CONFIRMED', 'REJECTED'] : ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).map((status) => <option key={status} value={status}>{prettyLabel(status)}</option>)}</Select>}
        </div>
        {dateError && <p role="alert" className="mt-3 text-sm text-red-600">Enter a valid date range with the start date on or before the end date.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={Boolean(dateError)} onClick={() => setGenerated({ ...draft })}><FileText className="h-4 w-4" /> Generate report</Button>
          {report && <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save PDF</Button>}
        </div>
      </section>

      {!report ? null : (
        <main className="report-print space-y-5 rounded-2xl bg-white p-6 print:p-0">
          <header className="border-b border-gray-200 pb-4">
            <h1 className="text-2xl font-bold text-gray-900">VFA {generated.report} Report</h1>
            <p className="mt-1 text-sm text-gray-600">{hasDateRange ? `${formatDate(generated.from)} – ${formatDate(generated.to)}` : `Inventory snapshot generated ${formatDate(today)}`}</p>
            <p className="mt-1 text-xs text-gray-500">Generated {new Date().toLocaleString()} · {report.rows.length} records</p>
          </header>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:grid-cols-4">
            {report.summary.map((item) => <div key={item.label} className="rounded-xl border border-gray-200 p-3"><div className="text-xs text-gray-500">{item.label}</div><div className="mt-1 text-lg font-bold text-gray-800">{item.value}</div></div>)}
          </div>
          {report.sections.map((section) => <ReportTable key={section.title} section={section} />)}
          {report.rows.length === 0 && <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">No records match these conditions.</p>}
          <footer className="border-t border-gray-200 pt-3 text-xs text-gray-400">VFA Warehouse Management · {generated.report} report</footer>
        </main>
      )}
    </div>
  );
}

function buildReport(data, filter) {
  const inRange = (value) => {
    const date = String(value ?? '').slice(0, 10);
    return date && date >= filter.from && date <= filter.to;
  };
  const customerName = (id) => data.customers.find((item) => item.id === id)?.name ?? '—';
  const productName = (id) => data.products.find((item) => item.id === id)?.name ?? '—';
  const saleItems = (sale) => sale.items ?? [];
  const sales = data.sales.filter((sale) => inRange(sale.sale_date)
    && (!filter.customer || sale.customer_id === filter.customer)
    && (!filter.status || (sale.payment_status ?? 'UNPAID') === filter.status)
    && (!filter.product || saleItems(sale).some((item) => item.product_id === filter.product)));
  const saleIds = new Set(sales.map((sale) => sale.id));
  const payments = data.payments.filter((payment) => inRange(payment.payment_date)
    && (!filter.customer || payment.customer_id === filter.customer)
    && (!filter.status || (payment.status ?? 'CONFIRMED') === filter.status)
    && (filter.report !== 'Financial' || !payment.sale_id || saleIds.has(payment.sale_id)));
  const batches = data.batches.filter((batch) => inRange(batch.end_date ?? batch.start_date ?? batch.created_at)
    && (!filter.status || batch.status === filter.status)
    && (!filter.product || batch.product_id === filter.product));
  const expenses = data.expenses.filter((expense) => inRange(expense.expense_date));
  const inventory = data.inventory.filter((item) => (!filter.product || item.product_id === filter.product)
    && (!filter.warehouse || item.warehouse_id === filter.warehouse));
  const stockRows = inventory.map((item) => ({
    Product: productName(item.product_id),
    Warehouse: data.warehouses.find((warehouse) => warehouse.id === item.warehouse_id)?.name ?? '—',
    'On hand': formatNumber(item.quantity), Reserved: formatNumber(item.reserved_qty ?? 0),
    Quarantined: formatNumber(item.quarantined_qty ?? 0), Damaged: formatNumber(item.damaged_qty ?? 0),
    Available: formatNumber(Math.max(0, item.quantity - (item.reserved_qty ?? 0) - (item.quarantined_qty ?? 0) - (item.damaged_qty ?? 0))),
  }));
  const saleRows = sales.map((sale) => ({
    Date: formatDate(sale.sale_date), Invoice: sale.invoice_number, Customer: customerName(sale.customer_id),
    Total: formatRWF(sale.total), Paid: formatRWF(sale.paid_amount ?? 0),
    Balance: formatRWF(Math.max(0, sale.total - (sale.paid_amount ?? 0))), Status: prettyLabel(sale.payment_status ?? 'UNPAID'),
  }));
  const paymentRows = payments.map((payment) => ({
    Date: formatDate(payment.payment_date), Invoice: data.sales.find((sale) => sale.id === payment.sale_id)?.invoice_number ?? payment.order_number ?? '—',
    Customer: customerName(payment.customer_id), Method: payment.method, Reference: payment.reference || '—',
    Amount: formatRWF(payment.amount), Status: prettyLabel(payment.status ?? 'CONFIRMED'),
  }));
  const productionRows = batches.map((batch) => ({
    Batch: batch.batch_number, Product: productName(batch.product_id),
    Variety: data.varieties.find((item) => item.id === batch.variety_id)?.name ?? '—',
    'Seed class': data.seedClasses.find((item) => item.id === batch.seed_class_id)?.name ?? '—',
    Date: formatDate(batch.end_date ?? batch.start_date ?? batch.created_at), Status: prettyLabel(batch.status),
    'Input (kg)': formatNumber(batch.input_qty), 'Output (kg)': formatNumber(batch.output_qty ?? 0), 'Rejected (kg)': formatNumber(batch.rejected_qty ?? 0),
  }));
  const expenseRows = expenses.map((expense) => ({ Date: formatDate(expense.expense_date), Category: expense.category, Description: expense.description, Amount: formatRWF(expense.amount), Method: expense.payment_method ?? '—' }));
  const itemTotals = new Map();
  sales.flatMap(saleItems).filter((item) => !filter.product || item.product_id === filter.product).forEach((item) => {
    const entry = itemTotals.get(item.product_id) ?? { product: productName(item.product_id), quantity: 0, total: 0 };
    entry.quantity += Number(item.quantity) || 0;
    entry.total += (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
    itemTotals.set(item.product_id, entry);
  });
  const productRows = [...itemTotals.values()].map((item) => ({ Product: item.product, Quantity: formatNumber(item.quantity), Revenue: formatRWF(item.total) }));
  const customerTotals = new Map();
  sales.forEach((sale) => customerTotals.set(sale.customer_id, (customerTotals.get(sale.customer_id) ?? 0) + Number(sale.total || 0)));
  const customerRows = [...customerTotals].map(([id, total]) => ({ Customer: customerName(id), Invoices: sales.filter((sale) => sale.customer_id === id).length, Revenue: formatRWF(total) }));
  const totals = {
    sales: sales.reduce((sum, item) => sum + Number(item.total || 0), 0),
    received: payments.filter((item) => !['PENDING', 'REJECTED'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    expenses: expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    output: batches.reduce((sum, item) => sum + Number(item.output_qty || 0), 0),
    stock: inventory.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0) - Number(item.reserved_qty || 0) - Number(item.quarantined_qty || 0) - Number(item.damaged_qty || 0)), 0),
  };
  const reportMap = {
    Sales: {
      rows: saleRows,
      summary: [{ label: 'Invoices', value: sales.length }, { label: 'Sales value', value: formatRWF(totals.sales) }, { label: 'Paid', value: formatRWF(sales.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0)) }, { label: 'Balance due', value: formatRWF(sales.reduce((sum, item) => sum + Math.max(0, item.total - (item.paid_amount || 0)), 0)) }],
      sections: [{ title: 'Invoice detail', rows: saleRows }, { title: 'Sales by product', rows: productRows }, { title: 'Sales by customer', rows: customerRows }],
    },
    Payments: {
      rows: paymentRows,
      summary: [{ label: 'Transactions', value: payments.length }, { label: 'Confirmed', value: formatRWF(totals.received) }, { label: 'Pending claims', value: payments.filter((item) => item.status === 'PENDING').length }, { label: 'Rejected claims', value: payments.filter((item) => item.status === 'REJECTED').length }],
      sections: [{ title: 'Payment transactions', rows: paymentRows }],
    },
    Production: {
      rows: productionRows,
      summary: [{ label: 'Batches', value: batches.length }, { label: 'Input (kg)', value: formatNumber(batches.reduce((sum, item) => sum + Number(item.input_qty || 0), 0)) }, { label: 'Output (kg)', value: formatNumber(totals.output) }, { label: 'Rejected (kg)', value: formatNumber(batches.reduce((sum, item) => sum + Number(item.rejected_qty || 0), 0)) }],
      sections: [{ title: 'Production batches', rows: productionRows }],
    },
    Inventory: {
      rows: stockRows,
      summary: [{ label: 'Stock records', value: inventory.length }, { label: 'Available stock (kg)', value: formatNumber(totals.stock) }, { label: 'Reserved (kg)', value: formatNumber(inventory.reduce((sum, item) => sum + Number(item.reserved_qty || 0), 0)) }, { label: 'Quarantined (kg)', value: formatNumber(inventory.reduce((sum, item) => sum + Number(item.quarantined_qty || 0), 0)) }],
      sections: [{ title: 'Current stock by product and warehouse', rows: stockRows }],
    },
    Financial: {
      rows: [...saleRows, ...paymentRows, ...expenseRows],
      summary: [{ label: 'Sales revenue', value: formatRWF(totals.sales) }, { label: 'Payments received', value: formatRWF(totals.received) }, { label: 'Expenses', value: formatRWF(totals.expenses) }, { label: 'Net (sales − expenses)', value: formatRWF(totals.sales - totals.expenses) }],
      sections: [{ title: 'Sales invoices', rows: saleRows }, { title: 'Payments received', rows: paymentRows }, { title: 'Expenses', rows: expenseRows }],
    },
  };
  return reportMap[filter.report];
}

function ReportTable({ section }) {
  if (!section.rows.length) return null;
  const columns = Object.keys(section.rows[0]);
  return <section className="overflow-hidden rounded-xl border border-gray-200">
    <h2 className="bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800">{section.title} <span className="font-normal text-gray-500">({section.rows.length})</span></h2>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead><tr className="border-y border-gray-200 text-[10px] uppercase tracking-wide text-gray-500">{columns.map((column) => <th key={column} className="px-3 py-2">{column}</th>)}</tr></thead>
        <tbody>{section.rows.map((row, index) => <tr key={`${section.title}-${index}`} className="border-b border-gray-100 last:border-0">{columns.map((column) => <td key={column} className="whitespace-nowrap px-3 py-2 text-gray-700">{row[column]}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </section>;
}
