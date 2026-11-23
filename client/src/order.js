// The ids of `todos` after the todo `movedId` is dropped onto the place of `targetId`; null when nothing moves.
export function reorderIds(todos, movedId, targetId) {
  const ids = todos.map((t) => t.todo_id);
  const from = ids.indexOf(movedId);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1 || from === to) return null;
  ids.splice(to, 0, ...ids.splice(from, 1));
  return ids;
}

// The ids after moving one todo a step up (-1) or down (1); null at either end of the list.
export function stepIds(todos, id, step) {
  const at = todos.findIndex((t) => t.todo_id === id);
  const neighbour = todos[at + step];
  return at === -1 || !neighbour ? null : reorderIds(todos, id, neighbour.todo_id);
}

// Subtasks done and in total, tolerating a todo that came without them.
export function progressOf(todo) {
  const subtasks = Array.isArray(todo.subtasks) ? todo.subtasks : [];
  return { done: subtasks.filter((s) => s.completed).length, total: subtasks.length };
}
