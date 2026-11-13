import { API_URL } from "../config";
import { Fragment, useState } from "react";
import { authHeader, errorMessage, localDate } from "../api";
import CategorySelect from "./CategorySelect";
import { REPEAT_OPTIONS } from "../repeat";

const InputTodo = ({ getTodos, todos }) => {
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Low");
  const [category, setCategory] = useState("Personal");
  const [recurrence, setRecurrence] = useState("none");
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [sentence, setSentence] = useState("");
  const [filling, setFilling] = useState(false);
  const [fillNote, setFillNote] = useState("");

  // Fills the form below from one typed sentence. Nothing is saved until Add is pressed.
  const onFill = async (e) => {
    e.preventDefault();
    if (!sentence.trim()) return;
    setFilling(true);
    setFillNote("");
    try {
      const response = await fetch(`${API_URL}/todos/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ text: sentence, today: localDate() }),
      });
      if (!response.ok)
        throw new Error(await errorMessage(response, "Could not read that sentence"));
      const parsed = await response.json();
      setDescription(parsed.description);
      setDueDate(parsed.due_date || "");
      setPriority(parsed.priority);
      if (parsed.category) setCategory(parsed.category);
      setSentence("");
      setError("");
      setFillNote(
        parsed.source === "model"
          ? "Filled by the AI helper. Check the fields, then press Add."
          : "Filled by simple rules. Check the fields, then press Add."
      );
    } catch (err) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setFilling(false);
    }
  };

  const onSubmitForm = async (e) => {
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
      const body = { description, due_date: dueDate, priority, category, recurrence };
      const response = await fetch(`${API_URL}/todos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Failed to add todo"));
      setDescription("");
      setDueDate("");
      setPriority("Low");
      setCategory("Personal");
      setRecurrence("none");
      setFormKey((key) => key + 1);
      setError("");
      getTodos();
    } catch (err) {
      setError(err.message || "An error occurred. Please try again.");
    }
  };

  return (
    <Fragment>
      {error && (
        <p
          role="alert"
          className="text-red-400 text-center mb-4 text-sm font-medium bg-red-900/50 p-2 rounded"
        >
          {error}
        </p>
      )}
      <form onSubmit={onFill} className="flex gap-2 mb-4">
        <input
          type="text"
          className="flex-1 p-3 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
          value={sentence}
          maxLength={300}
          onChange={(e) => setSentence(e.target.value)}
          placeholder="Or type it in one line: call mum friday 5pm high priority"
          aria-label="Describe the todo in one sentence"
        />
        <button
          type="submit"
          disabled={filling || !sentence.trim()}
          className="px-4 py-3 rounded-lg border border-gray-400 text-gray-200 hover:bg-gray-600 disabled:opacity-50 font-semibold"
        >
          {filling ? "Reading..." : "Fill form"}
        </button>
      </form>
      {fillNote && (
        <p role="status" className="text-gray-300 text-sm mb-4">
          {fillNote}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] gap-4">
        <input
          type="text"
          className="w-full p-3 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300 placeholder-gray-400"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a new todo"
          aria-label="New todo description"
        />
        <input
          type="date"
          aria-label="Due date"
          className="p-3 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <select
          className="p-3 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
          value={priority}
          aria-label="Priority"
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
        <select
          className="p-3 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300 disabled:opacity-50"
          value={dueDate ? recurrence : "none"}
          aria-label="Repeat"
          title={dueDate ? "Repeat" : "Pick a due date to repeat"}
          disabled={!dueDate}
          onChange={(e) => setRecurrence(e.target.value)}
        >
          {REPEAT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <CategorySelect
          key={formKey}
          className="p-3 rounded-lg bg-gray-600 text-gray-200 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
          value={category}
          onChange={setCategory}
          todos={todos}
        />
        <button
          className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-indigo-600 hover:to-purple-700 transition duration-300 transform hover:scale-105 font-semibold"
          onClick={onSubmitForm}
        >
          Add
        </button>
      </div>
    </Fragment>
  );
};

export default InputTodo;
