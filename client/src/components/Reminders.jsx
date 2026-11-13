import { API_URL } from "../config";
import { useEffect, useState } from "react";
import { authHeader, localDate } from "../api";
import { normalizeReminders, toNotify } from "../repeat";

const NOTIFIED_KEY = "todo-notified";
const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

// Ids already notified today, kept in this browser only.
function readNotified(day) {
  try {
    const stored = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "null");
    return stored && stored.day === day && Array.isArray(stored.ids) ? stored.ids : [];
  } catch {
    return [];
  }
}

function writeNotified(day, ids) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify({ day, ids }));
  } catch {
    // storage unavailable: the worst case is a repeated notification
  }
}

const Group = ({ title, todos, tone }) =>
  todos.length === 0 ? null : (
    <li>
      <p className={`text-sm font-semibold ${tone}`}>
        {title} ({todos.length})
      </p>
      <p className="text-gray-300 text-sm">{todos.map((t) => t.description).join(", ")}</p>
    </li>
  );

// Overdue, due today and due tomorrow, worked out by the server from the
// user's own date. Browser notifications are opt-in and sent once a day.
const Reminders = ({ todos }) => {
  const [reminders, setReminders] = useState(normalizeReminders(null));
  const [permission, setPermission] = useState(
    notificationsSupported() ? Notification.permission : "denied"
  );

  useEffect(() => {
    let cancelled = false;
    const day = localDate();
    (async () => {
      try {
        const response = await fetch(`${API_URL}/todos/reminders?today=${day}`, {
          headers: authHeader(),
        });
        if (!response.ok || cancelled) return;
        const data = normalizeReminders(await response.json());
        if (cancelled) return;
        setReminders(data);
        if (notificationsSupported() && Notification.permission === "granted") {
          const seen = readNotified(day);
          const fresh = toNotify(data, seen);
          fresh.forEach((todo) => {
            new Notification(`Todo reminder: ${todo.description}`, {
              body: `Due ${todo.due_date} | Priority ${todo.priority}`,
            });
          });
          if (fresh.length) writeNotified(day, [...seen, ...fresh.map((t) => t.todo_id)]);
        }
      } catch {
        // reminders are a convenience; the list itself still works
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [todos]);

  const turnOn = async () => setPermission(await Notification.requestPermission());

  const total = reminders.overdue.length + reminders.today.length + reminders.tomorrow.length;
  const canAsk = notificationsSupported() && permission === "default";
  if (total === 0 && !canAsk) return null;

  return (
    <section
      aria-label="Reminders"
      className="p-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700 mb-8"
    >
      <div className="flex justify-between items-center gap-4 mb-2">
        <h2 className="text-2xl font-bold text-white">Reminders</h2>
        {canAsk && (
          <button
            className="px-4 py-2 rounded-lg border border-gray-400 text-gray-200 hover:bg-gray-600 text-sm font-semibold"
            onClick={turnOn}
          >
            Turn on browser reminders
          </button>
        )}
      </div>
      {total === 0 ? (
        <p className="text-gray-400 text-sm">Nothing is overdue or due by tomorrow.</p>
      ) : (
        <ul className="space-y-2">
          <Group title="Overdue" todos={reminders.overdue} tone="text-red-400" />
          <Group title="Due today" todos={reminders.today} tone="text-orange-400" />
          <Group title="Due tomorrow" todos={reminders.tomorrow} tone="text-yellow-300" />
        </ul>
      )}
    </section>
  );
};

export default Reminders;
