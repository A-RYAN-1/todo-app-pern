const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const pool = require("./connect_server_and_database");
const { JWT_SECRET, JWT_EXPIRES_IN, CORS_ORIGIN } = require("./config");
const { validateCredentials, validateTodo, parseId } = require("./validation");
const logger = require("./logger");

const MAX_IMPORT = 500;

function createApp({ authLimit = 20 } = {}) {
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

  app.post("/todos", authenticate, async (req, res) => {
    const { error, value } = validateTodo(req.body);
    if (error) return fail(res, 400, error);
    try {
      const result = await pool.query(
        "INSERT INTO todo (user_id, description, due_date, priority, category, completed) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          req.user.id,
          value.description,
          value.due_date,
          value.priority,
          value.category,
          value.completed,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      return serverError(req, res, err, "create todo failed");
    }
  });

  app.get("/todos", authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM todo WHERE user_id = $1 ORDER BY due_date ASC NULLS LAST, todo_id ASC",
        [req.user.id]
      );
      res.json(result.rows);
    } catch (err) {
      return serverError(req, res, err, "list todos failed");
    }
  });

  app.put("/todos/:id", authenticate, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "Invalid todo id");
    const { error, value } = validateTodo(req.body);
    if (error) return fail(res, 400, error);
    try {
      const result = await pool.query(
        "UPDATE todo SET description = $1, due_date = $2, priority = $3, category = $4, completed = $5 WHERE todo_id = $6 AND user_id = $7 RETURNING *",
        [
          value.description,
          value.due_date,
          value.priority,
          value.category,
          value.completed,
          id,
          req.user.id,
        ]
      );
      if (result.rows.length === 0) return fail(res, 404, "Todo not found");
      res.json(result.rows[0]);
    } catch (err) {
      return serverError(req, res, err, "update todo failed");
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
        "SELECT description, due_date, priority, category, completed FROM todo WHERE user_id = $1 ORDER BY todo_id",
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
          "INSERT INTO todo (user_id, description, due_date, priority, category, completed) VALUES ($1, $2, $3, $4, $5, $6)",
          [req.user.id, v.description, v.due_date, v.priority, v.category, v.completed]
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
