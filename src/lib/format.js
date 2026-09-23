export function formatRWF(value, { compact = false } = {}) {
  const n = Number(value) || 0;
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M RWF`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k RWF`;
  }
  return `${n.toLocaleString('en-US')} RWF`;
}

export function formatNumber(value) {
  return (Number(value) || 0).toLocaleString('en-US');
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${formatDate(d)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/** PLANNED → 'Planned' */
export function prettyLabel(value) {
  if (value == null) return '—';
  return String(value)
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Consistent green palette for Recharts series. */
export const CHART_COLORS = ['#2d9e2d', '#4db54d', '#7fce7f', '#b3e4b3', '#ca9b35', '#ddb75f', '#0a6de0', '#5fa8ff'];
