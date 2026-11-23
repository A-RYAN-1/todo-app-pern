import { reorderIds, stepIds, progressOf } from "./order";

const todos = [1, 2, 3, 4].map((todo_id) => ({ todo_id }));

test("dropping a todo on a later one moves it down to that place", () => {
  expect(reorderIds(todos, 1, 3)).toEqual([2, 3, 1, 4]);
});

test("dropping a todo on an earlier one moves it up to that place", () => {
  expect(reorderIds(todos, 4, 2)).toEqual([1, 4, 2, 3]);
});

test("dropping a todo on itself or on an unknown one moves nothing", () => {
  expect(reorderIds(todos, 2, 2)).toBeNull();
  expect(reorderIds(todos, 2, 99)).toBeNull();
  expect(reorderIds(todos, 99, 2)).toBeNull();
});

test("a step moves one place and stops at the ends", () => {
  expect(stepIds(todos, 2, -1)).toEqual([2, 1, 3, 4]);
  expect(stepIds(todos, 2, 1)).toEqual([1, 3, 2, 4]);
  expect(stepIds(todos, 1, -1)).toBeNull();
  expect(stepIds(todos, 4, 1)).toBeNull();
  expect(stepIds(todos, 99, 1)).toBeNull();
});

test("progress counts done subtasks over all of them", () => {
  const todo = { subtasks: [{ completed: true }, { completed: false }, { completed: true }] };
  expect(progressOf(todo)).toEqual({ done: 2, total: 3 });
  expect(progressOf({})).toEqual({ done: 0, total: 0 });
});
