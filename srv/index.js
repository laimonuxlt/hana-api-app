import "dotenv/config";
import hana from "@sap/hana-client";
import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3015;

const connectionParams = {
  serverNode: process.env.HANA_HOST,
  uid: process.env.HANA_USER,
  pwd: process.env.HANA_PASSWORD,
  currentSchema: process.env.HANA_SCHEMA,
  encrypt: true,                    // HANA Cloud requires TLS
  sslValidateCertificate: false     // dev only
};

app.get("/", (req, res) => {
  res.json({ message: "SAP HANA API Server", status: "running" });
});

// Health-check endpoint testing HANA connection
app.get("/health-check", (req, res) => {
  const connection = hana.createConnection();

  connection.connect(connectionParams, (err) => {
    if (err) {
      console.error("Error connecting to HANA:", err);
      res.status(500).send("Database connection failed");
    } else {
      console.log("Connected to HANA successfully");
      res.send("Database connection successful");
      connection.disconnect();
    }
  });
});

app.listen(PORT, () => {
  console.log(`srv listening on port ${PORT}`);
});