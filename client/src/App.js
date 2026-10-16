import { API_URL } from "./config";
import React, { useState, useEffect } from "react";
import "./App.css";
import InputTodo from "./components/InputTodo";
import ListTodos from "./components/ListTodos";
import Login from "./components/Login";

const App = () => {
  const [todos, setTodos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const getTodos = async () => {
    try {
      const response = await fetch(`${API_URL}/todos`, {
        headers: { Authorization: localStorage.getItem("token") },
      });
      const jsonData = await response.json();
      setTodos(jsonData);
    } catch (err) {
      console.error(err.message);
    }
  };

  useEffect(() => {
    // Do not auto-authenticate on mount; only update todos if authenticated
    if (isAuthenticated) {
      getTodos();
    }
  }, [isAuthenticated]);

  const login = (username, token) => {
    localStorage.setItem("token", token);
    setIsAuthenticated(true);
    setUser(username);
    getTodos();
  };

  const logout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setUser(null);
    setTodos([]);
  };

  const filteredTodos = todos.filter((todo) => {
    const description = todo.description || "";
    const matchesSearch = description
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesPriority =
      priorityFilter === "All" || todo.priority === priorityFilter;
    const matchesCategory =
      categoryFilter === "All" || todo.category === categoryFilter;
    return matchesSearch && matchesPriority && matchesCategory;
  });

  const exportTodos = async () => {
    const response = await fetch(`${API_URL}/export`, {
      headers: { Authorization: localStorage.getItem("token") },
    });
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "todos.json";
    a.click();
  };

  const importTodos = async (event) => {
    const file = event.target.files[0];
    const text = await file.text();
    const todos = JSON.parse(text);
    await fetch(`${API_URL}/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("token"),
      },
      body: JSON.stringify({ todos }),
    });
    getTodos();
  };

  if (!isAuthenticated) return <Login login={login} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 p-4 bg-gray-800 rounded-lg shadow-lg border border-gradient-to-r from-indigo-500 to-purple-500">
          <h1 className="text-5xl font-extrabold text-white tracking-wide animate-pulse">
            Todo List
          </h1>
          <div className="text-right">
            <p className="text-gray-300 font-medium">Logged in as: {user}</p>
            <button
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition duration-300 transform hover:scale-105 font-semibold mt-2"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
        <div className="border-t border-gray-700 my-6"></div>
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg border border-gray-700 mb-8">
          <h2 className="text-3xl font-bold text-white mb-6">Add Todo</h2>
          <InputTodo getTodos={getTodos} />
        </div>
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
          <h2 className="text-3xl font-bold text-white mb-6">Todo List</h2>
          <div className="p-4 bg-gray-700 rounded-lg mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                className="w-full p-3 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300 placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search todos..."
                title="Search by todo description"
              />
              <select
                className="p-3 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                title="Filter by priority"
              >
                <option value="All">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <select
                className="p-3 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                title="Filter by category"
              >
                <option value="All">All Categories</option>
                <option value="Work">Work</option>
                <option value="Personal">Personal</option>
                <option value="Shopping">Shopping</option>
              </select>
              <div className="flex gap-4">
                <button
                  className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition duration-300 transform hover:scale-105 w-full"
                  onClick={exportTodos}
                  title="Export your todos as a JSON file"
                >
                  Export Todos
                </button>
                <input
                  type="file"
                  accept=".json"
                  onChange={importTodos}
                  className="hidden"
                  id="import-input"
                />
                <label
                  htmlFor="import-input"
                  className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition duration-300 transform hover:scale-105 w-full text-center cursor-pointer"
                  title="Import todos from a JSON file"
                >
                  Import Todos
                </label>
              </div>
            </div>
          </div>
          <ListTodos todos={filteredTodos} getTodos={getTodos} />
        </div>
      </div>
    </div>
  );
};

export default App;
