# hana-api-app

A Multi-Target Application (MTA) built in SAP Business Application Studio. It contains an SAP HANA database module (HDI container) and a Node.js module that exposes a RESTful CRUD API for a `PRODUCTS` table in SAP HANA Cloud.

## Tech stack

| Component | Version / notes |
|---|---|
| Node.js | 18 or newer, ES modules (`"type": "module"`) |
| Express | 5.x |
| `@sap/hana-client` | 2.x (native SAP HANA driver) |
| `dotenv` | 18.x (loads `srv/.env`) |
| Database | SAP HANA Cloud, HDI container (`hdi-shared` plan) |

## Project structure

```
hana-api-app/
├── db/                         # SAP HANA database module (HDI)
│   ├── src/
│   │   ├── .hdiconfig
│   │   ├── PRODUCTS.hdbtable       # table definition
│   │   ├── PRODUCTS.csv            # initial data
│   │   └── PRODUCTS.hdbtabledata   # CSV -> table mapping
│   └── package.json
├── srv/                        # Node.js (Express) API module
│   ├── index.js                # server, HANA connection, CRUD routes
│   ├── request.http            # API tests (VS Code REST Client)
│   └── package.json            # dependencies and "start" script
├── .vscode/
│   └── launch.json             # Node.js debug configuration
├── mta.yaml                    # MTA deployment descriptor
└── README.md
```

## Prerequisites

- SAP BTP account with Cloud Foundry enabled and a space where you have the Space Developer role
- A running SAP HANA Cloud instance mapped to that Cloud Foundry space
- Entitlement for the `hdi-shared` plan (SAP HANA Schemas & HDI Containers)
- SAP Business Application Studio (Full-Stack Cloud Application dev space), or a local environment with Node.js 18+ and the Cloud Foundry CLI

## Setup

### 1. Clone and install

```bash
git clone https://github.com/laimonuxlt/hana-api-app.git
cd hana-api-app
cd db && npm install && cd ..
cd srv && npm install && cd ..
```

### 2. Log in to Cloud Foundry

In BAS press `F1` and run **CF: Login to Cloud Foundry**, or use `cf login`.

### 3. Deploy the database module

1. Open the **SAP HANA Projects** view.
2. Bind the `db` module to an HDI container service instance (this creates `db/.env`).
3. Click **Deploy** on `db`.
4. In the **Database Explorer**, open the `PRODUCTS` table and check that the sample rows were loaded.

### 4. Configure the service

`db/.env` (created by the bind step) holds the credentials as one `VCAP_SERVICES` JSON line. Create `srv/.env` with the **runtime** values from it:

```
PORT=3015
HANA_USER=<credentials.user>
HANA_PASSWORD=<credentials.password>
HANA_SCHEMA=<credentials.schema>
HANA_HOST=<credentials.host>:<credentials.port>
```

Notes:

- Use `user` and `password`, not `hdi_user` and `hdi_password`.
- `HANA_HOST` is `hostname:443` with no `https://` and no quotes around only the hostname.
- If the password contains special characters (spaces, `#`, backticks), wrap the whole value in single quotes.
- `.env` files are listed in `.gitignore` and must never be committed.

### 5. Run the server

```bash
cd srv
npm start
```

Expected output: `srv listening on port 3015`.

`npm start` runs `node index.js`, as defined in `srv/package.json`:

```json
"scripts": {
  "start": "node index.js"
}
```

Run it from inside `srv`, so that `dotenv` finds `srv/.env`. Stop the server with `Ctrl+C`.

### 6. Check the connection

In a second terminal:

```bash
curl -i http://localhost:3015/health-check
```

Expected: `HTTP/1.1 200 OK` and `Database connection successful`.

## API endpoints

Base URL: `http://localhost:3015`

| Method | Path | Description | Success | Errors |
|---|---|---|---|---|
| GET | `/` | Server status | 200 | |
| GET | `/health-check` | Tests the HANA connection | 200 | 500 |
| GET | `/api/products` | List all products | 200 | 500 |
| GET | `/api/products/:id` | Get one product | 200 | 404, 500 |
| POST | `/api/products` | Create a product | 201 | 400, 409, 500 |
| PUT | `/api/products/:id` | Update a product | 200 | 400, 404, 500 |
| DELETE | `/api/products/:id` | Delete a product | 200 | 404, 500 |

### Example: create a product

```bash
curl -i -X POST http://localhost:3015/api/products \
  -H "Content-Type: application/json" \
  -d '{"id":100,"name":"Monitor","category":"Electronics","price":199.99,"stock":10}'
```

Response: `201 Created`

```json
{ "message": "Product created", "id": 100 }
```

### Request body

| Field | Type | Required |
|---|---|---|
| `id` | integer (POST only) | yes |
| `name` | string | yes |
| `category` | string | no |
| `price` | number, >= 0 | no |
| `stock` | integer | no |

`DECIMAL` columns are returned by the HANA client as strings, so `PRICE` appears as `"999.00"`.

## Testing

Open `srv/request.http` with the **REST Client** extension and click **Send Request** above each block. The file contains the full flow:

1. GET all
2. POST (create)
3. GET all
4. GET by id
5. PUT (update)
6. GET by id (verify)
7. DELETE
8. GET by id (expects 404)

It also includes a validation error case (400).

## Debugging

1. Stop any running server (`npm start` or `node index.js`), otherwise port 3015 is already in use.
2. Open **Run and Debug**, select **Launch Server** and press `F5`.
3. Set a breakpoint in a route handler, for example on the `const rows = await run(...)` line in `GET /api/products/:id`.
4. Call `curl http://localhost:3015/api/products/1` and inspect `req.params` and `rows` while paused. Using **Watch** expressions such as `req.params.id` is easier than expanding the whole `req` object.

`.vscode/launch.json` runs `srv/index.js` with `srv` as the working directory.

## Implementation notes

- All SQL uses parameterized queries (`?` placeholders) to prevent SQL injection.
- Each request opens and closes its own HANA connection. A connection pool would be the next step for production use.
- The project uses Express 5. Every route has its own `try/catch`, so errors are returned as JSON with a suitable status code.
- `sslValidateCertificate: false` is set for development convenience. For production, enable certificate validation.
- Parts of the boilerplate (promise wrappers around `@sap/hana-client`, CRUD handlers) were generated with AI assistance and then reviewed and tested. They are marked with `AI-assisted` comments in `srv/index.js`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `/health-check` returns 500 | Read the `Error connecting to HANA:` line in the server terminal. Check `srv/.env` (host, user, password, schema) and that the HANA Cloud instance is running. |
| `Cannot GET /api/products/1` | An old server process is still running. Stop it (`lsof -i :3015`, then `kill <PID>`) and start again. |
| `EADDRINUSE` on port 3015 | Another server or debug session is using the port. Stop it first. |
| `Cannot use import statement outside a module` | `"type": "module"` is missing in `srv/package.json`. |
| `invalid table name: PRODUCTS` | The `db` module is not deployed, or `HANA_SCHEMA` does not match the schema in `db/.env`. |

## Security

- Never commit `.env` files or credentials.
- Do not share screenshots of terminals or files that show passwords.
- Rotate the service key if credentials were ever exposed.

## Optional: build and deploy as an MTA archive

```bash
mbt build
cf deploy mta_archives/hana-api-app_0.0.1.mtar
```

Before deploying `srv` to Cloud Foundry, switch it to the credentials supplied by the bound HDI service (`VCAP_SERVICES`) instead of `srv/.env`.
