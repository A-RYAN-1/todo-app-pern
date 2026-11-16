// The OpenAPI spec must describe exactly the routes the app serves. No database is needed:
// the pool connects lazily and none of these requests reach it.
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const SwaggerParser = require("@apidevtools/swagger-parser");

process.env.JWT_SECRET = process.env.JWT_SECRET || "t".repeat(40);
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/todos";

const { createApp } = require("../app");
const { spec } = require("../docs");
const pool = require("../connect_server_and_database");

const app = createApp();
const DOCUMENTED_ELSEWHERE = new Set(["GET /openapi.json", "GET /docs", "GET /docs/init.js"]);

test.after(() => pool.end());

function mountedRoutes() {
  const found = new Set();
  const walk = (stack) => {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          found.add(`${method.toUpperCase()} ${layer.route.path.replace(/:(\w+)/g, "{$1}")}`);
        }
      } else if (layer.name === "router" && layer.handle.stack) {
        walk(layer.handle.stack);
      }
    }
  };
  walk(app._router.stack);
  return found;
}

function documentedRoutes() {
  const found = new Set();
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of Object.keys(item)) found.add(`${method.toUpperCase()} ${path}`);
  }
  return found;
}

test("the spec is a valid OpenAPI 3 document", async () => {
  await SwaggerParser.validate(structuredClone(spec));
});

test("every served route is documented and every documented route is served", () => {
  const served = [...mountedRoutes()].filter((route) => !DOCUMENTED_ELSEWHERE.has(route)).sort();
  const documented = [...documentedRoutes()].sort();
  assert.deepEqual(documented, served);
});

test("every protected route declares the bearer scheme and a 401", () => {
  const open = new Set(["/health", "/register", "/login"]);
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (open.has(path)) continue;
      assert.ok(operation.security, `${method} ${path} has no security`);
      assert.ok(operation.responses["401"], `${method} ${path} has no 401`);
    }
  }
});

test("/openapi.json serves the spec", async () => {
  const res = await request(app).get("/openapi.json").expect(200);
  assert.equal(res.body.openapi, spec.openapi);
});

test("/docs serves Swagger UI and its assets under the default security policy", async () => {
  const page = await request(app).get("/docs").expect(200);
  assert.match(page.text, /swagger-ui-bundle\.js/);
  assert.match(page.headers["content-security-policy"], /script-src 'self'/);
  assert.doesNotMatch(page.text, /<script>[^<]/, "no inline script: the policy would block it");
  await request(app).get("/docs/assets/swagger-ui-bundle.js").expect(200);
  await request(app).get("/docs/init.js").expect(200);
});
