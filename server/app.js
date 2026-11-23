const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const pool = require("./connect_server_and_database");
const config = require("./config");
const { JWT_SECRET, JWT_EXPIRES_IN, CORS_ORIGIN } = config;
const {
  validateCredentials,
  validateTodo,
  validateSubtask,
  validateSubtaskPatch,
  validateOrder,
  MAX_SUBTASKS,
  parseId,
} = require("./validation");
const logger = require("./logger");
const { docsRouter } = require("./docs");
const { parseText } = require("./nlparse");
const { nextDueDate } = require("./recurrence");
const { createGemini } = require("./nlparse/gemini");
const { createQuota } = require("./nlparse/quota");
const { isRealDate } = require("./validation");

const MAX_IMPORT = 500;

const DEFAULT_CATEGORIES = ["Work", "Personal", "Shopping"];

// provider: an object with complete(input) -> raw JSON text, or null for rules only.
// By default it is Gemini when GEMINI_API_KEY is set.
function createApp({
  authLimit = 20,
  provider = config.GEMINI_API_KEY
    ? createGemini({ apiKey: config.GEMINI_API_KEY, model: config.GEMINI_MODEL })
    : null,
  quota = createQuota({ perUser: config.NL_DAILY_USER_LIMIT, total: config.NL_DAILY_TOTAL_LIMIT }),
} = {}) {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json({ limit: "200kb" }));

  // Request id on every request and one log line per response.
  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader("X-Request-Id", req.id);
    const start = Date.now();
    res.on("finish", () => {
      if (req.path === "/health") return;
      logger.info("request", {
        id: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - start,
      });
    });
    next();
  });

  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: authLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts, try again in a few minutes" },
  });

  const fail = (res, status, error) => res.status(status).json({ error });

  const serverError = (req, res, err, what) => {
    logger.error(what, { id: req.id, message: err.message, code: err.code });
    return fail(res, 500, "Server error");
  };

  app.get("/health", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch (err) {
      logger.error("health check failed", { message: err.message });
      res.status(503).json({ status: "database unavailable" });
    }
  });

  app.post("/register", authRateLimit, async (req, res) => {
    const { error, username, password } = validateCredentials(req.body);
    if (error) return fail(res, 400, error);
    try {
      const hashed = await bcrypt.hash(password, 10);
      const result = await pool.query(
        "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING user_id, username",
        [username, hashed]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === "23505") return fail(res, 409, "Username already taken");
      return serverError(req, res, err, "register failed");
    }
  });

  app.post("/login", authRateLimit, async (req, res) => {
    const { error, username, password } = validateCredentials(req.body, {
      strictPassword: false,
    });
    if (error) return fail(res, 400, error);
    try {
      const result = await pool.query("SELECT user_id, password FROM users WHERE username = $1", [
        username,
      ]);
      const user = result.rows[0];
      const ok = user && (await bcrypt.compare(password, user.password));
      if (!ok) return fail(res, 401, "Invalid username or password");
      const token = jwt.sign({ id: user.user_id }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });
      res.json({ token });
    } catch (err) {
      return serverError(req, res, err, "login failed");
    }
  });

  // The client sends its local date; accept it only within two days of the server's.
  const isNearToday = (today) => {
    if (typeof today !== "string" || !isRealDate(today)) return false;
    return Math.abs(Date.parse(`${today}T00:00:00Z`) - Date.now()) <= 2 * 86400000;
  };

  const authenticate = (req, res, next) => {
    const header = req.headers["authorization"];
    if (!header) return fail(res, 401, "Access denied");
    const token = header.replace(/^Bearer\s+/i, "");
    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err) return fail(res, 401, "Invalid or expired token");
      req.user = payload;
      next();
    });
  };

  const parseRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    keyGenerator: (req) => `user-${req.user.id}`,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, try again in a minute" },
  });

  // Sentence to todo fields. The result only fills the form; nothing is saved.
  app.post("/todos/parse", authenticate, parseRateLimit, async (req, res) => {
    const { text, today } = req.body || {};
    if (typeof text !== "string") return fail(res, 400, "Text is required");
    if (!isNearToday(today)) {
      return fail(res, 400, "today must be a date near the current one (YYYY-MM-DD)");
    }
    try {
      const rows = await pool.query(
        "SELECT DISTINCT category FROM todo WHERE user_id = $1 AND category IS NOT NULL",
        [req.user.id]
      );
      const categories = [...DEFAULT_CATEGORIES];
      for (const { category } of rows.rows) {
        if (!categories.some((c) => c.toLowerCase() === category.toLowerCase()))
          categories.push(category);
      }
      const useModel = provider && quota.take(req.user.id);
      const result = await parseText({
        text,
        today,
        categories,
        provider: useModel ? provider : null,
      });
      if (result.error) return fail(res, 400, result.error);
      if (result.fallbackReason)
        logger.warn("model parse fell back", { id: req.id, reason: result.fallbackReason });
      res.json({
        ...result.fields,
        source: result.source,
        limited: Boolean(provider) && !useModel,
      });
    } catch (err) {
      return serverError(req, res, err, "parse failed");
    }
  });

  // Open todos that are overdue, due today or due tomorrow, by the caller's own date.
  app.get("/todos/reminders", authenticate, async (req, res) => {
    const { today } = req.query;
    if (!isNearToday(today)) {
      return fail(res, 400, "today must be a date near the current one (YYYY-MM-DD)");
    }
    try {
      const result = await pool.query(
        `SELECT todo_id, description, priority, category, recurrence,
                to_char(due_date, 'YYYY-MM-DD') AS due_date,
                CASE WHEN due_date < $2::date THEN 'overdue'
                     WHEN due_date = $2::date THEN 'today'
                     ELSE 'tomorrow' END AS bucket
           FROM todo
          WHERE user_id = $1 AND completed = FALSE AND due_date <= $2::date + 1
          ORDER BY due_date ASC, todo_id ASC`,
        [req.user.id, today]
      );
      const grouped = { overdue: [], today: [], tomorrow: [] };
      for (const { bucket, ...todo } of result.rows) grouped[bucket].push(todo);
      res.json(grouped);
    } catch (err) {
      return serverError(req, res, err, "reminders failed");
    }
  });

  app.post("/todos", authenticate, async (req, res) => {
    const { error, value } = validateTodo(req.body);
    if (error) return fail(res, 400, error);
    try {
      const result = await pool.query(
        "INSERT INTO todo (user_id, description, due_date, priority, category, completed, recurrence, position) VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(position), 0) + 1 FROM todo WHERE user_id = $1 AND parent_id IS NULL)) RETURNING *",
        [
          req.user.id,
          value.description,
          value.due_date,
          value.priority,
          value.category,
          value.completed,
          value.recurrence,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      return serverError(req, res, err, "create todo failed");
    }
  });

  // Top-level todos in the user's own order, each with its subtasks and their progress.
  app.get("/todos", authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM todo WHERE user_id = $1 ORDER BY position ASC NULLS LAST, todo_id ASC",
        [req.user.id]
      );
      const children = new Map();
      const todos = [];
      for (const row of result.rows) {
        if (row.parent_id === null) todos.push(row);
        else children.set(row.parent_id, [...(children.get(row.parent_id) || []), row]);
      }
      res.json(
        todos.map((todo) => {
          const subtasks = children.get(todo.todo_id) || [];
          const done = subtasks.filter((s) => s.completed).length;
          return { ...todo, subtasks, progress: { done, total: subtasks.length } };
        })
      );
    } catch (err) {
      return serverError(req, res, err, "list todos failed");
    }
  });

  // New order for some of the user's todos (or the subtasks of one parent): the ids take, in the order
  // sent, the positions those same ids hold now, so todos left out keep theirs.
  app.put("/todos/order", authenticate, async (req, res) => {
    const { error, value } = validateOrder(req.body);
    if (error) return fail(res, 400, error);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const held = await client.query(
        `SELECT position FROM todo
          WHERE user_id = $1 AND todo_id = ANY($2::int[]) AND parent_id IS NOT DISTINCT FROM $3::int
          ORDER BY position ASC NULLS LAST, todo_id ASC
            FOR UPDATE`,
        [req.user.id, value.ids, value.parentId]
      );
      if (held.rows.length !== value.ids.length) {
        await client.query("ROLLBACK");
        return fail(res, 404, "Todo not found");
      }
      const slots = held.rows.map((r) => r.position);
      await client.query(
        `UPDATE todo SET position = o.slot
           FROM unnest($2::int[], $3::int[]) AS o(id, slot)
          WHERE todo.todo_id = o.id AND todo.user_id = $1`,
        [req.user.id, value.ids, slots]
      );
      await client.query("COMMIT");
      res.json({ ordered: value.ids.length });
    } catch (err) {
      await client.query("ROLLBACK");
      return serverError(req, res, err, "reorder failed");
    } finally {
      client.release();
    }
  });

  app.put("/todos/:id", authenticate, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "Invalid todo id");
    const { error, value } = validateTodo(req.body);
    if (error) return fail(res, 400, error);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const before = await client.query(
        "SELECT completed FROM todo WHERE todo_id = $1 AND user_id = $2 AND parent_id IS NULL FOR UPDATE",
        [id, req.user.id]
      );
      if (before.rows.length === 0) {
        await client.query("ROLLBACK");
        return fail(res, 404, "Todo not found");
      }
      const result = await client.query(
        "UPDATE todo SET description = $1, due_date = $2, priority = $3, category = $4, completed = $5, recurrence = $6 WHERE todo_id = $7 AND user_id = $8 AND parent_id IS NULL RETURNING *",
        [
          value.description,
          value.due_date,
          value.priority,
          value.category,
          value.completed,
          value.recurrence,
          id,
          req.user.id,
        ]
      );
      const todo = result.rows[0];
      let next = null;
      // Ticking a repeating todo done creates the next one, unless an identical
      // open one already exists (untick and tick again must not pile them up).
      if (value.recurrence && value.completed && !before.rows[0].completed) {
        const nextDue = nextDueDate(value.due_date, value.recurrence);
        const created = await client.query(
          `INSERT INTO todo (user_id, description, due_date, priority, category, completed, recurrence, position)
           SELECT $1::int, $2::varchar, $3::date, $4::varchar, $5::varchar, FALSE, $6::varchar,
                  (SELECT COALESCE(MAX(position), 0) + 1 FROM todo WHERE user_id = $1 AND parent_id IS NULL)
            WHERE NOT EXISTS (
              SELECT 1 FROM todo
               WHERE user_id = $1 AND description = $2 AND due_date = $3
                 AND recurrence = $6 AND completed = FALSE)
           RETURNING *`,
          [
            req.user.id,
            value.description,
            nextDue,
            value.priority,
            value.category,
            value.recurrence,
          ]
        );
        next = created.rows[0] || null;
      }
      await client.query("COMMIT");
      res.json(next ? { ...todo, next } : todo);
    } catch (err) {
      await client.query("ROLLBACK");
      return serverError(req, res, err, "update todo failed");
    } finally {
      client.release();
    }
  });

  app.post("/todos/:id/subtasks", authenticate, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "Invalid todo id");
    const { error, value } = validateSubtask(req.body);
    if (error) return fail(res, 400, error);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const parent = await client.query(
        "SELECT parent_id FROM todo WHERE todo_id = $1 AND user_id = $2 FOR UPDATE",
        [id, req.user.id]
      );
      if (parent.rows.length === 0) {
        await client.query("ROLLBACK");
        return fail(res, 404, "Todo not found");
      }
      if (parent.rows[0].parent_id !== null) {
        await client.query("ROLLBACK");
        return fail(res, 400, "A subtask cannot have subtasks");
      }
      const result = await client.query(
        `INSERT INTO todo (user_id, parent_id, description, position)
         SELECT $1::int, $2::int, $3::varchar, COALESCE(MAX(position), 0) + 1
           FROM todo WHERE parent_id = $2
         HAVING COUNT(*) < $4
         RETURNING *`,
        [req.user.id, id, value.description, MAX_SUBTASKS]
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return fail(res, 400, `A todo can have at most ${MAX_SUBTASKS} subtasks`);
      }
      await client.query("COMMIT");
      res.status(201).json(result.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      return serverError(req, res, err, "create subtask failed");
    } finally {
      client.release();
    }
  });

  app.patch("/subtasks/:id", authenticate, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "Invalid subtask id");
    const { error, value } = validateSubtaskPatch(req.body);
    if (error) return fail(res, 400, error);
    try {
      const result = await pool.query(
        `UPDATE todo SET description = COALESCE($1, description), completed = COALESCE($2, completed)
          WHERE todo_id = $3 AND user_id = $4 AND parent_id IS NOT NULL RETURNING *`,
        [value.description ?? null, value.completed ?? null, id, req.user.id]
      );
      if (result.rows.length === 0) return fail(res, 404, "Subtask not found");
      res.json(result.rows[0]);
    } catch (err) {
      return serverError(req, res, err, "update subtask failed");
    }
  });

  app.delete("/todos/:id", authenticate, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "Invalid todo id");
    try {
      const result = await pool.query(
        "DELETE FROM todo WHERE todo_id = $1 AND user_id = $2 RETURNING todo_id",
        [id, req.user.id]
      );
      if (result.rows.length === 0) return fail(res, 404, "Todo not found");
      res.json({ deleted: id });
    } catch (err) {
      return serverError(req, res, err, "delete todo failed");
    }
  });

  app.get("/export", authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT description, due_date, priority, category, completed, recurrence FROM todo WHERE user_id = $1 AND parent_id IS NULL ORDER BY todo_id",
        [req.user.id]
      );
      res.json(result.rows);
    } catch (err) {
      return serverError(req, res, err, "export failed");
    }
  });

  app.post("/import", authenticate, async (req, res) => {
    const todos = req.body && req.body.todos;
    if (!Array.isArray(todos) || todos.length === 0 || todos.length > MAX_IMPORT) {
      return fail(res, 400, `todos must be a list of 1 to ${MAX_IMPORT} items`);
    }
    const values = [];
    for (let i = 0; i < todos.length; i++) {
      const { error, value } = validateTodo(todos[i]);
      if (error) return fail(res, 400, `Item ${i + 1}: ${error}`);
      values.push(value);
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const v of values) {
        await client.query(
          "INSERT INTO todo (user_id, description, due_date, priority, category, completed, recurrence, position) VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(position), 0) + 1 FROM todo WHERE user_id = $1 AND parent_id IS NULL))",
          [
            req.user.id,
            v.description,
            v.due_date,
            v.priority,
            v.category,
            v.completed,
            v.recurrence,
          ]
        );
      }
      await client.query("COMMIT");
      res.status(201).json({ imported: values.length });
    } catch (err) {
      await client.query("ROLLBACK");
      return serverError(req, res, err, "import failed");
    } finally {
      client.release();
    }
  });

  app.use(docsRouter());

  app.use((req, res) => fail(res, 404, "Not found"));

  // Malformed JSON and anything unexpected: no stack traces to the caller.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return fail(res, 400, "Malformed JSON");
    if (err.type === "entity.too.large") return fail(res, 413, "Request too large");
    return serverError(req, res, err, "unhandled error");
  });

  return app;
}

module.exports = { createApp };
