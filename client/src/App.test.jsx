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
