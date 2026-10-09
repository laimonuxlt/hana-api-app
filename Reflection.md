# Reflection

## Development experience with Node.js and SAP HANA

This task gave me a complete view of how an SAP BTP application is put together. The MTA descriptor ties two modules together: a database module that deploys to an HDI container, and a Node.js module that serves the data. Defining the `PRODUCTS` table declaratively (`.hdbtable`, `.csv` and `.hdbtabledata`) and deploying it through HDI was cleaner than creating objects manually, because the design-time files can be redeployed and kept in Git.

On the Node.js side, Express 5 made the REST API quick to write. The `@sap/hana-client` driver is callback-based, so I wrapped `connect` and `exec` in small promise helpers. That let me use `async/await`, keep the five CRUD handlers short, and always close the connection in a `finally` block. Using parameterized queries (`?` placeholders) for every statement meant user input never reaches the SQL text, which protects against SQL injection.

## Challenges and how I solved them

- **npm setup.** `npm install` first failed because `srv` had no valid `package.json`. I created it with an explicit lowercase name and changed `"type"` from `commonjs` to `module`, so the `import` statements worked. I also added a `start` script so the server runs with `npm start`.
- **Connection settings.** `/health-check` returned 500 because of a quoting error in `srv/.env`: the quotes wrapped only the host name and left `:443` outside. Printing the loaded variables with a small `node -e` command showed the mistake at once. I also learned to use the runtime `user` and `password` from the binding rather than the `hdi_` pair, and to take the real schema name from `db/.env`, since it differs from the name in `mta.yaml`.
- **Special characters in the password.** The generated password contained spaces and symbols, so copying it by hand was unreliable. Wrapping the value in single quotes solved it.
- **Stale server process.** After I added the CRUD routes, curl still returned `Cannot GET /api/products/1`. An old process was still serving requests on port 3015, and Node does not reload code on its own. Stopping it and starting one fresh instance fixed it.
- **Git hygiene.** I used `git check-ignore` and `git status` to confirm that `.env` files and `node_modules` stayed out of the repository. I also found and fixed a corrupted `.gitignore` line caused by appending text without a newline.
- **Credentials in output.** The debug terminal printed environment variables, including the password. I made sure not to include that output in screenshots and kept credentials out of `launch.json` and the repository.

## Effectiveness of AI tools for SAP HANA development

AI tools were very useful for boilerplate: the `mta.yaml` module snippet, the promise wrappers around the HANA client, and the structure of the CRUD routes. They also helped me interpret error messages and decide what to check next, which shortened troubleshooting.

They also had limits. Some generated code did not match my project: it used a resource name different from my `hdi_db`, assumed a `server.js` entry point, and called a `createConnection()` helper that did not exist. Dependency versions also differed from what the examples assumed, for example Express 5 instead of 4. Every suggestion had to be checked against my real project and tested against the real database before I could trust it. AI saved time on routine code, but it did not replace understanding how HDI containers, bindings and the Node.js driver work.

## Debugging experience and insights

Running the server under the Node.js debugger let me stop inside `GET /api/products/:id` and inspect the request without adding `console.log` statements. I confirmed that `req.params.id` is a string, which is why the code converts it with `Number()` before running the query. After stepping over the query, I could see the shape of `rows` and confirm that the HANA data was returned correctly.

I also learned some practical lessons. A breakpoint only triggers if the request reaches the process attached to the debugger, so a second server on the same port causes confusing results. Watch expressions such as `req.params.id` are much easier to read than the very large `req` object. Finally, a database `DECIMAL` value arrives as a string (`"999.00"`), something I noticed only by looking at the real response.

## Potential improvements

- Use a connection pool instead of opening a new connection for every request.
- Add schema-based input validation, pagination, filtering and sorting on `GET /api/products.
- Protect the API with authentication
- Return `PRICE` as a number, enable TLS certificate validation, and add structured logging and a central error handler.
- Document the API with OpenAPI/Swagger and add automated tests.
- Consider the SAP Cloud Application Programming Model (CAP), which can generate much of this API layer from a data model.

## Real business scenario

This API could be the backend of a product catalog or inventory service. A Fiori app, a web shop or other systems could read and maintain product data stored in SAP HANA Cloud: for example, stock levels updated by a warehouse system, or prices maintained by a sales team. With authentication, connection pooling and more entities such as suppliers and orders, the same pattern could support a real inventory management application on SAP BTP, with the data kept in one consistent place and reused by several consumers.
