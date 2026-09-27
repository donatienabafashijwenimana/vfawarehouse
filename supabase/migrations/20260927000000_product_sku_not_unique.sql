-- SKUs are not required to be unique: the same product code may be recorded
-- multiple times with different variety/class data (see products_sku_key
-- duplicate-key errors). The frontend already shows the SKU on every row, so
-- duplicates remain visible and traceable without a database constraint.

alter table products
  drop constraint if exists products_sku_key;
