const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "t".repeat(40);
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/todos";

const { parseTask } = require("../nlparse/baseline");
const { parseText, fromModelText } = require("../nlparse");
const { createQuota } = require("../nlparse/quota");
const { createGemini, ProviderError } = require("../nlparse/gemini");
const { userMessage, PROMPT_VERSION } = require("../nlparse/prompt");
const { scoreCase, summarize, isHoldout } = require("../eval/score");
const set = require("../eval/cases.json");

const CATS = ["Work", "Personal", "Shopping"];
const ctx = { today: "2026-11-09", categories: CATS }; // a Monday

test("rules: weekday, priority and category from one sentence", () => {
  assert.deepEqual(parseTask("call mum friday 5pm high priority", ctx), {
    description: "Call mum",
    due_date: "2026-11-13",
    priority: "High",
    category: "Personal",
  });
});

test("rules: a bare weekday is never today", () => {
  assert.equal(parseTask("gym monday", ctx).due_date, "2026-11-16");
});

test("rules: relative dates and month names", () => {
  assert.equal(parseTask("x in 3 days", ctx).due_date, "2026-11-12");
  assert.equal(parseTask("x by 20 nov", ctx).due_date, "2026-11-20");
  assert.equal(parseTask("x on dec 1", ctx).due_date, "2026-12-01");
  assert.equal(parseTask("x on 2026-11-18", ctx).due_date, "2026-11-18");
});

test("rules: no date, no priority word gives null and Low", () => {
  const r = parseTask("renew passport", ctx);
  assert.equal(r.due_date, null);
  assert.equal(r.priority, "Low");
});

test("model answer is validated like any other todo", () => {
  const ok = fromModelText(
    '{"description":" Call mum ","due_date":"2026-11-13","priority":"High","category":"personal"}',
    CATS
  );
  assert.deepEqual(ok, {
    description: "Call mum",
    due_date: "2026-11-13",
    priority: "High",
    category: "Personal",
  });
  assert.throws(() => fromModelText("not json", CATS), /not JSON/);
  assert.throws(() => fromModelText('{"description":"","priority":"Low"}', CATS), /rejected/);
  assert.throws(
    () => fromModelText('{"description":"a","due_date":"2026-02-31","priority":"Low"}', CATS),
    /rejected/
  );
  assert.throws(() => fromModelText('{"description":"a","priority":"Urgent"}', CATS), /rejected/);
});

test("model cannot invent a category", () => {
  const r = fromModelText(
    '{"description":"a","due_date":null,"priority":"Low","category":"Secret"}',
    CATS
  );
  assert.equal(r.category, null);
});

test("parseText uses the model when it answers", async () => {
  const provider = {
    complete: async () =>
      '{"description":"Call mum","due_date":"2026-11-13","priority":"High","category":"Personal"}',
  };
  const r = await parseText({ text: "call mum", today: "2026-11-09", categories: CATS, provider });
  assert.equal(r.source, "model");
  assert.equal(r.fields.priority, "High");
});

test("parseText falls back to the rules on a provider error or a bad answer", async () => {
  for (const complete of [
    async () => {
      throw new ProviderError("provider answered 429", { status: 429, retryable: true });
    },
    async () => "```json nope```",
  ]) {
    const r = await parseText({
      text: "call mum friday",
      today: "2026-11-09",
      categories: CATS,
      provider: { complete },
    });
    assert.equal(r.source, "rules");
    assert.equal(r.fields.due_date, "2026-11-13");
    assert.ok(r.fallbackReason);
  }
});

test("parseText rejects empty and over-long text", async () => {
  assert.ok((await parseText({ text: "   ", today: "2026-11-09" })).error);
  assert.ok((await parseText({ text: "a".repeat(301), today: "2026-11-09" })).error);
});

test("quota: per-user and total caps, reset on a new UTC day", () => {
  let day = new Date("2026-11-09T10:00:00Z");
  const q = createQuota({ perUser: 2, total: 3, now: () => day });
  assert.equal(q.take(1), true);
  assert.equal(q.take(1), true);
  assert.equal(q.take(1), false); // user cap
  assert.equal(q.take(2), true);
  assert.equal(q.take(3), false); // total cap
  day = new Date("2026-11-10T00:00:01Z");
  assert.equal(q.take(1), true);
});

test("gemini: key goes in a header, never in the URL, and errors carry no body", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return { ok: false, status: 429, json: async () => ({ error: "secret detail" }) };
  };
  const g = createGemini({ apiKey: "k-123", fetchImpl });
  await assert.rejects(
    g.complete({ text: "a", today: "2026-11-09", weekday: "Monday", categories: CATS }),
    (err) => {
      assert.equal(err.status, 429);
      assert.equal(err.retryable, true);
      assert.ok(!err.message.includes("secret"));
      return true;
    }
  );
  assert.ok(!seen.url.includes("k-123"));
  assert.equal(seen.init.headers["x-goog-api-key"], "k-123");
});

test("prompt carries the date, a calendar and the task, and is versioned", () => {
  const m = userMessage({
    text: "call mum",
    today: "2026-11-09",
    weekday: "Monday",
    categories: CATS,
  });
  assert.match(m, /TODAY: 2026-11-09 \(Monday\)/);
  assert.match(m, /2026-11-13 Friday/);
  assert.match(m, /<task>call mum<\/task>/);
  assert.match(PROMPT_VERSION, /^nl-task-v\d+$/);
});

test("evaluation set is well formed and the holdout is a quarter of it", () => {
  assert.ok(set.cases.length >= 80);
  for (const c of set.cases) {
    assert.ok(c.input && c.description);
    assert.ok(["Low", "Medium", "High"].includes(c.priority));
    assert.ok(c.due_date === null || /^\d{4}-\d{2}-\d{2}$/.test(c.due_date));
  }
  const held = set.cases.filter((_, i) => isHoldout(i)).length;
  assert.equal(held, Math.floor(set.cases.length / 4));
});

test("scoring: core ignores category, whole case does not", () => {
  const want = {
    description: "Call mum",
    due_date: "2026-11-13",
    priority: "High",
    category: "Personal",
  };
  const got = { ...want, category: null };
  const s = scoreCase(want, got);
  assert.equal(s.core, true);
  assert.equal(s.all, false);
  const sum = summarize([{ score: s }, { score: scoreCase(want, want) }]);
  assert.equal(sum.core.pct, 100);
  assert.equal(sum.all.pct, 50);
});

test("rule baseline stays at or above its recorded floor on the evaluation set", () => {
  const results = set.cases.map((c) => ({
    score: scoreCase(c, parseTask(c.input, { today: set.today, categories: set.categories })),
  }));
  assert.ok(summarize(results).core.pct >= 90);
});
