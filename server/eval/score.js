// Field-level scoring shared by the evaluation run and its tests.
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function scoreCase(expected, got) {
  const fields = {
    description: norm(expected.description) === norm(got.description),
    due_date: (expected.due_date ?? null) === (got.due_date ?? null),
    priority: expected.priority === got.priority,
    category: (expected.category ?? null) === (got.category ?? null),
  };
  // core = the three objective fields; category labels are partly a matter of taste.
  const core = fields.description && fields.due_date && fields.priority;
  return { ...fields, core, all: core && fields.category };
}

function summarize(results) {
  const n = results.length;
  const out = { n };
  for (const key of ["description", "due_date", "priority", "category", "core", "all"]) {
    const hits = results.filter((r) => r.score[key]).length;
    out[key] = { hits, pct: n ? Math.round((hits / n) * 1000) / 10 : 0 };
  }
  return out;
}

// Every fourth case (index 3, 7, ...) is held out: the prompt is never tuned on it.
const isHoldout = (i) => i % 4 === 3;

module.exports = { scoreCase, summarize, isHoldout, norm };
