// Integration tests for subtasks and manual order: need a Postgres with the schema applied (DATABASE_URL).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const request = require("supertest");

process.env.JWT_SECRET = process.env.JWT_SECRET || "t".repeat(40);
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/todos";

const { createApp } = require("../app");
const pool = require("../connect_server_and_database");
const { MAX_SUBTASKS } = require("../validation");

const app = createApp({ authLimit: 1000 });
const suffix = Date.now().toString(36);
const names = [`sub_a_${suffix}`, `sub_b_${suffix}`, `sub_c_${suffix}`];
const PASSWORD = "correct-horse-1";

async function signup(username) {
  await request(app).post("/register").send({ username, password: PASSWORD }).expect(201);
  const res = await request(app).post("/login").send({ username, password: PASSWORD }).expect(200);
  return res.body.token;
}

async function login(username) {
  const res = await request(app).post("/login").send({ username, password: PASSWORD }).expect(200);
  return res.body.token;
}

const addTodo = async (token, description, extra = {}) =>
  (
    await request(app)
      .post("/todos")
      .set("Authorization", token)
      .send({ description, ...extra })
      .expect(201)
  ).body;

const addSubtask = (token, todoId, description) =>
  request(app).post(`/todos/${todoId}/subtasks`).set("Authorization", token).send({ description });

const list = async (token) =>
  (await request(app).get("/todos").set("Authorization", token).expect(200)).body;

const order = (token, body) =>
  request(app).put("/todos/order").set("Authorization", token).send(body);

const titles = (todos) => todos.map((t) => t.description);

test.after(async () => {
  await pool.query(
    "DELETE FROM todo WHERE user_id IN (SELECT user_id FROM users WHERE username = ANY($1))",
    [names]
  );
  await pool.query("DELETE FROM users WHERE username = ANY($1)", [names]);
  await pool.end();
});

test("a subtask appears under its parent and progress is done over total", async () => {
  const token = await signup(names[0]);
  const parent = await addTodo(token, "plan trip");
  let [row] = await list(token);
  assert.deepEqual(row.progress, { done: 0, total: 0 });
  assert.deepEqual(row.subtasks, []);

  const a = (await addSubtask(token, parent.todo_id, "book flights").expect(201)).body;
  await addSubtask(token, parent.todo_id, "book hotel").expect(201);
  await addSubtask(token, parent.todo_id, "pack").expect(201);
  assert.equal(a.parent_id, parent.todo_id);
  assert.equal(a.completed, false);

  const done = await request(app)
    .patch(`/subtasks/${a.todo_id}`)
    .set("Authorization", token)
    .send({ completed: true })
    .expect(200);
  assert.equal(done.body.completed, true);

  const all = await list(token);
  assert.equal(all.length, 1, "subtasks are not listed as todos");
  [row] = all;
  assert.deepEqual(titles(row.subtasks), ["book flights", "book hotel", "pack"]);
  assert.deepEqual(row.progress, { done: 1, total: 3 });

  await request(app)
    .patch(`/subtasks/${a.todo_id}`)
    .set("Authorization", token)
    .send({ completed: false, description: "  book the flights " })
    .expect(200);
  [row] = await list(token);
  assert.deepEqual(row.progress, { done: 0, total: 3 });
  assert.equal(row.subtasks[0].description, "book the flights");
});

test("subtask input is validated", async () => {
  const token = await login(names[0]);
  const [parent] = await list(token);
  await addSubtask(token, parent.todo_id, "").expect(400);
  await addSubtask(token, parent.todo_id, "x".repeat(301)).expect(400);
  await request(app)
    .post(`/todos/${parent.todo_id}/subtasks`)
    .set("Authorization", token)
    .send({})
    .expect(400);
  await request(app)
    .post("/todos/abc/subtasks")
    .set("Authorization", token)
    .send({ description: "x" })
    .expect(400);
  const sub = parent.subtasks[0];
  const patch = (body) =>
    request(app).patch(`/subtasks/${sub.todo_id}`).set("Authorization", token).send(body);
  await patch({}).expect(400);
  await patch({ completed: "yes" }).expect(400);
  await patch({ description: "" }).expect(400);
});

test("a subtask cannot have subtasks and a todo has a limit", async () => {
  const token = await login(names[0]);
  const parent = await addTodo(token, "many things");
  const first = (await addSubtask(token, parent.todo_id, "one").expect(201)).body;
  const nested = await addSubtask(token, first.todo_id, "nested").expect(400);
  assert.match(nested.body.error, /cannot have subtasks/);

  await pool.query(
    `INSERT INTO todo (user_id, parent_id, description, position)
     SELECT user_id, todo_id, 'filler ' || g, g + 1 FROM todo, generate_series(1, $2::int) g WHERE todo_id = $1`,
    [parent.todo_id, MAX_SUBTASKS - 2]
  );
  await addSubtask(token, parent.todo_id, "the last one").expect(201);
  const over = await addSubtask(token, parent.todo_id, "one too many").expect(400);
  assert.match(over.body.error, /at most 50/);
  const [row] = (await list(token)).filter((t) => t.todo_id === parent.todo_id);
  assert.equal(row.progress.total, MAX_SUBTASKS);
});

test("deleting a parent removes its subtasks and nothing else", async () => {
  const token = await login(names[0]);
  const other = await signup(names[1]);
  const keep = await addTodo(other, "someone else's todo");
  await addSubtask(other, keep.todo_id, "someone else's subtask").expect(201);

  const parent = await addTodo(token, "to delete");
  const s1 = (await addSubtask(token, parent.todo_id, "child 1").expect(201)).body;
  await addSubtask(token, parent.todo_id, "child 2").expect(201);

  await request(app).delete(`/todos/${parent.todo_id}`).set("Authorization", token).expect(200);
  const left = await pool.query("SELECT 1 FROM todo WHERE todo_id = $1 OR parent_id = $1", [
    parent.todo_id,
  ]);
  assert.equal(left.rows.length, 0);
  await request(app)
    .patch(`/subtasks/${s1.todo_id}`)
    .set("Authorization", token)
    .send({ completed: true })
    .expect(404);

  const [row] = await list(other);
  assert.equal(row.description, "someone else's todo");
  assert.equal(row.progress.total, 1);
});

test("deleting one subtask leaves the parent and the other subtasks", async () => {
  const token = await login(names[0]);
  const parent = await addTodo(token, "keep the parent");
  const s1 = (await addSubtask(token, parent.todo_id, "gone").expect(201)).body;
  await addSubtask(token, parent.todo_id, "stays").expect(201);
  await request(app).delete(`/todos/${s1.todo_id}`).set("Authorization", token).expect(200);
  const [row] = (await list(token)).filter((t) => t.todo_id === parent.todo_id);
  assert.deepEqual(titles(row.subtasks), ["stays"]);
  assert.deepEqual(row.progress, { done: 0, total: 1 });
});

test("a user cannot read or change another user's subtasks", async () => {
  const mine = await login(names[0]);
  const theirs = await login(names[1]);
  const [theirTodo] = await list(theirs);
  const theirSub = theirTodo.subtasks[0];

  await addSubtask(mine, theirTodo.todo_id, "sneaky").expect(404);
  await request(app)
    .patch(`/subtasks/${theirSub.todo_id}`)
    .set("Authorization", mine)
    .send({ completed: true })
    .expect(404);
  await request(app).delete(`/todos/${theirSub.todo_id}`).set("Authorization", mine).expect(404);
  const seen = JSON.stringify(await list(mine));
  assert.ok(!seen.includes("someone else"));
  const after = await list(theirs);
  assert.equal(after[0].subtasks[0].completed, false);
});

test("the todo and subtask routes keep to their own rows", async () => {
  const token = await login(names[0]);
  const parent = await addTodo(token, "scoped");
  const sub = (await addSubtask(token, parent.todo_id, "child").expect(201)).body;
  await request(app)
    .put(`/todos/${sub.todo_id}`)
    .set("Authorization", token)
    .send({
      description: "turn into a todo",
      recurrence: "daily",
      due_date: "2026-11-23",
      completed: true,
    })
    .expect(404);
  await request(app)
    .patch(`/subtasks/${parent.todo_id}`)
    .set("Authorization", token)
    .send({ completed: true })
    .expect(404);
  const exported = await request(app).get("/export").set("Authorization", token).expect(200);
  assert.ok(!exported.body.some((t) => t.description === "child"), "export leaves subtasks out");
  await request(app)
    .post(`/todos/${parent.todo_id}/subtasks`)
    .send({ description: "x" })
    .expect(401);
  await request(app).patch(`/subtasks/${sub.todo_id}`).send({ completed: true }).expect(401);
  await order("", { ids: [1] }).expect(401);
});

test("manual order persists for the user and across logins", async () => {
  const token = await signup(names[2]);
  const [a, b, c] = [
    await addTodo(token, "A"),
    await addTodo(token, "B"),
    await addTodo(token, "C"),
  ];
  assert.deepEqual(titles(await list(token)), ["A", "B", "C"], "new todos go to the end");

  const res = await order(token, { ids: [c.todo_id, a.todo_id, b.todo_id] }).expect(200);
  assert.equal(res.body.ordered, 3);
  assert.deepEqual(titles(await list(token)), ["C", "A", "B"]);

  const again = await login(names[2]);
  assert.deepEqual(titles(await list(again)), ["C", "A", "B"]);

  const d = await addTodo(again, "D");
  assert.deepEqual(titles(await list(again)), ["C", "A", "B", "D"]);

  // Only D and A are sent: they swap the places they held and B and C stay where they were.
  await order(again, { ids: [d.todo_id, a.todo_id] }).expect(200);
  assert.deepEqual(titles(await list(again)), ["C", "D", "B", "A"]);
});

test("one user's order does not touch another's", async () => {
  const mine = await login(names[2]);
  const theirs = await login(names[1]);
  const before = titles(await list(theirs));
  const ids = (await list(mine)).map((t) => t.todo_id).reverse();
  await order(mine, { ids }).expect(200);
  assert.deepEqual(titles(await list(theirs)), before);

  const [theirTodo] = await list(theirs);
  const [first] = await list(mine);
  const bad = await order(mine, { ids: [first.todo_id, theirTodo.todo_id] }).expect(404);
  assert.equal(bad.body.error, "Todo not found");
  assert.deepEqual((await list(mine))[0].todo_id, first.todo_id, "a refused order changes nothing");
});

test("order input is validated", async () => {
  const token = await login(names[2]);
  const [first, second] = await list(token);
  await order(token, {}).expect(400);
  await order(token, { ids: [] }).expect(400);
  await order(token, { ids: "1,2" }).expect(400);
  await order(token, { ids: [first.todo_id, first.todo_id] }).expect(400);
  await order(token, { ids: [0] }).expect(400);
  await order(token, { ids: [1.5] }).expect(400);
  await order(token, { ids: ["1"] }).expect(400);
  await order(token, { ids: Array.from({ length: 501 }, (_, i) => i + 1) }).expect(400);
  await order(token, { ids: [first.todo_id], parent_id: "x" }).expect(400);
  await order(token, { ids: [99999999] }).expect(404);
  assert.ok(second);
});

test("subtasks are reordered within their own parent", async () => {
  const token = await login(names[0]);
  const parent = await addTodo(token, "ordered children");
  const ids = [];
  for (const text of ["first", "second", "third"]) {
    ids.push((await addSubtask(token, parent.todo_id, text).expect(201)).body.todo_id);
  }
  await order(token, { ids: [ids[2], ids[0], ids[1]], parent_id: parent.todo_id }).expect(200);
  const [row] = (await list(token)).filter((t) => t.todo_id === parent.todo_id);
  assert.deepEqual(titles(row.subtasks), ["third", "first", "second"]);

  await order(token, { ids }).expect(404);
  const wrongParent = await addTodo(token, "another parent");
  await order(token, { ids, parent_id: wrongParent.todo_id }).expect(404);
  await order(token, { ids: [wrongParent.todo_id], parent_id: parent.todo_id }).expect(404);
});

test("the migration orders existing todos by due date and is safe to run again", async () => {
  const token = await signup(`${names[2]}_m`.slice(0, 50));
  const me = await pool.query("SELECT user_id FROM users WHERE username = $1", [
    `${names[2]}_m`.slice(0, 50),
  ]);
  const userId = me.rows[0].user_id;
  // Rows as they were before the column existed: no position.
  await pool.query(
    `INSERT INTO todo (user_id, description, due_date) VALUES
       ($1, 'later', '2026-12-01'), ($1, 'undated', NULL), ($1, 'sooner', '2026-11-01')`,
    [userId]
  );
  const sql = fs.readFileSync(path.join(__dirname, "..", "database.sql"), "utf8");
  await pool.query(sql);
  assert.deepEqual(titles(await list(token)), ["sooner", "later", "undated"]);
  await pool.query(sql);
  assert.deepEqual(titles(await list(token)), ["sooner", "later", "undated"]);
  await pool.query("DELETE FROM todo WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM users WHERE user_id = $1", [userId]);
});
