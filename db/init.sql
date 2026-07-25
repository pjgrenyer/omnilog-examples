CREATE TABLE products (
  sku        TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  declined   BOOLEAN NOT NULL DEFAULT false -- seeded SKU that always fails checkout
);

CREATE TABLE orders (
  id          SERIAL PRIMARY KEY,
  sku         TEXT NOT NULL REFERENCES products(sku),
  quantity    INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO products (sku, name, price_cents, declined) VALUES
  ('mug-01',   'Ceramic Mug',       1200, false),
  ('shirt-01', 'Cotton T-Shirt',    2500, false),
  ('bad-card', 'Cursed Card Reader', 9999, true);
