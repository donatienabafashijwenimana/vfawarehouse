import { useMemo } from 'react';
import {
  Users, Package, Factory, Boxes, ShoppingCart, Wallet, TrendingUp, FileText, CreditCard, ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useStore } from '../../store/useStore';
import { KPICard, ChartCard, PageHeader } from '../../components/ui/KPICard';
import { CHART_COLORS, formatDate, formatRWF } from '../../lib/format';
import { Link } from 'react-router-dom';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function last6Months() {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const dd = new Date(d);
    dd.setMonth(d.getMonth() - i);
    out.push({ key: dd.toISOString().slice(0, 7), label: MONTHS[dd.getMonth()] });
  }
  return out;
}
export default function Dashboard() {
  const store = useStore();
  const profile = store.profile;
  const isCustomer = profile?.role === 'customer';

  const kpis = useMemo(() => {
    const inventoryQty = store.inventory.reduce((sum, i) => sum + Math.max(0, i.quantity - (i.reserved_qty ?? 0) - (i.quarantined_qty ?? 0) - (i.damaged_qty ?? 0)), 0);
    const lowStock = store.products.filter((p) => {
      const total = store.inventory.filter((i) => i.product_id === p.id).reduce((s, i) => s + Math.max(0, i.quantity - (i.reserved_qty ?? 0) - (i.quarantined_qty ?? 0) - (i.damaged_qty ?? 0)), 0);
      return (p.minimum_stock ?? 0) > 0 && total <= p.minimum_stock;
    }).length;
    return {
      users: store.users.length,
      staff: store.users.filter((u) => u.role === 'staff').length,
      customers: store.customers.length,
      products: store.products.length,
      batches: store.batches.length,
      activeBatches: store.batches.filter((b) => b.status === 'IN_PROGRESS' || b.status === 'PLANNED').length,
      inventoryQty,
      lowStock,
      salesTotal: store.sales.reduce((s, x) => s + x.total, 0),
      paidTotal: store.payments.filter((payment) => !['PENDING', 'REJECTED'].includes(payment.status)).reduce((s, p) => s + (Number(p.amount) || 0), 0),
      expensesTotal: store.expenses.reduce((s, e) => s + e.amount, 0),
      pendingOrders: store.orders.filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED').length,
      outputKg: store.batches.reduce((s, b) => s + (b.output_qty ?? 0), 0),
    };
  }, [store.users, store.customers, store.products, store.batches, store.inventory, store.sales, store.payments, store.expenses, store.orders]);

  const charts = useMemo(() => {
    const months = last6Months();
    const fmtMonth = (iso) => (typeof iso === 'string' ? iso.slice(0, 7) : '');

    const production = months.map(({ key, label }) => ({
      month: label,
      output: store.batches.filter((b) => fmtMonth(b.end_date ?? b.created_at) === key).reduce((s, b) => s + (b.output_qty ?? 0), 0),
    }));

    const salesByMonth = months.map(({ key, label }) => ({
      month: label,
      revenue: store.sales.filter((s) => fmtMonth(s.sale_date ?? s.created_at) === key).reduce((s, x) => s + x.total, 0),
      expenses: store.expenses.filter((e) => fmtMonth(e.expense_date ?? e.created_at) === key).reduce((s, e) => s + e.amount, 0),
    }));

    const byVariety = store.varieties.map((v, i) => ({
      name: v.name,
      value: store.inventory.filter((inv) => {
        const p = store.products.find((p) => p.id === inv.product_id);
        return p?.variety_id === v.id;
      }).reduce((s, inv) => s + Math.max(0, inv.quantity - (inv.reserved_qty ?? 0) - (inv.quarantined_qty ?? 0) - (inv.damaged_qty ?? 0)), 0),
      color: CHART_COLORS[i % CHART_COLORS.length],
    })).filter((d) => d.value > 0);

    const byProduct = store.products.map((p) => ({
      name: p.name.replace(' Seed', '').replace('Certified ', '').replace('Basic ', ''),
      value: store.sales.flatMap((s) => s.items).filter((it) => it.product_id === p.id).reduce((s, it) => s + it.quantity, 0),
    })).filter((d) => d.value > 0);

    const byCustomer = store.customers.map((c) => ({
      name: c.name.length > 18 ? `${c.name.slice(0, 18)}…` : c.name,
      value: store.sales.filter((s) => s.customer_id === c.id).reduce((s, x) => s + x.total, 0),
    })).filter((d) => d.value > 0);

    const quality = ['APPROVED', 'REJECTED', 'QUARANTINED', 'PENDING'].map((st, i) => ({
      name: st.charAt(0) + st.slice(1).toLowerCase(),
      value: store.batches.filter((b) => b.quality_status === st).length,
      color: [CHART_COLORS[0], '#d93025', '#8b5cf6', '#ca9b35'][i],
    })).filter((d) => d.value > 0);

    return { production, salesByMonth, byVariety, byProduct, byCustomer, quality };
  }, [store.batches, store.sales, store.expenses, store.varieties, store.products, store.inventory, store.customers]);

  if (isCustomer) return <CustomerDashboard />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${profile?.fullName?.split(' ')[0] ?? 'Manager'}`}
        subtitle="VFA production, warehouse and sales at a glance"
      />

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={Users} label="Users" value={kpis.users} sub={`${kpis.staff} staff · ${store.customers.length} customers`} tone="blue" />
        <KPICard icon={Package} label="Products" value={kpis.products} sub={`${store.varieties.length} varieties`} tone="green" />
        <KPICard icon={Factory} label="Production Batches" value={kpis.batches} sub={`${kpis.activeBatches} active · ${kpis.outputKg.toLocaleString()} kg output`} tone="purple" />
        <KPICard icon={Boxes} label="Available Stock" value={`${kpis.inventoryQty.toLocaleString()} kg`} sub={`${kpis.lowStock} low-stock products`} tone={kpis.lowStock > 0 ? 'amber' : 'green'} />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={TrendingUp} label="Total Sales" value={`${(kpis.salesTotal / 1_000_000).toFixed(2)}M RWF`} sub={`${store.sales.length} invoices`} tone="green" />
        <KPICard icon={Wallet} label="Payments Received" value={`${(kpis.paidTotal / 1_000_000).toFixed(2)}M RWF`} sub={`${(kpis.salesTotal - kpis.paidTotal).toLocaleString()} RWF outstanding`} tone="blue" />
        <KPICard icon={TrendingUp} label="Total Expenses" value={`${(kpis.expensesTotal / 1_000_000).toFixed(2)}M RWF`} tone="amber" />
        <KPICard icon={ShoppingCart} label="Pending Orders" value={kpis.pendingOrders} sub={`${store.orders.length} total`} tone={kpis.pendingOrders > 0 ? 'amber' : 'green'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Monthly Production Output" subtitle="Finished seed (kg) by month" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={charts.production}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="output" fill="#2d9e2d" radius={[4, 4, 0, 0]} name="Output (kg)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Stock by Variety" subtitle="Available inventory share">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={charts.byVariety} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={45}>
                {charts.byVariety.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue vs Expenses" subtitle="Last 6 months (RWF)">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={charts.salesByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${Number(v).toLocaleString()} RWF`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="revenue" stroke="#2d9e2d" strokeWidth={2} name="Revenue" />
              <Line type="monotone" dataKey="expenses" stroke="#ca9b35" strokeWidth={2} name="Expenses" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Quality Outcomes" subtitle="Batches by quality status">
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={charts.quality} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={45}>
                {charts.quality.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Sales by Product" subtitle="Quantity sold (kg)">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={charts.byProduct} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#4db54d" radius={[0, 4, 4, 0]} name="Sold (kg)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sales by Customer" subtitle="Total revenue (RWF)">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={charts.byCustomer} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${Number(v).toLocaleString()} RWF`} />
              <Bar dataKey="value" fill="#2d9e2d" radius={[0, 4, 4, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

/** Customer portal dashboard (spec §22): own orders, invoices, outstanding. */
function CustomerDashboard() {
  const store = useStore();
  const customerId = store.profile?.customer_id;
  const myOrders = store.orders.filter((order) => order.customer_id === customerId);
  const mySales = store.sales.filter((sale) => sale.customer_id === customerId);
  const myPayments = store.payments.filter((payment) => payment.customer_id === customerId);
  const pendingOrders = myOrders.filter((order) => ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY'].includes(order.status));
  const outstanding = mySales.reduce((sum, sale) => sum + Math.max(0, Number(sale.total) - Number(sale.paid_amount ?? 0)), 0);
  const activity = [
    ...myOrders.map((order) => ({ id: `order-${order.id}`, title: `Order ${order.order_number}`, detail: `${order.items?.length ?? 0} item line${order.items?.length === 1 ? '' : 's'} · ${order.status.toLowerCase()}`, date: order.created_at, icon: ShoppingCart, tone: 'text-blue-600 bg-blue-50' })),
    ...mySales.map((sale) => ({ id: `invoice-${sale.id}`, title: `Invoice ${sale.invoice_number}`, detail: `${formatRWF(sale.total)} · ${sale.payment_status.toLowerCase()}`, date: sale.created_at ?? sale.sale_date, icon: FileText, tone: 'text-green-700 bg-green-50' })),
    ...myPayments.map((payment) => ({ id: `payment-${payment.id}`, title: payment.status === 'PENDING' ? 'Payment awaiting confirmation' : payment.status === 'REJECTED' ? 'Payment request rejected' : 'Payment confirmed', detail: `${formatRWF(payment.amount)} · ${payment.method}`, date: payment.created_at ?? payment.payment_date, icon: CreditCard, tone: payment.status === 'PENDING' ? 'text-amber-700 bg-amber-50' : 'text-purple-700 bg-purple-50' })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-green-800 to-green-600 p-6 text-white shadow-sm sm:p-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-green-100">Customer portal</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Welcome, {store.profile?.fullName?.split(' ')[0] ?? 'Customer'}</h1>
          <p className="mt-2 text-sm text-green-50">Browse available seeds, place an order, and follow updates from order to delivery.</p>
          <Link to="/app/portal/products" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-green-800 shadow-sm transition hover:bg-green-50">Browse seeds <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link to="/app/orders" className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-green-200 hover:shadow-md">
          <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ShoppingCart className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-green-700" /></div>
          <h2 className="mt-4 font-semibold text-gray-800">Track your orders</h2>
          <p className="mt-1 text-sm text-gray-500">{pendingOrders.length ? `${pendingOrders.length} order${pendingOrders.length === 1 ? '' : 's'} awaiting completion` : 'Review your order history and delivery status'}.</p>
        </Link>
        <Link to="/app/payments" className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-green-200 hover:shadow-md">
          <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Wallet className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-green-700" /></div>
          <h2 className="mt-4 font-semibold text-gray-800">Payment balance</h2>
          <p className="mt-1 text-sm text-gray-500">{outstanding > 0 ? `${formatRWF(outstanding)} remains across your invoices` : 'You have no outstanding invoice balance'}.</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Recent activity" subtitle="Latest order, invoice, and payment updates">
          {activity.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">Your order and payment updates will appear here.</p> : (
            <div className="divide-y divide-gray-100">
              {activity.map((item) => {
                const Icon = item.icon;
                return <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-700">{item.title}</p><p className="truncate text-xs text-gray-500">{item.detail}</p></div>
                  <time className="shrink-0 text-xs text-gray-400">{formatDate(item.date)}</time>
                </div>;
              })}
            </div>
          )}
        </ChartCard>
        <ChartCard title="Your account" subtitle="Quick access to your records">
          <div className="space-y-2">
            {[
              { to: '/app/orders', label: 'My Orders', detail: `${myOrders.length} total` },
              { to: '/app/sales', label: 'My Invoices', detail: `${mySales.length} total` },
              { to: '/app/payments', label: 'My Payments', detail: `${myPayments.length} recorded` },
            ].map((item) => <Link key={item.to} to={item.to} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 transition hover:border-green-200 hover:bg-green-50/40">
              <span className="text-sm font-medium text-gray-700">{item.label}</span><span className="flex items-center gap-2 text-xs text-gray-500">{item.detail}<ArrowRight className="h-3.5 w-3.5" /></span>
            </Link>)}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
