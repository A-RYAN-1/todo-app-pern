export const REPEAT_OPTIONS = [
  { value: "none", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

// "weekly" -> "Repeats weekly"; anything else (null, "none") -> "".
export function repeatLabel(rule) {
  const option = REPEAT_OPTIONS.find((o) => o.value === rule && o.value !== "none");
  return option ? `Repeats ${option.label.toLowerCase()}` : "";
}

// The API answers { overdue, today, tomorrow }; a malformed answer counts as empty.
export function normalizeReminders(data) {
  const list = (value) => (Array.isArray(value) ? value : []);
  return {
    overdue: list(data && data.overdue),
    today: list(data && data.today),
    tomorrow: list(data && data.tomorrow),
  };
}

// Browser notifications are sent once per todo per day. `seen` is the list of
// todo ids already notified today; returns the todos to notify now.
export function toNotify(reminders, seen) {
  const already = new Set(seen);
  return [...reminders.overdue, ...reminders.today].filter((todo) => !already.has(todo.todo_id));
}
