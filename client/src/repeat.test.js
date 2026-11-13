import { normalizeReminders, repeatLabel, toNotify } from "./repeat";

test("repeatLabel names a rule and is empty for none or unknown", () => {
  expect(repeatLabel("weekly")).toBe("Repeats weekly");
  expect(repeatLabel("none")).toBe("");
  expect(repeatLabel(null)).toBe("");
  expect(repeatLabel("yearly")).toBe("");
});

test("normalizeReminders tolerates a malformed answer", () => {
  expect(normalizeReminders([{ todo_id: 1 }])).toEqual({ overdue: [], today: [], tomorrow: [] });
  expect(normalizeReminders(null).today).toEqual([]);
  expect(normalizeReminders({ today: [{ todo_id: 2 }] }).today).toHaveLength(1);
});

test("toNotify skips todos already notified today and never notifies tomorrow's", () => {
  const reminders = {
    overdue: [{ todo_id: 1 }],
    today: [{ todo_id: 2 }, { todo_id: 3 }],
    tomorrow: [{ todo_id: 4 }],
  };
  expect(toNotify(reminders, [2]).map((t) => t.todo_id)).toEqual([1, 3]);
  expect(toNotify(reminders, [1, 2, 3])).toEqual([]);
});
