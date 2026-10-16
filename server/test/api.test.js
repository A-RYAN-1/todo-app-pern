// Integration tests: need a Postgres with the schema applied (DATABASE_URL).
// Locally: docker compose up -d. In CI: a postgres service plus `npm run migrate`.
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.JWT_SECRET = process.env.JWT_SECRET || "t".repeat(40);
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/todos";

const { createApp } = require("../app");
const pool = require("../connect_server_and_database");

const app = createApp({ authLimit: 1000 });
const suffix = Date.now().toString(36);
const names = [`alice_${suffix}`, `bob_${suffix}`];
const PASSWORD = "correct-horse-1";

async function signup(username) {
  await request(app).post("/register").send({ username, password: PASSWORD }).expect(201);
  const res = await request(app).post("/login").send({ username, password: PASSWORD }).expect(200);
  return res.body.token;
}

test.after(async () => {
  await pool.query(
    "DELETE FROM todo WHERE user_id IN (SELECT user_id FROM users WHERE username = ANY($1))",
    [names]
  );
  await pool.query("DELETE FROM users WHERE username = ANY($1)", [names]);
  await pool.end();
});

test("health reports the database", async () => {
  const res = await request(app).get("/health").expect(200);
  assert.equal(res.body.status, "ok");
});

test("security headers are set and the framework is not advertised", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.headers["x-powered-by"], undefined);
  assert.ok(res.headers["x-content-type-options"]);
  assert.ok(res.headers["x-request-id"]);
});

test("register validates input, hashes the password and never returns it", async () => {
  await request(app).post("/register").send({ username: "ab", password: PASSWORD }).expect(400);
  await request(app).post("/register").send({ username: names[0], password: "short" }).expect(400);
  const res = await request(app)
    .post("/register")
    .send({ username: names[0], password: PASSWORD })
    .expect(201);
  assert.equal(res.body.username, names[0]);
  assert.equal(res.body.password, undefined);
  const row = await pool.query("SELECT password FROM users WHERE username = $1", [names[0]]);
  assert.notEqual(row.rows[0].password, PASSWORD);
  assert.match(row.rows[0].password, /^\$2[aby]\$/);
});

test("register rejects a duplicate username with 409", async () => {
  await request(app).post("/register").send({ username: names[0], password: PASSWORD }).expect(409);
});

test("login: wrong password and unknown user get the same 401", async () => {
  const wrong = await request(app)
    .post("/login")
    .send({ username: names[0], password: "nope-nope-1" });
  const unknown = await request(app)
    .post("/login")
    .send({ username: `ghost_${suffix}`, password: "nope-nope-1" });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.body.error, unknown.body.error);
});

test("todo routes need a valid token", async () => {
  await request(app).get("/todos").expect(401);
  await request(app).get("/todos").set("Authorization", "garbage").expect(401);
});

test("todo lifecycle: create, list, update, delete", async () => {
  const token = await signup(names[1]);
  const created = await request(app)
    .post("/todos")
    .set("Authorization", token)
    .send({
      description: "write tests",
      due_date: "2026-11-01",
      priority: "High",
      category: "work",
    })
    .expect(201);
  assert.equal(created.body.due_date, "2026-11-01");
  assert.equal(created.body.completed, false);

  const list = await request(app).get("/todos").set("Authorization", token).expect(200);
  assert.equal(list.body.length, 1);

  const updated = await request(app)
    .put(`/todos/${created.body.todo_id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ description: "write more tests", priority: "Medium", completed: true })
    .expect(200);
  assert.equal(updated.body.completed, true);
  assert.equal(updated.body.description, "write more tests");

  await request(app)
    .delete(`/todos/${created.body.todo_id}`)
    .set("Authorization", token)
    .expect(200);
  await request(app)
    .delete(`/todos/${created.body.todo_id}`)
    .set("Authorization", token)
    .expect(404);
});

test("invalid todo input is rejected with a message, not a stack trace", async () => {
  const token = await signup(`carol_${suffix}`);
  names.push(`carol_${suffix}`);
  const res = await request(app)
    .post("/todos")
    .set("Authorization", token)
    .send({ description: "x", priority: "Urgent" })
    .expect(400);
  assert.match(res.body.error, /Priority/);
  await request(app)
    .put("/todos/abc")
    .set("Authorization", token)
    .send({ description: "x" })
    .expect(400);
  const bad = await request(app)
    .post("/todos")
    .set("Authorization", token)
    .set("Content-Type", "application/json")
    .send("{not json")
    .expect(400);
  assert.equal(bad.body.error, "Malformed JSON");
});

test("a user cannot read, change or delete another user's todo", async () => {
  const alice = await request(app).post("/login").send({ username: names[0], password: PASSWORD });
  const bob = await request(app).post("/login").send({ username: names[1], password: PASSWORD });
  const aliceTodo = await request(app)
    .post("/todos")
    .set("Authorization", alice.body.token)
    .send({ description: "private" })
    .expect(201);

  const bobList = await request(app).get("/todos").set("Authorization", bob.body.token).expect(200);
  assert.equal(
    bobList.body.find((t) => t.todo_id === aliceTodo.body.todo_id),
    undefined
  );
  await request(app)
    .put(`/todos/${aliceTodo.body.todo_id}`)
    .set("Authorization", bob.body.token)
    .send({ description: "hijacked" })
    .expect(404);
  await request(app)
    .delete(`/todos/${aliceTodo.body.todo_id}`)
    .set("Authorization", bob.body.token)
    .expect(404);
});

test("export then import round-trips and import is all-or-nothing", async () => {
  const login = await request(app).post("/login").send({ username: names[0], password: PASSWORD });
  const token = login.body.token;
  const exported = await request(app).get("/export").set("Authorization", token).expect(200);
  assert.ok(exported.body.length >= 1);

  const before = (await request(app).get("/todos").set("Authorization", token)).body.length;
  await request(app)
    .post("/import")
    .set("Authorization", token)
    .send({ todos: exported.body })
    .expect(201);
  const after = (await request(app).get("/todos").set("Authorization", token)).body.length;
  assert.equal(after, before + exported.body.length);

  await request(app)
    .post("/import")
    .set("Authorization", token)
    .send({ todos: [{ description: "ok" }, { description: "" }] })
    .expect(400);
  const unchanged = (await request(app).get("/todos").set("Authorization", token)).body.length;
  assert.equal(unchanged, after);
});

test("login is rate limited", async () => {
  const limited = createApp({ authLimit: 3 });
  let last;
  for (let i = 0; i < 5; i++) {
    last = await request(limited)
      .post("/login")
      .send({ username: "nobody", password: "whatever-1" });
  }
  assert.equal(last.status, 429);
});

test("unknown routes return JSON 404", async () => {
  const res = await request(app).get("/nope").expect(404);
  assert.equal(res.body.error, "Not found");
});
