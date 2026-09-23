// Catalog slice: categories, seed classes, varieties, products (spec §8–11).
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random()}`);

export const catalogSlice = (set, get) => ({
  categories: [],
  seedClasses: [],
  varieties: [],
  products: [],

  // ---- Categories ----
  addCategory(row) {
    set((s) => ({ categories: [...s.categories, { ...row, id: uid() }] }));
    get().logAction(`Created category "${row.name}"`, 'Categories');
  },
  updateCategory(id, fields) {
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...fields } : c)) }));
    get().logAction(`Updated category`, 'Categories');
  },
  deleteCategory(id) {
    const cat = get().categories.find((c) => c.id === id);
    const used = get().products.some((p) => p.category_id === id);
    if (used) throw new Error('Cannot delete a category that has products. Deactivate it instead.');
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
    get().logAction(`Deleted category "${cat?.name ?? id}"`, 'Categories');
  },

  // ---- Seed Classes ----
  addSeedClass(row) {
    set((s) => ({ seedClasses: [...s.seedClasses, { ...row, id: uid() }] }));
    get().logAction(`Created seed class "${row.name}"`, 'Seed Classes');
  },
  updateSeedClass(id, fields) {
    set((s) => ({ seedClasses: s.seedClasses.map((c) => (c.id === id ? { ...c, ...fields } : c)) }));
    get().logAction(`Updated seed class`, 'Seed Classes');
  },
  deleteSeedClass(id) {
    const used = get().products.some((p) => p.seed_class_id === id);
    if (used) throw new Error('Cannot delete a seed class that products use. Deactivate it instead.');
    set((s) => ({ seedClasses: s.seedClasses.filter((c) => c.id !== id) }));
    get().logAction(`Deleted seed class`, 'Seed Classes');
  },

  // ---- Varieties ----
  addVariety(row) {
    set((s) => ({ varieties: [...s.varieties, { ...row, id: uid() }] }));
    get().logAction(`Created variety "${row.name}"`, 'Varieties');
  },
  updateVariety(id, fields) {
    set((s) => ({ varieties: s.varieties.map((v) => (v.id === id ? { ...v, ...fields } : v)) }));
    get().logAction(`Updated variety`, 'Varieties');
  },
  deleteVariety(id) {
    const used =
      get().products.some((p) => p.variety_id === id) ||
      get().batches.some((b) => b.variety_id === id);
    if (used) throw new Error('Cannot delete a variety used by products or batches. Deactivate it instead.');
    set((s) => ({ varieties: s.varieties.filter((v) => v.id !== id) }));
    get().logAction(`Deleted variety`, 'Varieties');
  },

  // ---- Products ----
  addProduct(row) {
    set((s) => ({ products: [...s.products, { ...row, id: uid() }] }));
    get().logAction(`Created product "${row.name}"`, 'Products');
  },
  updateProduct(id, fields) {
    set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, ...fields } : p)) }));
    get().logAction(`Updated product`, 'Products');
  },
  deleteProduct(id) {
    const used = get().batches.some((b) => b.product_id === id);
    if (used) throw new Error('Cannot delete a product used by production batches. Deactivate it instead.');
    set((s) => ({ products: s.products.filter((p) => p.id !== id) }));
    get().logAction(`Deleted product`, 'Products');
  },
});
