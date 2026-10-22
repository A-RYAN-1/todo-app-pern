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
