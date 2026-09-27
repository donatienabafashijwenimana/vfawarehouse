// The product detail a reader needs on every stock, inventory and order row: the
// product name, its variety, and its seed class.
//
// The three live in separate columns of `products`, and the variety and the class
// are separate tables of their own (`varieties`, `seed_classes`). A row that names
// only the product is still not enough to identify a lot of seed, because the
// catalog holds several products that differ from each other only by variety and
// class: a reader who sees "Irish potato seeds" on a movement, an inventory row or
// an order line cannot tell which lot it was, and neither can a search for
// "Kinigi" that ignores the variety column.
//
// `productsApi` already embeds `variety` and `seed_class` on every product row, so
// this costs no extra query and no schema change: the detail is resolved from the
// store's product list, the same way units are resolved (see units.js). The id
// fallbacks matter for a product that was only just created in this session, which
// is in the store as a plain row with `variety_id` and no embed until the workspace
// reloads.

const nameOf = (value) => String(value ?? '').trim();

/**
 * The display detail for one product, or for a product id.
 *
 * Returns `{ name, variety, className, qualifiers, text }`, where `qualifiers` is
 * the variety and class as one ready-to-render line and `text` is all three joined
 * by spaces, for search and for places that want a single string. Missing variety
 * or class is left out rather than shown as an empty or placeholder value, so a
 * product with only one of the two is not padded with a dash.
 */
export function productDetailLookup(products = [], { varieties = [], seedClasses = [] } = {}) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const varietyById = new Map(varieties.map((v) => [v.id, v.name]));
  const classById = new Map(seedClasses.map((c) => [c.id, c.name]));

  return (productOrId) => {
    // A row that already carries the embedded product is read directly; anything
    // else is a product_id to look up.
    const product = productOrId && typeof productOrId === 'object' ? productOrId : byId.get(productOrId);
    const name = nameOf(product?.name);
    const variety = nameOf(product?.variety?.name) || nameOf(varietyById.get(product?.variety_id));
    const className = nameOf(product?.seed_class?.name) || nameOf(classById.get(product?.seed_class_id));
    return {
      name,
      variety,
      className,
      qualifiers: [variety, className].filter(Boolean).join(' · '),
      text: [name, variety, className].filter(Boolean).join(' '),
    };
  };
}

/** The detail as one string, for a picker option or a sentence. */
export function productDetailLabel(detail, { withQualifiers = true } = {}) {
  if (!detail?.name) return '—';
  return withQualifiers && detail.qualifiers ? `${detail.name} · ${detail.qualifiers}` : detail.name;
}
