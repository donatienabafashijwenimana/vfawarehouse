// Totals that are split by unit, because a kilogram total and a bag total cannot
// be added into one honest number.
//
// A KPI card or a summary line that used to read "3,540 kg" now reads one figure
// per unit, so the reader sees what is actually there instead of a total that
// mixes kilograms with bags.

import { formatGroup } from '../../lib/units';

/**
 * One figure per unit. A single group is rendered as plain text so a site that
 * only ever uses one unit looks exactly as it did before; several groups are
 * listed, largest first.
 */
export function GroupedTotal({ groups, withLabel = false, className = '' }) {
  if (!groups || groups.length === 0) return <span className="text-gray-300">—</span>;
  if (groups.length === 1) return <>{formatGroup(groups[0], { withLabel })}</>;
  return (
    <ul className={`space-y-0.5 ${className}`}>
      {groups.map((group) => (
        <li key={group.key} className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-gray-500">
            {withLabel && group.label ? group.label : group.unit}
          </span>
          <span className="text-lg font-bold text-gray-800">
            {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(group.total)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A one-line summary of a grouped total, for prose and table captions. */
export function GroupedTotalText({ groups, withLabel = false, separator = ', ' }) {
  if (!groups || groups.length === 0) return '—';
  return groups.map((group) => formatGroup(group, { withLabel })).join(separator);
}

/**
 * Names the units a set of groups spans, for a caption explaining why a figure is
 * listed several times: "split by unit: kg, bag".
 */
export function UnitsNote({ groups }) {
  if (!groups || groups.length < 2) return null;
  const units = [...new Set(groups.map((g) => g.unit))];
  return <span className="text-xs text-gray-400">split by unit: {units.join(', ')}</span>;
}
