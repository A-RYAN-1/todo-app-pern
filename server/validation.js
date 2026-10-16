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
    if (typeof b.category !== "string" || b.category.length > 50) {
      return { error: "Category must be at most 50 characters" };
    }
    category = b.category;
  }
  if (b.completed !== undefined && typeof b.completed !== "boolean") {
    return { error: "Completed must be true or false" };
  }
  return {
    value: {
      description: b.description.trim(),
      due_date: dueDate,
      priority,
      category,
      completed: b.completed === true,
    },
  };
}

function parseId(raw) {
  return /^\d{1,9}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

module.exports = { validateCredentials, validateTodo, parseId, isRealDate };
