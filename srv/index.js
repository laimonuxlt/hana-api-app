import "dotenv/config";
import express from "express";
import hana from "@sap/hana-client";

const app = express();
app.use(express.json());                       // must come before the routes
const PORT = process.env.PORT || 3015;

const connectionParams = {
  serverNode: process.env.HANA_HOST,
  uid: process.env.HANA_USER,
  pwd: process.env.HANA_PASSWORD,
  currentSchema: process.env.HANA_SCHEMA,
  encrypt: true,
  sslValidateCertificate: false                // dev only
};

// AI-assisted: promise wrappers around the callback-based hana-client
const connect = () => new Promise((resolve, reject) => {
  const conn = hana.createConnection();
  conn.connect(connectionParams, (err) => (err ? reject(err) : resolve(conn)));
});

const run = async (sql, params = []) => {
  const conn = await connect();
  try {
    return await new Promise((resolve, reject) =>
      conn.exec(sql, params, (err, res) => (err ? reject(err) : resolve(res))));
  } finally {
    conn.disconnect();
  }
};

app.get("/", (req, res) => res.json({ message: "SAP HANA API Server", status: "running" }));

app.get("/health-check", async (req, res) => {
  try {
    await run("SELECT 1 FROM DUMMY");
    res.send("Database connection successful");
  } catch (e) {
    console.error("Error connecting to HANA:", e);
    res.status(500).send("Database connection failed");
  }
});

// AI-assisted: CRUD handlers
// GET all products
app.get("/api/products", async (req, res) => {
  try {
    res.json(await run('SELECT * FROM "PRODUCTS" ORDER BY "ID"'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET one product
app.get("/api/products/:id", async (req, res) => {
  try {
    const rows = await run('SELECT * FROM "PRODUCTS" WHERE "ID" = ?', [Number(req.params.id)]);
    rows.length ? res.json(rows[0]) : res.status(404).json({ error: "Product not found" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create product
app.post("/api/products", async (req, res) => {
  const { id, name, category, price, stock } = req.body;
  if (!Number.isInteger(id) || !name || typeof name !== "string") {
    return res.status(400).json({ error: "id (integer) and name (string) are required" });
  }
  if (price != null && (typeof price !== "number" || price < 0)) {
    return res.status(400).json({ error: "price must be a non-negative number" });
  }
  try {
    await run(
      'INSERT INTO "PRODUCTS" ("ID","NAME","CATEGORY","PRICE","STOCK") VALUES (?,?,?,?,?)',
      [id, name, category ?? null, price ?? null, stock ?? null]
    );
    res.status(201).json({ message: "Product created", id });
  } catch (e) {
    res.status(e.message.includes("unique constraint") ? 409 : 500).json({ error: e.message });
  }
});

// PUT update product
app.put("/api/products/:id", async (req, res) => {
  const { name, category, price, stock } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const affected = await run(
      'UPDATE "PRODUCTS" SET "NAME"=?, "CATEGORY"=?, "PRICE"=?, "STOCK"=? WHERE "ID"=?',
      [name, category ?? null, price ?? null, stock ?? null, Number(req.params.id)]
    );
    affected ? res.json({ message: "Product updated" }) : res.status(404).json({ error: "Product not found" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE product
app.delete("/api/products/:id", async (req, res) => {
  try {
    const affected = await run('DELETE FROM "PRODUCTS" WHERE "ID"=?', [Number(req.params.id)]);
    affected ? res.json({ message: "Product deleted" }) : res.status(404).json({ error: "Product not found" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`srv listening on port ${PORT}`));