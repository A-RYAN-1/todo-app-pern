import { API_URL } from "../config";
import { Fragment, useState } from "react";
import Icon from "./Icon";
import { authHeader, errorMessage } from "../api";
import CategorySelect from "./CategorySelect";

const EditTodo = ({ todo, todos, getTodos, setEditingTodoId }) => {
  const [description, setDescription] = useState(todo.description);
  const [dueDate, setDueDate] = useState(todo.due_date ? todo.due_date.split("T")[0] : "");
  const [priority, setPriority] = useState(todo.priority || "Low");
  const [category, setCategory] = useState(todo.category || "Personal");
  const [completed, setCompleted] = useState(todo.completed || false);
  const [error, setError] = useState("");

  const updateDescription = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Description cannot be empty.");
      return;
    }
    if (description.trim().length < 3) {
      setError("Description must be at least 3 characters long.");
      return;
    }
    try {
      const body = {
        description,
        due_date: dueDate,
        priority,
        category,
        completed,
      };
      const response = await fetch(`${API_URL}/todos/${todo.todo_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Failed to update todo"));
      setError("");
      setEditingTodoId(null);
      getTodos();
    } catch (err) {
      setError(err.message || "An error occurred. Please try again.");
    }
  };

  const cancelEdit = () => {
    setDescription(todo.description);
    setDueDate(todo.due_date ? todo.due_date.split("T")[0] : "");
    setPriority(todo.priority || "Low");
    setCategory(todo.category || "Personal");
    setCompleted(todo.completed || false);
    setError("");
    setEditingTodoId(null);
  };

  return (
    <Fragment>
      <div className="flex items-center gap-3 flex-1 bg-gray-700 rounded-lg p-3 shadow-md">
        {error && (
          <p role="alert" className="text-red-400 text-sm font-medium bg-red-900/50 p-2 rounded">
            {error}
          </p>
        )}
        <input
          type="text"
          aria-label="Todo description"
          className="flex-1 p-2 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          type="date"
          aria-label="Due date"
          className="p-2 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <select
          className="p-2 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
          value={priority}
          aria-label="Priority"
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
        <CategorySelect
          className="p-2 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
          value={category}
          onChange={setCategory}
          todos={todos}
        />
        <button
          className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition duration-300 transform hover:scale-105"
          onClick={updateDescription}
          aria-label="Save changes"
        >
          <Icon name="check" />
        </button>
        <button
          className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition duration-300 transform hover:scale-105"
          onClick={cancelEdit}
          aria-label="Cancel editing"
        >
          <Icon name="close" />
        </button>
      </div>
    </Fragment>
  );
};

export default EditTodo;
