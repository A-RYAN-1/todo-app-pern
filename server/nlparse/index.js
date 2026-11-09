// parseTask: sentence in, validated todo fields out. The model proposes, the
// existing todo validation decides. Any provider failure or invalid answer falls
// back to the rule parser, and `source` says which one produced the fields.
const { validateTodo } = require("../validation");
const { parseTask: parseWithRules } = require("./baseline");

const MAX_TEXT = 300;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekdayOf(today) {
  return WEEKDAYS[new Date(`${today}T00:00:00Z`).getUTCDay()];
}

// Turns raw model text into todo fields, or throws. Categories outside the
// allowed list become null so the model cannot invent one.
function fromModelText(raw, categories) {
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error("model answer is not JSON");
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj))
    throw new Error("model answer is not an object");
  const category =
    typeof obj.category === "string"
      ? (categories.find((c) => c.toLowerCase() === obj.category.trim().toLowerCase()) ?? null)
      : null;
  const { error, value } = validateTodo({
    description: obj.description,
    due_date: obj.due_date,
    priority: obj.priority,
    category,
  });
  if (error) throw new Error(`model answer rejected: ${error}`);
  return {
    description: value.description,
    due_date: value.due_date,
    priority: value.priority,
    category: value.category,
  };
}

async function parseText({ text, today, categories = [], provider = null }) {
  const clean = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return { error: "Text is required" };
  if (clean.length > MAX_TEXT) return { error: `Text must be at most ${MAX_TEXT} characters` };
  const ctx = { text: clean, today, weekday: weekdayOf(today), categories };
  if (provider) {
    try {
      const fields = fromModelText(await provider.complete(ctx), categories);
      return { fields, source: "model" };
    } catch (err) {
      // fall through to the rules; the caller logs err via onFallback if it wants
      return {
        fields: parseWithRules(clean, { today, categories }),
        source: "rules",
        fallbackReason: err.message,
      };
    }
  }
  return { fields: parseWithRules(clean, { today, categories }), source: "rules" };
}

module.exports = { parseText, fromModelText, weekdayOf, MAX_TEXT };
