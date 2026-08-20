import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BrainCircuit,
  CloudSun,
  GraduationCap,
  Leaf,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Navigation,
  Smartphone,
  Sprout,
  Users,
} from 'lucide-react';

import logo from '../assets/logo.JPG';


function TabButton({ active, onClick, children }) {

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all border ${
        active
          ? 'bg-green-700 text-white border-green-700 shadow-sm'
          : 'bg-white/80 text-green-800 border-green-100 hover:bg-white'
      }`}
    >
      {children}
    </button>
  );
}

const FEATURE_HIGHLIGHTS = [
  { title: 'Greenhouse Seed Production', icon: Sprout },
  { title: 'Smart Weather Dashboard', icon: CloudSun },
  { title: 'AI Powered Recommendations', icon: BrainCircuit },
  { title: 'Farm Management System', icon: Smartphone },
  { title: 'Training & Youth Empowerment', icon: Users },
];

const ABOUT_SERVICES = [
  {
    title: 'Seed Production',
    desc: 'Track greenhouse propagation, seed classes, certification status, and batch performance from nursery to delivery.',
    icon: Sprout,
  },
  {
    title: 'Farm Advisory',
    desc: 'Turn weather, field records, and crop observations into practical guidance for growers and field officers.',
    icon: BrainCircuit,
  },
  {
    title: 'Business Operations',
    desc: 'Manage inventory, customer sales, payments, reporting, and alerts in one operational workspace.',
    icon: Smartphone,
  },
  {
    title: 'Training Programs',
    desc: 'Support youth and farmer capacity building with digital records, follow-up, and measurable outcomes.',
    icon: GraduationCap,
  },
];

export default function Welcome() {
  const [tab, setTab] = useState('home');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-950 via-green-800 to-emerald-600">
      {/* Header / Tabs */}
      <header className="sticky top-0 z-20 bg-green-950/75 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white shadow-lg overflow-hidden">
              <img src={logo} alt="VFA logo" className="w-7 h-7 object-contain" />
            </div>

            <div className="hidden sm:block">
              <div className="font-display font-bold text-white leading-tight">VFA Greenhouse</div>
              <div className="text-xs text-green-200">Seeds Hub Ltd</div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <TabButton active={tab === 'home'} onClick={() => setTab('home')}>
              Home
            </TabButton>
            <TabButton active={tab === 'about'} onClick={() => setTab('about')}>
              About Us Product &amp; Service
            </TabButton>
            <TabButton
              active={false}
              onClick={() => navigate('/login')}
            >
              Login
            </TabButton>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
          {tab === 'home' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-white/15 text-green-50 px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15">
                  <span className="w-1.5 h-1.5 bg-green-200 rounded-full" />
                  Integrated digital platform for seed production
                </div>
                <h1 className="font-display text-4xl md:text-5xl font-bold text-white mt-4 leading-tight">
                  Potato Seed Production &amp; Greenhouse Monitoring
                </h1>
                <p className="text-green-50/85 text-base md:text-lg mt-4 leading-relaxed">
                  Manage farms, crops, seed batches, inventory, sales invoices, and alerts—built for
                  real-world field operations.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  {[{ k: '120+', v: 'Registered Farms' }, { k: '340+', v: 'Seed Batches' }, { k: '450t', v: 'Tonnes Produced' }, { k: '28', v: 'Partner Coops' }].map(
                    (item) => (
                      <div key={item.v} className="bg-white/95 rounded-2xl border border-white/20 p-4 shadow-sm">
                        <div className="text-2xl font-bold text-green-950">{item.k}</div>
                        <div className="text-sm text-green-800 mt-1">{item.v}</div>
                      </div>
                    )
                  )}
                </div>

                
              </div>

              <div className="bg-white/95 backdrop-blur rounded-3xl border border-white/30 p-6 shadow-sm">
                <h2 className="font-semibold text-green-950 mb-4">What you can do</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { title: 'Farm Registry', desc: 'Register farms & locations', icon: MapPin },
                    { title: 'Crop Records', desc: 'Track crop growth and yields', icon: Leaf },
                    { title: 'Inventory', desc: 'Monitor inputs and stock', icon: MessageCircle },
                    { title: 'Analytics', desc: 'See reports and trends', icon: Navigation },
                  ].map(({ title, desc, icon: Icon }) => (
                    <div key={title} className="p-4 rounded-2xl border border-green-50 bg-white hover:bg-green-50/40 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-green-950 text-sm">{title}</div>
                          <div className="text-sm text-gray-600 mt-1">{desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'home' && (
            <section className="mt-1 border-y border-white/15 bg-white/95 backdrop-blur">
              <div className="py-8">
                <div className="flex items-center justify-center gap-2 text-green-800 font-display text-lg md:text-xl font-bold">
                  <Leaf className="w-5 h-5" />
                  <span>Smart Seeds. Smart Farming. Better Future.</span>
                  <Leaf className="w-5 h-5" />
                </div>

                <div className="mt-7 grid grid-cols-2 md:grid-cols-5 gap-y-7">
                  {FEATURE_HIGHLIGHTS.map(({ title, icon: Icon }, index) => (
                    <div
                      key={title}
                      className={`px-4 flex flex-col items-center text-center ${
                        index > 0 ? 'md:border-l md:border-green-200' : ''
                      }`}
                    >
                      <div className="w-16 h-16 rounded-full bg-green-700 text-white flex items-center justify-center shadow-sm">
                        <Icon className="w-8 h-8" />
                      </div>
                      <div className="mt-3 text-[11px] md:text-xs font-extrabold uppercase leading-tight text-green-950 max-w-28">
                        {title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === 'about' && (
            <div className="space-y-8">
              <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 items-stretch">
                <div className="bg-white/95 rounded-3xl border border-white/30 p-8 shadow-sm">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 text-green-800 text-xs font-bold">
                    <Leaf className="w-4 h-4" />
                    About VFA Greenhouse Seeds Hub Ltd
                  </div>
                  <h1 className="font-display text-3xl md:text-5xl font-bold text-green-950 mt-5 leading-tight">
                    Growing better seed systems with practical digital tools.
                  </h1>
                  <p className="text-gray-600 text-base md:text-lg mt-4 leading-relaxed">
                    We support potato seed production, greenhouse monitoring, farmer advisory, sales, and
                    reporting for teams working across farms, greenhouses, cooperatives, and customer operations.
                  </p>
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      ['Mission', 'Reliable seed production'],
                      ['Focus', 'Potato growers and greenhouses'],
                      ['Base', 'Nyamagabe, Rwanda'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-green-50 border border-green-100 p-4">
                        <div className="text-xs uppercase font-bold text-green-700">{label}</div>
                        <div className="mt-1 text-sm font-semibold text-green-950">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-green-950/70 rounded-3xl border border-white/15 p-8 text-white shadow-sm">
                  <img src={logo} alt="VFA logo" className="w-20 h-20 object-contain rounded-2xl bg-white/10 p-2" />
                  <h2 className="font-display text-2xl font-bold mt-6">Product &amp; Service</h2>
                  <p className="text-green-50/80 text-sm leading-relaxed mt-3">
                    A connected platform for field records, greenhouse conditions, weather intelligence,
                    inventory, sales, alerts, and performance reports.
                  </p>
                  <div className="mt-6 space-y-3">
                    {['Production visibility', 'Farmer-ready recommendations', 'Operational accountability'].map((item) => (
                      <div key={item} className="flex items-center gap-3 text-sm font-semibold text-green-50">
                        <span className="w-2 h-2 rounded-full bg-green-300" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {ABOUT_SERVICES.map(({ title, desc, icon: Icon }) => (
                  <div key={title} className="bg-white/95 rounded-2xl border border-white/30 p-5 shadow-sm">
                    <div className="w-11 h-11 rounded-xl bg-green-700 text-white flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-display font-bold text-green-950 mt-4">{title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mt-2">{desc}</p>
                  </div>
                ))}
              </section>

              <section className="bg-white/95 rounded-3xl border border-white/30 p-6 md:p-8 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div>
                    <div className="text-xs uppercase font-bold text-green-700">Why it matters</div>
                    <h2 className="font-display text-2xl font-bold text-green-950 mt-2">
                      From greenhouse data to field decisions.
                    </h2>
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      ['Faster response', 'Alerts help teams act before crop problems spread.'],
                      ['Cleaner records', 'Centralized data keeps production and sales aligned.'],
                      ['Better planning', 'Reports make seed, inventory, and farm decisions easier.'],
                    ].map(([title, desc]) => (
                      <div key={title} className="rounded-2xl bg-green-50 border border-green-100 p-4">
                        <div className="font-bold text-green-950 text-sm">{title}</div>
                        <div className="text-xs text-gray-600 leading-relaxed mt-1">{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {false && (
            <div className="bg-white/70 backdrop-blur rounded-3xl border border-green-100 p-8 shadow-sm">
              <div className="max-w-3xl">
                <h1 className="font-display text-3xl md:text-4xl font-bold text-gray-900">About Us</h1>
                <p className="text-gray-600 text-base md:text-lg mt-3 leading-relaxed">
                  VFA Greenhouse Seeds Hub Ltd supports potato seed production and greenhouse operations
                  through practical tools for registration, monitoring, reporting, and collaboration.
                </p>

                <h2 className="font-semibold text-gray-900 mt-8 text-lg">Product &amp; Services</h2>
                <div className="mt-4 space-y-3">
                  {[
                    {
                      title: 'Farm &amp; Crop Management',
                      desc: 'Centralized registry for farms, crops, seed batches and production tracking.',
                    },
                    {
                      title: 'Greenhouse Monitoring',
                      desc: 'Track greenhouse conditions (temperature, humidity, CO₂, soil moisture) and status.',
                    },
                    {
                      title: 'Inventory &amp; Sales',
                      desc: 'Manage stock levels and generate sales invoices with payment status.',
                    },
                    {
                      title: 'Alerts &amp; Analytics',
                      desc: 'Get actionable alerts and performance insights for better decision making.',
                    },
                  ].map((item) => (
                    <div key={item.title} className="p-4 rounded-2xl border border-green-50 bg-white">
                      <div className="font-semibold text-gray-900">{item.title}</div>
                      <div className="text-gray-600 text-sm mt-1">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-green-950/90">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="font-display text-xl font-bold text-white">Contact</div>
              <div className="mt-3 space-y-3 text-green-50/80">
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-green-300 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-white">Phone</div>
                    <a className="text-sm text-green-200 hover:underline" href="tel:+250780000000">
                      +250 784 019 837
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-green-300 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-white">Email</div>
                    <a className="text-sm text-green-200 hover:underline" href="mailto:info@vfa.rw">
                      info@vfa.rw
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-green-300 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-white">Location</div>
                    <div className="text-sm text-green-50/80">Rwanda - southern province Nyamagabe district</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-5 h-5 text-green-300 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-white">WhatsApp</div>
                    <a className="text-sm text-green-200 hover:underline" href="https://wa.me/250780000000" target="_blank" rel="noreferrer">
                      +250 784 019 837
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="font-display text-xl font-bold text-white">Find us</div>
              <p className="text-sm text-green-50/70 mt-2">OpenStreetMap preview.</p>

              <div className="mt-4 rounded-3xl overflow-hidden border border-green-100">
                <iframe
                  title="VFA Location Map"
                  className="w-full h-64 md:h-72"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=29.35%2C-2.10%2C29.65%2C-1.40&layer=mapnik&marker=-2.07%2C29.39"
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <a
                  href="#"
                  className="inline-flex items-center gap-2 text-green-200 hover:text-white font-semibold text-sm"
                  onClick={(e) => e.preventDefault()}
                >
                  {/* <Facebook className="w-4 h-4" /> */}
                  Facebook
                </a>
                <a
                  href="https://wa.me/250780000000"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-green-200 hover:text-white font-semibold text-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
              </div>

              <div className="mt-6 text-xs text-green-50/60">
                © {new Date().getFullYear()} VFA Greenhouse Seeds Hub Ltd. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

