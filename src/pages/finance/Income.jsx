import { useMemo } from 'react';
import { Wallet, TrendingUp, CreditCard, TrendingDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useStore } from '../../store/useStore';
import { PageHeader, KPICard, ChartCard } from '../../components/ui/KPICard';
import { formatRWF } from '../../lib/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Income() {
  const sales = useStore((s) => s.sales);
  const payments = useStore((s) => s.payments);
  const expenses = useStore((s) => s.expenses);

  const totals = useMemo(() => {
    const revenue = sales.reduce((s, x) => s + x.total, 0);
    const received = payments.reduce((s, p) => s + p.amount, 0);
    const outstanding = sales.reduce((s, x) => s + (x.total - (x.paid_amount ?? 0)), 0);
    const exp = expenses.reduce((s, e) => s + e.amount, 0);
    return { revenue, received, outstanding, exp, net: revenue - exp };
  }, [sales, payments, expenses]);

  const trend = useMemo(() => {
    const months = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const dd = new Date(d);
      dd.setMonth(d.getMonth() - i);
      const key = dd.toISOString().slice(0, 7);
      months.push({
        month: MONTHS[dd.getMonth()],
        revenue: sales.filter((s) => (s.sale_date ?? s.created_at ?? '').slice(0, 7) === key).reduce((s, x) => s + x.total, 0),
        expenses: expenses.filter((e) => (e.expense_date ?? e.created_at ?? '').slice(0, 7) === key).reduce((s, e) => s + e.amount, 0),
      });
    }
    return months;
  }, [sales, expenses]);

  return (
    <div className="space-y-6">
      <PageHeader title="Income" subtitle="Revenue, receivables and net income" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={TrendingUp} label="Total Sales Revenue" value={formatRWF(totals.revenue)} tone="green" />
        <KPICard icon={CreditCard} label="Payments Received" value={formatRWF(totals.received)} tone="blue" />
        <KPICard icon={Wallet} label="Outstanding Receivables" value={formatRWF(totals.outstanding)} tone="amber" />
        <KPICard icon={TrendingDown} label="Net Income" value={formatRWF(totals.net)} sub={`Expenses: ${formatRWF(totals.exp)}`} tone={totals.net >= 0 ? 'green' : 'red'} />
      </div>

      <ChartCard title="Income Trend" subtitle="Revenue vs expenses — last 6 months">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatRWF(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="revenue" stroke="#2d9e2d" fill="#b3e4b3" name="Revenue" />
            <Area type="monotone" dataKey="expenses" stroke="#ca9b35" fill="#f5e8cc" name="Expenses" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
