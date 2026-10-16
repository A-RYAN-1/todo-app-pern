import { API_URL } from "../config";
import { Fragment, useState, useEffect } from "react";
import EditTodo from "./EditTodo";
import Icon from "./Icon";
import { authHeader } from "../api";

const ListTodos = ({ todos, getTodos }) => {
  const [editingTodoId, setEditingTodoId] = useState(null);

  const deleteTodo = async (id) => {
    try {
      const response = await fetch(`${API_URL}/todos/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to delete todo");
      getTodos();
    } catch (err) {
      console.error(err.message);
    }
  };

  const toggleComplete = async (id, completed) => {
    try {
      const todoToUpdate = todos.find((t) => t.todo_id === id);
      const response = await fetch(`${API_URL}/todos/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({ ...todoToUpdate, completed: !completed }),
      });
      if (!response.ok) throw new Error("Failed to update todo");
      getTodos();
    } catch (err) {
      console.error(err.message);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
        return "bg-red-500";
      case "Medium":
        return "bg-yellow-500";
      case "Low":
      default:
        return "bg-green-500";
    }
  };

  const getDueStatus = (dueDate, completed) => {
    if (!dueDate || completed) return { isOverdue: false, isDueSoon: false };
    const due = new Date(dueDate);
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = (due - now) / oneDay;
    return {
      isOverdue: due < now,
      isDueSoon: diff > 0 && diff <= 1,
    };
  };

  useEffect(() => {
    // Only notify if the user already granted permission; never prompt on load.
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    todos.forEach((todo) => {
      const { isOverdue, isDueSoon } = getDueStatus(todo.due_date, todo.completed);
      if ((isOverdue || isDueSoon) && !todo.completed) {
        new Notification(`Todo Reminder: ${todo.description || "Untitled"}`, {
          body: `Due: ${
            todo.due_date ? todo.due_date.split("T")[0] : "No Due Date"
          } | Priority: ${todo.priority || "N/A"}`,
        });
      }
    });
  }, [todos]);

  return (
    <Fragment>
      <div className="space-y-4">
        {todos.length === 0 ? (
          <div className="text-center text-gray-400 py-10 bg-gray-700 rounded-lg shadow-md">
            <Icon name="list" className="w-10 h-10 mb-4 mx-auto opacity-50" />
            <p className="text-lg font-medium">No todos yet. Add one above!</p>
          </div>
        ) : (
          todos.map((todo, index) => {
            const { isOverdue, isDueSoon } = getDueStatus(todo.due_date, todo.completed);
            const isEditing = editingTodoId === todo.todo_id;
            return (
              <div
                key={todo.todo_id}
                className={`flex items-center justify-between p-4 rounded-lg bg-gray-700 shadow-md transition duration-300 hover:bg-gray-600 ${
                  isOverdue ? "border-red-500 border-2" : ""
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {isEditing ? (
                  <EditTodo todo={todo} getTodos={getTodos} setEditingTodoId={setEditingTodoId} />
                ) : (
                  <>
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => toggleComplete(todo.todo_id, todo.completed)}
                        aria-label={`Mark ${todo.description} as done`}
                        className="w-5 h-5 text-indigo-500 focus:ring-indigo-500"
                      />
                      <p
                        className={`text-gray-200 text-base font-medium ${
                          todo.completed ? "line-through text-gray-400" : ""
                        }`}
                      >
                        {todo.description || "Untitled"}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {todo.due_date ? todo.due_date.split("T")[0] : "No Due Date"}
                      </p>
                      {todo.priority && (
                        <span
                          className={`text-xs px-2 py-1 rounded-full text-white font-medium ${getPriorityColor(
                            todo.priority
                          )}`}
                        >
                          {todo.priority}
                        </span>
                      )}
                      {todo.category && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-500 text-white font-medium">
                          {todo.category}
                        </span>
                      )}
                      {isDueSoon && !isOverdue && (
                        <span className="text-xs px-2 py-1 rounded-full bg-orange-500 text-white font-medium">
                          Due Soon
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 transition duration-300 transform hover:scale-105 text-sm font-medium"
                        onClick={() => setEditingTodoId(todo.todo_id)}
                        aria-label={`Edit ${todo.description}`}
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition duration-300 transform hover:scale-105 flex items-center gap-2 text-sm font-medium"
                        onClick={() => deleteTodo(todo.todo_id)}
                        aria-label={`Delete ${todo.description}`}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </Fragment>
  );
};

export default ListTodos;
