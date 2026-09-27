// The product cell shared by every stock, inventory and order table.
//
// One cell, so that "which product is this?" is answered the same way everywhere:
// the name on the first line, the variety and seed class on the second. A table
// that showed the name alone left the reader unable to tell two lots apart when
// several products share a name, so the qualifiers are part of the cell rather
// than a column the reader has to match across.

import { productDetailLabel } from '../../lib/productDetail';

/**
 * `detail` is what `productDetailLookup` returns for this row's product. `sub` is
 * rendered underneath the qualifiers, for the extra line a table already adds
 * there (a batch number, a warehouse).
 */
export function ProductCell({ detail, sub, className = '' }) {
  if (!detail?.name) return <span className="text-gray-300">—</span>;
  return (
    <div className={className}>
      <div className="font-medium text-gray-700">{detail.name}</div>
      {detail.qualifiers ? <div className="text-xs text-gray-400">{detail.qualifiers}</div> : null}
      {sub}
    </div>
  );
}

/** The same detail for a non-table place that needs text, such as a picker option. */
export function productOptionLabel(detail, options) {
  return productDetailLabel(detail, options);
}
