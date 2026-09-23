import { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useStore } from '../../store/useStore';
import { PageHeader, ChartCard } from '../../components/ui/KPICard';
import { CHART_COLORS, formatNumber, formatRWF } from '../../lib/format';
import { productionEfficiency } from '../../lib/calc';

const TABS = ['Production', 'Inventory', 'Sales', 'Financial'];

export default function Reports() {
  const [tab, setTab] = useState('Production');
  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" subtitle="Production, inventory, sales and financial reporting (spec §26)" />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${tab === t ? 'bg-green-700 text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Production' && <ProductionReport />}
      {tab === 'Inventory' && <InventoryReport />}
      {tab === 'Sales' && <SalesReport />}
      {tab === 'Financial' && <FinancialReport />}
    </div>
  );
}

function useMonths(n = 6) {
  return useMemo(() => {
    const out = [];
    const d = new Date();
    d.setDate(1);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = n - 1; i >= 0; i--) {
      const dd = new Date(d);
      dd.setMonth(d.getMonth() - i);
      out.push({ key: dd.toISOString().slice(0, 7), label: MONTHS[dd.getMonth()] });
    }
    return out;
  }, [n]);
}

/* ---------------- Production ---------------- */
function ProductionReport() {
  const batches = useStore((s) => s.batches);
  const varieties = useStore((s) => s.varieties);
  const seedClasses = useStore((s) => s.seedClasses);
  const months = useMonths();

  const byVariety = varieties.map((v, i) => ({
    name: v.name,
    input: batches.filter((b) => b.variety_id === v.id).reduce((s, b) => s + b.input_qty, 0),
    output: batches.filter((b) => b.variety_id === v.id).reduce((s, b) => s + (b.output_qty ?? 0), 0),
    rejected: batches.filter((b) => b.variety_id === v.id).reduce((s, b) => s + (b.rejected_qty ?? 0), 0),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const byClass = seedClasses.map((c) => {
    const bs = batches.filter((b) => b.seed_class_id === c.id);
    const input = bs.reduce((s, b) => s + b.input_qty, 0);
    const output = bs.reduce((s, b) => s + (b.output_qty ?? 0), 0);
    return { name: c.name, input, output, efficiency: productionEfficiency(input, output) };
  });

  const monthly = months.map(({ key, label }) => ({
    month: label,
    output: batches.filter((b) => (b.end_date ?? b.created_at ?? '').slice(0, 7) === key).reduce((s, b) => s + (b.output_qty ?? 0), 0),
    rejected: batches.filter((b) => (b.end_date ?? b.created_at ?? '').slice(0, 7) === key).reduce((s, b) => s + (b.rejected_qty ?? 0), 0),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Production by Variety" subtitle="Input vs output (kg)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byVariety}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="input" fill="#b3e4b3" name="Input (kg)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="output" fill="#2d9e2d" name="Output (kg)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rejected" fill="#ca9b35" name="Rejected (kg)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Output vs Rejected" subtitle="Last 6 months (kg)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="output" stroke="#2d9e2d" strokeWidth={2} name="Output" />
              <Line type="monotone" dataKey="rejected" stroke="#ca9b35" strokeWidth={2} name="Rejected" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Efficiency by Variety" subtitle="Output / input × 100">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byVariety.map((v) => ({ name: v.name, efficiency: productionEfficiency(v.input, v.output) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis unit="%" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="efficiency" fill="#4db54d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-700">By seed class</h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
                <th className="py-2">Class</th>
                <th className="py-2">Input (kg)</th>
                <th className="py-2">Output (kg)</th>
                <th className="py-2">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {byClass.map((c) => (
                <tr key={c.name} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 font-medium text-gray-700">{c.name}</td>
                  <td className="py-2.5 text-gray-600">{formatNumber(c.input)}</td>
                  <td className="py-2.5 text-gray-600">{formatNumber(c.output)}</td>
                  <td className="py-2.5 font-semibold text-green-700">{c.efficiency}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Inventory ---------------- */
function InventoryReport() {
  const inventory = useStore((s) => s.inventory);
  const products = useStore((s) => s.products);
  const varieties = useStore((s) => s.varieties);
  const warehouses = useStore((s) => s.warehouses);

  const avail = (i) => Math.max(0, i.quantity - (i.reserved_qty ?? 0) - (i.quarantined_qty ?? 0) - (i.damaged_qty ?? 0));
  const totalBy = (keyFn) => {
    const map = new Map();
    inventory.forEach((i) => {
      const k = keyFn(i);
      map.set(k, (map.get(k) ?? 0) + avail(i));
    });
    return map;
  };

  const byVariety = Array.from(totalBy((i) => varieties.find((v) => v.id === products.find((p) => p.id === i.product_id)?.variety_id)?.name ?? '—').entries())
    .map(([name, value], idx) => ({ name, value, color: CHART_COLORS[idx % CHART_COLORS.length] }))
    .filter((d) => d.value > 0);

  const byWarehouse = warehouses.map((w, idx) => ({
    name: w.name.replace(/^(Main|Cold Store) /, ''),
    value: inventory.filter((i) => i.warehouse_id === w.id).reduce((s, i) => s + avail(i), 0),
    color: CHART_COLORS[idx % CHART_COLORS.length],
  })).filter((d) => d.value > 0);

  const lowStock = products.filter((p) => {
    const total = inventory.filter((i) => i.product_id === p.id).reduce((s, i) => s + avail(i), 0);
    return (p.minimum_stock ?? 0) > 0 && total <= p.minimum_stock;
  });

  const reservedTotal = inventory.reduce((s, i) => s + (i.reserved_qty ?? 0), 0);
  const quarantinedTotal = inventory.reduce((s, i) => s + (i.quarantined_qty ?? 0), 0);
  const damagedTotal = inventory.reduce((s, i) => s + (i.damaged_qty ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Stock by Variety" subtitle="Available kg">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={byVariety} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={48}>
                {byVariety.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => `${formatNumber(v)} kg`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Stock by Warehouse" subtitle="Available kg">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byWarehouse}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${formatNumber(v)} kg`} />
              <Bar dataKey="value" fill="#2d9e2d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: 'Reserved stock', value: `${formatNumber(reservedTotal)} kg` },
          { label: 'Quarantined stock', value: `${formatNumber(quarantinedTotal)} kg` },
          { label: 'Damaged stock', value: `${formatNumber(damagedTotal)} kg` },
        ].map((x) => (
          <div key={x.label} className="rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm">
            <div className="text-xs text-gray-400">{x.label}</div>
            <div className="mt-1 text-xl font-bold text-gray-800">{x.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-700">Low stock alerts</h3>
        {lowStock.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">All products above minimum stock.</p>
        ) : (
          <div className="space-y-2">
            {lowStock.map((p) => {
              const total = inventory.filter((i) => i.product_id === p.id).reduce((s, i) => s + avail(i), 0);
              return (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-yellow-100 bg-yellow-50/60 px-4 py-2.5">
                  <span className="text-sm font-medium text-gray-700">{p.name}</span>
                  <span className="text-sm font-bold text-yellow-700">{formatNumber(total)} / min {formatNumber(p.minimum_stock)} kg</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Sales ---------------- */
function SalesReport() {
  const sales = useStore((s) => s.sales);
  const products = useStore((s) => s.products);
  const customers = useStore((s) => s.customers);
  const users = useStore((s) => s.users);
  const months = useMonths();

  const daily = useMemo(() => {
    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      last14.push({
        day: `${d.getDate()}/${d.getMonth() + 1}`,
        revenue: sales.filter((s) => s.sale_date === key).reduce((sum, s) => sum + s.total, 0),
      });
    }
    return last14;
  }, [sales]);

  const monthly = months.map(({ key, label }) => ({
    month: label,
    revenue: sales.filter((s) => (s.sale_date ?? '').slice(0, 7) === key).reduce((s, x) => s + x.total, 0),
  }));

  const byProduct = products.map((p) => ({
    name: p.name.replace(' Seed', ''),
    value: sales.flatMap((s) => s.items).filter((it) => it.product_id === p.id).reduce((s, it) => s + it.quantity * (it.unit_price ?? 0), 0),
  })).filter((d) => d.value > 0);

  const byCustomer = customers.map((c) => ({
    name: c.name.length > 20 ? `${c.name.slice(0, 20)}…` : c.name,
    value: sales.filter((s) => s.customer_id === c.id).reduce((s, x) => s + x.total, 0),
  })).filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Daily Sales — Last 14 days" subtitle="Revenue (RWF)">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatRWF(v)} />
              <Bar dataKey="revenue" fill="#2d9e2d" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Sales" subtitle="Revenue by month (RWF)">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatRWF(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#2d9e2d" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Sales by Product" subtitle="Revenue (RWF)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byProduct} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatRWF(v)} />
              <Bar dataKey="value" fill="#4db54d" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sales by Customer" subtitle="Revenue (RWF)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byCustomer} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatRWF(v)} />
              <Bar dataKey="value" fill="#2d9e2d" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Sales by staff table */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-700">Sales by staff member</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
              <th className="py-2">Staff</th>
              <th className="py-2">Invoices</th>
              <th className="py-2">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {users.filter((u) => u.role !== 'customer').map((u) => {
              const us = sales.filter((s) => s.created_by === u.fullName);
              if (!us.length) return null;
              return (
                <tr key={u.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 font-medium text-gray-700">{u.fullName}</td>
                  <td className="py-2.5 text-gray-600">{us.length}</td>
                  <td className="py-2.5 font-semibold text-green-700">{formatRWF(us.reduce((s, x) => s + x.total, 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Financial ---------------- */
function FinancialReport() {
  const sales = useStore((s) => s.sales);
  const payments = useStore((s) => s.payments);
  const expenses = useStore((s) => s.expenses);
  const months = useMonths();

  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const received = payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = revenue - received;
  const exp = expenses.reduce((s, e) => s + e.amount, 0);
  const net = revenue - exp;

  const monthly = months.map(({ key, label }) => ({
    month: label,
    revenue: sales.filter((s) => (s.sale_date ?? '').slice(0, 7) === key).reduce((s, x) => s + x.total, 0),
    expenses: expenses.filter((e) => (e.expense_date ?? '').slice(0, 7) === key).reduce((s, e) => s + e.amount, 0),
    net: sales.filter((s) => (s.sale_date ?? '').slice(0, 7) === key).reduce((s, x) => s + x.total, 0)
      - expenses.filter((e) => (e.expense_date ?? '').slice(0, 7) === key).reduce((s, e) => s + e.amount, 0),
  }));

  const byCategory = {};
  expenses.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  });
  const expenseData = Object.entries(byCategory).map(([name, value], i) => ({
    name, value, color: CHART_COLORS[(i + 4) % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: 'Revenue', value: formatRWF(revenue) },
          { label: 'Payments received', value: formatRWF(received) },
          { label: 'Outstanding', value: formatRWF(outstanding) },
          { label: 'Expenses', value: formatRWF(exp) },
          { label: 'Net income', value: formatRWF(net) },
        ].map((x) => (
          <div key={x.label} className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
            <div className="text-xs text-gray-400">{x.label}</div>
            <div className={`mt-1 text-base font-bold ${x.label === 'Net income' ? (net >= 0 ? 'text-green-700' : 'text-red-600') : 'text-gray-800'}`}>{x.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue vs Expenses" subtitle="Monthly (RWF)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatRWF(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="revenue" stroke="#2d9e2d" strokeWidth={2} name="Revenue" />
              <Line type="monotone" dataKey="expenses" stroke="#ca9b35" strokeWidth={2} name="Expenses" />
              <Line type="monotone" dataKey="net" stroke="#0a6de0" strokeWidth={2} name="Net" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Expenses by Category" subtitle="All time (RWF)">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={expenseData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={48}>
                {expenseData.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => formatRWF(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
