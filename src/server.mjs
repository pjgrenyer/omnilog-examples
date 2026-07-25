import express from "express";
import { trace } from "@opentelemetry/api";
import { pool } from "./db.mjs";

const tracer = trace.getTracer("shop-demo");

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

  app.post("/checkout", async (req, res) => {
    const { sku, quantity } = req.body;

    try {
      const product = await tracer.startActiveSpan("validateCart", async (span) => {
        const { rows } = await pool.query("SELECT * FROM products WHERE sku = $1", [sku]);
        span.end();
        if (!rows[0]) throw new Error("unknown sku");
        return rows[0];
      });

      const total_cents = await tracer.startActiveSpan("priceCart", (span) => {
        const total = product.price_cents * quantity;
        span.setAttribute("cart.total_cents", total);
        span.end();
        return total;
      });

      await tracer.startActiveSpan("chargeCard", async (span) => {
        await new Promise((r) => setTimeout(r, 150 + Math.random() * 100));
        if (product.declined) {
          span.setStatus({ code: 2, message: "card declined" }); // 2 = ERROR
          span.end();
          throw Object.assign(new Error("card declined"), { statusCode: 402 });
        }
        span.end();
      });

      const orderId = await tracer.startActiveSpan("createOrder", async (span) => {
        const { rows } = await pool.query(
          "INSERT INTO orders (sku, quantity, total_cents) VALUES ($1, $2, $3) RETURNING id",
          [sku, quantity, total_cents],
        );
        span.end();
        return rows[0].id;
      });

      res.status(201).json({ orderId, total_cents });
    } catch (err) {
      res.status(err.statusCode ?? 500).json({ error: err.message });
    }
  });

  return app;
}
