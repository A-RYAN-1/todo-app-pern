import { useState } from "react";
import { API_URL } from "../config";
import { authHeader, errorMessage } from "../api";
import Icon from "./Icon";

const Subtasks = ({ todo, getTodos }) => {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const subtasks = Array.isArray(todo.subtasks) ? todo.subtasks : [];

  const send = async (url, method, body) => {
    setError("");
    try {
      const response = await fetch(`${API_URL}${url}`, {
        method,
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Could not save the subtask"));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const add = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    if (await send(`/todos/${todo.todo_id}/subtasks`, "POST", { description: text })) {
      setText("");
      getTodos();
    }
  };

  const toggle = async (subtask) => {
    if (await send(`/subtasks/${subtask.todo_id}`, "PATCH", { completed: !subtask.completed })) {
      getTodos();
    }
  };

  const remove = async (subtask) => {
    if (await send(`/todos/${subtask.todo_id}`, "DELETE")) getTodos();
  };

  return (
    <div className="mt-3 pl-8">
      {subtasks.length > 0 && (
        <ul className="space-y-2 mb-3">
          {subtasks.map((subtask) => (
            <li key={subtask.todo_id} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => toggle(subtask)}
                aria-label={`Mark ${subtask.description} as done`}
                className="w-4 h-4"
              />
              <span
                className={`flex-1 text-sm ${
                  subtask.completed ? "line-through text-gray-400" : "text-gray-200"
                }`}
              >
                {subtask.description}
              </span>
              <button
                type="button"
                className="text-gray-300 hover:text-red-400 p-1"
                onClick={() => remove(subtask)}
                aria-label={`Delete subtask ${subtask.description}`}
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="Add a subtask"
          aria-label={`Add a subtask to ${todo.description}`}
          className="flex-1 p-2 text-sm rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
        />
        <button
          type="submit"
          className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          aria-label={`Add subtask to ${todo.description}`}
        >
          Add
        </button>
      </form>
      {error && (
        <p role="alert" className="text-red-400 text-sm mt-2">
          {error}
        </p>
      )}
    </div>
  );
};

export default Subtasks;
