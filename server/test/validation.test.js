const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://unused";
process.env.JWT_SECRET = process.env.JWT_SECRET || "x".repeat(32);

const { validateCredentials, validateTodo, parseId, isRealDate } = require("../validation");

test("credentials: accepts a valid pair and trims the username", () => {
  const r = validateCredentials({ username: "  sam  ", password: "long-enough-1" });
  assert.equal(r.error, undefined);
  assert.equal(r.username, "sam");
});

test("credentials: rejects short usernames, short passwords and non-strings", () => {
  assert.ok(validateCredentials({ username: "ab", password: "long-enough-1" }).error);
  assert.ok(validateCredentials({ username: "sam", password: "short" }).error);
  assert.ok(validateCredentials({ username: 123, password: "long-enough-1" }).error);
  assert.ok(validateCredentials({}).error);
  assert.ok(validateCredentials(undefined).error);
});

test("credentials: login does not enforce the 8 character minimum", () => {
  const r = validateCredentials({ username: "sam", password: "old" }, { strictPassword: false });
  assert.equal(r.error, undefined);
});

test("credentials: rejects passwords over 72 characters (bcrypt limit)", () => {
  assert.ok(validateCredentials({ username: "sam", password: "a".repeat(73) }).error);
});

test("todo: applies defaults", () => {
  const { value, error } = validateTodo({ description: "  buy milk " });
  assert.equal(error, undefined);
  assert.deepEqual(value, {
    description: "buy milk",
    due_date: null,
    priority: "Low",
    category: null,
    completed: false,
  });
});

test("todo: rejects missing, blank and oversized descriptions", () => {
  assert.ok(validateTodo({}).error);
  assert.ok(validateTodo({ description: "   " }).error);
  assert.ok(validateTodo({ description: "a".repeat(301) }).error);
});

test("todo: validates priority, category and completed", () => {
  assert.ok(validateTodo({ description: "x", priority: "Urgent" }).error);
  assert.ok(validateTodo({ description: "x", category: "c".repeat(51) }).error);
  assert.ok(validateTodo({ description: "x", completed: "yes" }).error);
  assert.equal(
    validateTodo({ description: "x", priority: "High", completed: true }).value.completed,
    true
  );
});

test("todo: accepts a date or an ISO timestamp, rejects impossible dates", () => {
  assert.equal(
    validateTodo({ description: "x", due_date: "2026-11-01" }).value.due_date,
    "2026-11-01"
  );
  assert.equal(
    validateTodo({ description: "x", due_date: "2026-11-01T00:00:00.000Z" }).value.due_date,
    "2026-11-01"
  );
  assert.ok(validateTodo({ description: "x", due_date: "2026-02-30" }).error);
  assert.ok(validateTodo({ description: "x", due_date: "tomorrow" }).error);
  assert.ok(validateTodo({ description: "x", due_date: 20261101 }).error);
});

test("isRealDate and parseId", () => {
  assert.equal(isRealDate("2024-02-29"), true);
  assert.equal(isRealDate("2025-02-29"), false);
  assert.equal(parseId("12"), 12);
  assert.equal(parseId("0"), null);
  assert.equal(parseId("1; DROP TABLE todo"), null);
  assert.equal(parseId("-3"), null);
});
