import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

const json = (body, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

const TODO = {
  todo_id: 1,
  description: "write tests",
  due_date: "2026-11-01",
  priority: "High",
  category: "Work",
  completed: false,
};

beforeEach(() => {
  localStorage.clear();
  globalThis.fetch = vi.fn();
});

async function logIn() {
  render(<App />);
  await userEvent.type(screen.getByLabelText("Username"), "demo");
  await userEvent.type(screen.getByLabelText("Password"), "demo-pass-123");
  await userEvent.click(screen.getByRole("button", { name: "Login" }));
}

test("shows the login form first", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
});

test("shows the server's message when login fails", async () => {
  globalThis.fetch.mockReturnValueOnce(json({ error: "Invalid username or password" }, 401));
  await logIn();
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
});

test("logs in, stores the token and lists the user's todos", async () => {
  globalThis.fetch.mockReturnValueOnce(json({ token: "tok" })).mockReturnValue(json([TODO]));
  await logIn();
  expect(await screen.findByText("write tests")).toBeInTheDocument();
  expect(localStorage.getItem("token")).toBe("tok");
  const call = globalThis.fetch.mock.calls.find(([url]) => url.endsWith("/todos"));
  expect(call[1].headers.Authorization).toBe("tok");
});

test("ticking a todo sends it as completed", async () => {
  globalThis.fetch.mockReturnValueOnce(json({ token: "tok" })).mockReturnValue(json([TODO]));
  await logIn();
  await userEvent.click(await screen.findByLabelText("Mark write tests as done"));
  await waitFor(() =>
    expect(globalThis.fetch.mock.calls.some(([, init]) => init && init.method === "PUT")).toBe(true)
  );
  const put = globalThis.fetch.mock.calls.find(([, init]) => init && init.method === "PUT");
  expect(JSON.parse(put[1].body).completed).toBe(true);
});

test("an expired token (401) sends the user back to the login form", async () => {
  globalThis.fetch
    .mockReturnValueOnce(json({ token: "tok" }))
    .mockReturnValue(json({ error: "Invalid or expired token" }, 401));
  await logIn();
  // The todos request is the second call; wait for it, then for the form to return.
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(localStorage.getItem("token")).toBeNull());
  expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
});

test("the category list shows the user's own categories", async () => {
  globalThis.fetch
    .mockReturnValueOnce(json({ token: "tok" }))
    .mockReturnValue(json([{ ...TODO, category: "Gym" }]));
  await logIn();
  await screen.findByText("write tests");
  const filter = screen.getByLabelText("Filter by category");
  expect(within(filter).getByRole("option", { name: "Gym" })).toBeInTheDocument();
  const form = screen.getAllByLabelText("Category")[0];
  expect(within(form).getByRole("option", { name: "Gym" })).toBeInTheDocument();
});

test("a new category typed in the add form is sent with the task", async () => {
  globalThis.fetch.mockReturnValueOnce(json({ token: "tok" })).mockReturnValue(json([]));
  await logIn();
  await userEvent.selectOptions(await screen.findByLabelText("Category"), "New category...");
  await userEvent.type(screen.getByLabelText("New category name"), "Gym");
  await userEvent.type(screen.getByPlaceholderText("Add a new todo"), "run 5k");
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
  await waitFor(() =>
    expect(
      globalThis.fetch.mock.calls.some(
        ([url, init]) => url.endsWith("/todos") && init && init.method === "POST"
      )
    ).toBe(true)
  );
  const post = globalThis.fetch.mock.calls.find(
    ([url, init]) => url.endsWith("/todos") && init && init.method === "POST"
  );
  expect(JSON.parse(post[1].body).category).toBe("Gym");
});

test("Fill form turns one sentence into the form fields without saving anything", async () => {
  globalThis.fetch.mockReturnValueOnce(json({ token: "tok" })).mockImplementation((url) =>
    url.endsWith("/todos/parse")
      ? json({
          description: "Call mum",
          due_date: "2026-11-13",
          priority: "High",
          category: "Personal",
          source: "model",
          limited: false,
        })
      : json([TODO])
  );
  await logIn();
  await userEvent.type(
    await screen.findByLabelText("Describe the todo in one sentence"),
    "call mum friday 5pm high priority"
  );
  await userEvent.click(screen.getByRole("button", { name: "Fill form" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Filled by the AI helper");
  expect(screen.getByLabelText("New todo description")).toHaveValue("Call mum");
  expect(screen.getByLabelText("Due date")).toHaveValue("2026-11-13");
  expect(screen.getByLabelText("Priority")).toHaveValue("High");
  const parseCall = globalThis.fetch.mock.calls.find(([url]) => url.endsWith("/todos/parse"));
  expect(JSON.parse(parseCall[1].body).today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const saved = globalThis.fetch.mock.calls.some(
    ([url, init]) => url.endsWith("/todos") && init && init.method === "POST"
  );
  expect(saved).toBe(false);
});

test("Fill form says when the rules, not the model, filled the fields", async () => {
  globalThis.fetch.mockReturnValueOnce(json({ token: "tok" })).mockImplementation((url) =>
    url.endsWith("/todos/parse")
      ? json({
          description: "Buy milk",
          due_date: null,
          priority: "Low",
          category: null,
          source: "rules",
          limited: true,
        })
      : json([TODO])
  );
  await logIn();
  await userEvent.type(
    await screen.findByLabelText("Describe the todo in one sentence"),
    "buy milk"
  );
  await userEvent.click(screen.getByRole("button", { name: "Fill form" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Filled by simple rules");
});

test("Fill form shows the server's error", async () => {
  globalThis.fetch
    .mockReturnValueOnce(json({ token: "tok" }))
    .mockImplementation((url) =>
      url.endsWith("/todos/parse")
        ? json({ error: "Too many requests, try again in a minute" }, 429)
        : json([TODO])
    );
  await logIn();
  await userEvent.type(await screen.findByLabelText("Describe the todo in one sentence"), "x y z");
  await userEvent.click(screen.getByRole("button", { name: "Fill form" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
});

const REMINDERS = {
  overdue: [{ todo_id: 7, description: "pay rent", due_date: "2026-11-10", priority: "High" }],
  today: [{ todo_id: 8, description: "call mum", due_date: "2026-11-13", priority: "Low" }],
  tomorrow: [],
};

test("the reminders panel lists overdue and due-today todos from the server", async () => {
  globalThis.fetch
    .mockReturnValueOnce(json({ token: "tok" }))
    .mockImplementation((url) =>
      url.includes("/todos/reminders") ? json(REMINDERS) : json([TODO])
    );
  await logIn();
  const panel = await screen.findByRole("region", { name: "Reminders" });
  expect(panel).toHaveTextContent("Overdue (1)");
  expect(panel).toHaveTextContent("pay rent");
  expect(panel).toHaveTextContent("Due today (1)");
  expect(panel).toHaveTextContent("call mum");
  expect(panel).not.toHaveTextContent("Due tomorrow");
  const call = globalThis.fetch.mock.calls.find(([url]) => url.includes("/todos/reminders"));
  expect(call[0]).toMatch(/today=\d{4}-\d{2}-\d{2}$/);
});

test("no reminders panel when nothing is due and notifications cannot be asked for", async () => {
  globalThis.fetch
    .mockReturnValueOnce(json({ token: "tok" }))
    .mockImplementation((url) =>
      url.includes("/todos/reminders")
        ? json({ overdue: [], today: [], tomorrow: [] })
        : json([TODO])
    );
  await logIn();
  await screen.findByText("write tests");
  expect(screen.queryByRole("region", { name: "Reminders" })).not.toBeInTheDocument();
});

test("a repeating todo shows its rule", async () => {
  globalThis.fetch
    .mockReturnValueOnce(json({ token: "tok" }))
    .mockReturnValue(json([{ ...TODO, recurrence: "weekly" }]));
  await logIn();
  expect(await screen.findByText("Repeats weekly")).toBeInTheDocument();
});

test("the repeat choice is sent with the new todo and needs a due date", async () => {
  globalThis.fetch.mockReturnValueOnce(json({ token: "tok" })).mockReturnValue(json([]));
  await logIn();
  const repeat = await screen.findByLabelText("Repeat");
  expect(repeat).toBeDisabled();
  await userEvent.type(screen.getByPlaceholderText("Add a new todo"), "water plants");
  await userEvent.type(screen.getByLabelText("Due date"), "2026-11-20");
  expect(repeat).toBeEnabled();
  await userEvent.selectOptions(repeat, "weekly");
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
  await waitFor(() =>
    expect(
      globalThis.fetch.mock.calls.some(
        ([url, init]) => url.endsWith("/todos") && init && init.method === "POST"
      )
    ).toBe(true)
  );
  const post = globalThis.fetch.mock.calls.find(
    ([url, init]) => url.endsWith("/todos") && init && init.method === "POST"
  );
  expect(JSON.parse(post[1].body).recurrence).toBe("weekly");
});

test("clearing the due date also clears the repeat choice", async () => {
  globalThis.fetch.mockReturnValueOnce(json({ token: "tok" })).mockReturnValue(json([]));
  await logIn();
  const date = await screen.findByLabelText("Due date");
  await userEvent.type(date, "2026-11-20");
  await userEvent.selectOptions(screen.getByLabelText("Repeat"), "weekly");
  await userEvent.clear(date);
  expect(screen.getByLabelText("Repeat")).toBeDisabled();
  await userEvent.type(date, "2026-11-21");
  expect(screen.getByLabelText("Repeat")).toHaveValue("none");
});

const WITH_SUBTASKS = {
  ...TODO,
  subtasks: [
    { todo_id: 11, description: "outline", completed: true },
    { todo_id: 12, description: "draft", completed: false },
  ],
  progress: { done: 1, total: 2 },
};
const SECOND = { ...TODO, todo_id: 2, description: "ship it", subtasks: [] };

const requestsTo = (method, suffix) =>
  globalThis.fetch.mock.calls.filter(
    ([url, init]) => url.endsWith(suffix) && init && init.method === method
  );

test("shows each todo's subtasks and how many are done", async () => {
  globalThis.fetch
    .mockReturnValueOnce(json({ token: "tok" }))
    .mockReturnValue(json([WITH_SUBTASKS]));
  await logIn();
  expect(await screen.findByText("outline")).toBeInTheDocument();
  expect(screen.getByText("draft")).toBeInTheDocument();
  expect(screen.getByText("1/2 subtasks")).toBeInTheDocument();
  expect(screen.getByLabelText("Mark outline as done")).toBeChecked();
  expect(screen.getByLabelText("Mark draft as done")).not.toBeChecked();
});

test("adding a subtask posts it to the todo", async () => {
  globalThis.fetch
    .mockReturnValueOnce(json({ token: "tok" }))
    .mockReturnValue(json([WITH_SUBTASKS]));
  await logIn();
  await userEvent.type(await screen.findByLabelText("Add a subtask to write tests"), "review");
  await userEvent.click(screen.getByRole("button", { name: "Add subtask to write tests" }));
  await waitFor(() => expect(requestsTo("POST", "/todos/1/subtasks")).toHaveLength(1));
  expect(JSON.parse(requestsTo("POST", "/todos/1/subtasks")[0][1].body)).toEqual({
    description: "review",
  });
});

test("ticking a subtask patches only that subtask", async () => {
  globalThis.fetch
    .mockReturnValueOnce(json({ token: "tok" }))
    .mockReturnValue(json([WITH_SUBTASKS]));
  await logIn();
  await userEvent.click(await screen.findByLabelText("Mark draft as done"));
  await waitFor(() => expect(requestsTo("PATCH", "/subtasks/12")).toHaveLength(1));
  expect(JSON.parse(requestsTo("PATCH", "/subtasks/12")[0][1].body)).toEqual({ completed: true });
});

test("a refused subtask shows the server's message", async () => {
  globalThis.fetch.mockImplementation((url, init = {}) => {
    if (url.endsWith("/login")) return json({ token: "tok" });
    if (init.method === "POST") return json({ error: "A todo can have at most 50 subtasks" }, 400);
    return json([WITH_SUBTASKS]);
  });
  await logIn();
  await userEvent.type(await screen.findByLabelText("Add a subtask to write tests"), "one more");
  await userEvent.click(screen.getByRole("button", { name: "Add subtask to write tests" }));
  expect(await screen.findByText("A todo can have at most 50 subtasks")).toBeInTheDocument();
});

test("moving a todo down sends the new order of all todos", async () => {
  globalThis.fetch
    .mockReturnValueOnce(json({ token: "tok" }))
    .mockReturnValue(json([WITH_SUBTASKS, SECOND]));
  await logIn();
  await userEvent.click(await screen.findByLabelText("Move write tests down"));
  await waitFor(() => expect(requestsTo("PUT", "/todos/order")).toHaveLength(1));
  expect(JSON.parse(requestsTo("PUT", "/todos/order")[0][1].body)).toEqual({ ids: [2, 1] });
  expect(screen.getByLabelText("Move write tests up")).toBeDisabled();
  expect(screen.getByLabelText("Move ship it down")).toBeDisabled();
});

test("ordering is switched off while a search narrows the list", async () => {
  globalThis.fetch
    .mockReturnValueOnce(json({ token: "tok" }))
    .mockReturnValue(json([WITH_SUBTASKS, SECOND]));
  await logIn();
  expect(await screen.findByLabelText("Move write tests down")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Search todos"), "ship");
  expect(screen.queryByLabelText("Move ship it up")).not.toBeInTheDocument();
});

test("a todo without subtasks offers an Add a subtask button that opens the field", async () => {
  globalThis.fetch.mockReturnValueOnce(json({ token: "tok" })).mockReturnValue(json([SECOND]));
  await logIn();
  const open = await screen.findByRole("button", { name: "Add a subtask to ship it" });
  expect(screen.queryByPlaceholderText("Add a subtask")).not.toBeInTheDocument();
  await userEvent.click(open);
  expect(await screen.findByPlaceholderText("Add a subtask")).toHaveFocus();
});
