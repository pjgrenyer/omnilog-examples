import express from "express";
import { pool } from "./db.mjs";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/products", async (_req, res) => {
    const { rows } = await pool.query("SELECT sku, name, price_cents FROM products");
    res.json(rows);
  });

  app.post("/orders", async (req, res) => {
    const { sku, quantity } = req.body;
    const { rows } = await pool.query("SELECT * FROM products WHERE sku = $1", [sku]);
    const product = rows[0];
    if (!product) return res.status(404).json({ error: "unknown sku" });
    const total_cents = product.price_cents * quantity;
    const order = await pool.query(
      "INSERT INTO orders (sku, quantity, total_cents) VALUES ($1, $2, $3) RETURNING id",
      [sku, quantity, total_cents],
    );
    res.status(201).json({ orderId: order.rows[0].id, total_cents });
  });

  // POST /checkout gets its business-logic spans/metrics/logs in Task 2-4.
  app.post("/checkout", async (req, res) => {
    res.status(501).json({ error: "not implemented yet" });
  });

  return app;
}
