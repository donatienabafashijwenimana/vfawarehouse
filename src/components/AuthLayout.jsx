import logo from '../assets/logo.JPG';

const highlights = [
  { label: 'Production Batches', value: 'PB-2026' },
  { label: 'Traceable Batches', value: '100%' },
  { label: 'Warehouse Control', value: 'Real-time' },
  { label: 'Quality Assured', value: 'Certified' },
];

export function AuthCardHeader({ title, subtitle, badge }) {
  return (
    <div className="mb-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-green-100">
        <img src={logo} alt="VFA logo" className="h-9 w-9 object-contain" />
      </div>
      <h2 className="font-display text-2xl font-bold text-gray-800">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      {badge && <span className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">{badge}</span>}
    </div>
  );
}

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen" style={{ background: 'linear-gradient(135deg, #0b2c0b 0%, #1f7a1f 50%, #2d9e2d 100%)' }}>
      <aside className="hidden flex-col justify-center px-16 text-white lg:flex lg:w-1/2">
        <div className="mb-8">
          <div className="mb-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white/15 backdrop-blur">
            <img src={logo} alt="VFA logo" className="h-12 w-12 object-contain" />
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight">VFA Irish Potato Seed<br />Production &amp; Warehouse System</h1>
          <p className="mt-4 text-lg leading-relaxed text-green-200">From production and quality control to warehousing, sales and analytics — one integrated platform for VFA.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {highlights.map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-white/10 p-4 backdrop-blur">
              <div className="font-display text-2xl font-bold text-green-300">{value}</div>
              <div className="mt-1 text-sm text-green-200">{label}</div>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center p-6 sm:p-8 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white p-8 shadow-2xl">{children}</div>
          <a
            href="https://vfahub.vercel.app/"
            className="mt-5 flex w-full items-center justify-center rounded-xl border border-white/40 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            Go to VFA Hub home
          </a>
        </div>
      </main>
    </div>
  );
}
