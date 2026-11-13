const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://unused";
process.env.JWT_SECRET = process.env.JWT_SECRET || "x".repeat(32);

const { nextDueDate } = require("../recurrence");
const { validateTodo } = require("../validation");

test("daily and weekly step across month and year ends", () => {
  assert.equal(nextDueDate("2026-11-30", "daily"), "2026-12-01");
  assert.equal(nextDueDate("2026-12-31", "daily"), "2027-01-01");
  assert.equal(nextDueDate("2026-11-13", "weekly"), "2026-11-20");
  assert.equal(nextDueDate("2026-12-28", "weekly"), "2027-01-04");
  assert.equal(nextDueDate("2028-02-24", "daily"), "2028-02-25");
  assert.equal(nextDueDate("2028-02-28", "daily"), "2028-02-29");
  assert.equal(nextDueDate("2027-02-28", "daily"), "2027-03-01");
});

test("monthly keeps the day and clamps to the next month's length", () => {
  assert.equal(nextDueDate("2026-11-13", "monthly"), "2026-12-13");
  assert.equal(nextDueDate("2026-12-15", "monthly"), "2027-01-15");
  assert.equal(nextDueDate("2027-01-31", "monthly"), "2027-02-28");
  assert.equal(nextDueDate("2028-01-31", "monthly"), "2028-02-29");
  assert.equal(nextDueDate("2026-03-31", "monthly"), "2026-04-30");
});

test("an unknown rule is an error, not a silent no-op", () => {
  assert.throws(() => nextDueDate("2026-11-13", "yearly"), /unknown recurrence rule/);
});

test("validation: repeat is optional, 'none' means off, and it needs a due date", () => {
  const base = { description: "water plants", due_date: "2026-11-13" };
  assert.equal(validateTodo(base).value.recurrence, null);
  assert.equal(validateTodo({ ...base, recurrence: "none" }).value.recurrence, null);
  assert.equal(validateTodo({ ...base, recurrence: "" }).value.recurrence, null);
  assert.equal(validateTodo({ ...base, recurrence: "weekly" }).value.recurrence, "weekly");
  assert.match(validateTodo({ ...base, recurrence: "hourly" }).error, /daily, weekly or monthly/);
  assert.match(
    validateTodo({ description: "water plants", recurrence: "daily" }).error,
    /needs a due date/
  );
});
