const { RULES } = require("./recurrence");

const PRIORITIES = ["Low", "Medium", "High"];

function validateCredentials(body, { strictPassword = true } = {}) {
  const { username, password } = body || {};
  if (typeof username !== "string" || username.trim().length < 3 || username.trim().length > 50) {
    return { error: "Username must be 3-50 characters" };
  }
  if (typeof password !== "string" || password.length === 0 || password.length > 72) {
    return { error: "Password must be 1-72 characters" };
  }
  if (strictPassword && password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }
  return { username: username.trim(), password };
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const isBlank = (v) => v === undefined || v === null || v === "";

function validateTodo(body) {
  const b = body || {};
  if (typeof b.description !== "string" || b.description.trim().length === 0) {
    return { error: "Description is required" };
  }
  if (b.description.length > 300) {
    return { error: "Description must be at most 300 characters" };
  }
  let dueDate = null;
  if (!isBlank(b.due_date)) {
    const day = typeof b.due_date === "string" ? b.due_date.slice(0, 10) : "";
    if (!isRealDate(day)) return { error: "Due date must be YYYY-MM-DD" };
    dueDate = day;
  }
  const priority = isBlank(b.priority) ? "Low" : b.priority;
  if (!PRIORITIES.includes(priority)) {
    return { error: "Priority must be Low, Medium or High" };
  }
  let category = null;
  if (!isBlank(b.category)) {
    if (typeof b.category !== "string" || b.category.trim().length > 50) {
      return { error: "Category must be at most 50 characters" };
    }
    category = b.category.trim() || null;
  }
  if (b.completed !== undefined && typeof b.completed !== "boolean") {
    return { error: "Completed must be true or false" };
  }
  // "none" and "" both mean no repeat; the client sends the select's value as is.
  const recurrence = isBlank(b.recurrence) || b.recurrence === "none" ? null : b.recurrence;
  if (recurrence !== null && !RULES.includes(recurrence)) {
    return { error: "Repeat must be daily, weekly or monthly" };
  }
  if (recurrence !== null && dueDate === null) {
    return { error: "A repeating todo needs a due date" };
  }
  return {
    value: {
      description: b.description.trim(),
      due_date: dueDate,
      priority,
      category,
      completed: b.completed === true,
      recurrence,
    },
  };
}

const MAX_SUBTASKS = 50;
const MAX_ORDER = 500;
const MAX_ID = 999999999;

function validateSubtaskText(description) {
  if (typeof description !== "string" || description.trim().length === 0) {
    return "Description is required";
  }
  if (description.length > 300) return "Description must be at most 300 characters";
  return null;
}

// New subtask: a description only.
function validateSubtask(body) {
  const b = body || {};
  const error = validateSubtaskText(b.description);
  return error ? { error } : { value: { description: b.description.trim() } };
}

// Change to a subtask: a new description, a done state, or both.
function validateSubtaskPatch(body) {
  const b = body || {};
  const value = {};
  if (b.description !== undefined) {
    const error = validateSubtaskText(b.description);
    if (error) return { error };
    value.description = b.description.trim();
  }
  if (b.completed !== undefined) {
    if (typeof b.completed !== "boolean") return { error: "Completed must be true or false" };
    value.completed = b.completed;
  }
  if (Object.keys(value).length === 0) return { error: "Send a description or completed" };
  return { value };
}

const isId = (n) => Number.isInteger(n) && n > 0 && n <= MAX_ID;

// New order: the todo ids in the order wanted, each once, with the parent when they are subtasks.
function validateOrder(body) {
  const { ids, parent_id: rawParent } = body || {};
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_ORDER) {
    return { error: `ids must be a list of 1 to ${MAX_ORDER} todo ids` };
  }
  if (!ids.every(isId)) return { error: "ids must be positive whole numbers" };
  if (new Set(ids).size !== ids.length) return { error: "ids must not repeat" };
  if (rawParent !== undefined && rawParent !== null && !isId(rawParent)) {
    return { error: "parent_id must be a positive whole number" };
  }
  return { value: { ids, parentId: rawParent ?? null } };
}

function parseId(raw) {
  return /^\d{1,9}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

module.exports = {
  validateCredentials,
  validateTodo,
  validateSubtask,
  validateSubtaskPatch,
  validateOrder,
  MAX_SUBTASKS,
  parseId,
  isRealDate,
};
