<p align="center">
  <img src="docs/images/logo.svg" width="88" alt="todo-app-pern logo">
</p>

<h1 align="center">todo-app-pern</h1>

<p align="center">
  A todo app with accounts: PostgreSQL, Express, React and Node, deployed on free tiers.<br>
  Log in, add tasks with a due date, priority and category, tick them off, filter, and export or import them as JSON.
</p>

<p align="center">
  <a href="https://todo-app-pern-gamma.vercel.app"><strong>Live demo</strong></a>
  &middot;
  <a href="#try-it-live">Demo login</a>
  &middot;
  <a href="#how-it-works">How it works</a>
  &middot;
  <a href="#run-it-locally">Run locally</a>
  &middot;
  <a href="#api-reference">API reference</a>
</p>

<p align="center">
  <a href="https://github.com/A-RYAN-1/todo-app-pern/actions/workflows/ci.yml"><img src="https://github.com/A-RYAN-1/todo-app-pern/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/A-RYAN-1/todo-app-pern/actions/workflows/uptime.yml"><img src="https://github.com/A-RYAN-1/todo-app-pern/actions/workflows/uptime.yml/badge.svg" alt="Uptime"></a>
  <img src="https://img.shields.io/badge/Node-22-5FA04E?logo=nodedotjs&logoColor=white" alt="Node 22">
  <img src="https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white" alt="Express 4">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React 18">
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 3">
  <img src="https://img.shields.io/badge/Vercel-client-000000?logo=vercel&logoColor=white" alt="Vercel">
  <img src="https://img.shields.io/badge/Render-API-46E3B7?logo=render&logoColor=black" alt="Render">
  <img src="https://img.shields.io/badge/Neon-database-00E599?logo=neon&logoColor=black" alt="Neon">
</p>

<p align="center">
  <a href="https://todo-app-pern-gamma.vercel.app">
    <img src="docs/images/list.png" width="90%" alt="The todo list: add form, search and filters, and tasks with due dates, priority and category tags">
  </a>
</p>

<p align="center"><sub>Last updated: 2026-10-17 &middot; Live on free tiers (Vercel, Render, Neon), production-grade checklist done</sub></p>

---

## Contents

- [About](#about)
- [Try it live](#try-it-live)
- [Features](#features)
- [Why it exists](#why-it-exists)
- [How it works](#how-it-works)
- [API reference](#api-reference)
- [Engineering quality](#engineering-quality)
- [Run it locally](#run-it-locally)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Status and roadmap](#status-and-roadmap)
- [Credits](#credits)

## About

A todo list is only useful if it is yours and it is there when you come back. This app gives every person their own account and list: tasks carry a due date, a priority (Low, Medium, High) and a category, overdue ones are outlined in red, and the list can be searched and filtered.

Around that core sit the parts a real service needs: passwords stored as bcrypt hashes, logins that expire, per-user data isolation enforced in every SQL query, input validation on every route, a login rate limit, a health endpoint, an uptime check and a test suite that runs on every push.

## Try it live

Open **https://todo-app-pern-gamma.vercel.app** and sign in:

| Username | Password |
|---|---|
| `demo` | `demo-pass-123` |

This is a public demo account; anything you add there is visible to other visitors, so use your own account (Register on the login page) for anything else. The API runs on Render's free tier and sleeps when idle: the first request after a quiet period takes up to a minute.

Things to try in the first two minutes:

1. Tick **Review the pull request on the API** off and back on: the request goes to `PUT /todos/:id` and the list reloads from the database.
2. Type `re` in the search box and set the priority filter to High: the list narrows on the client.
3. Click the pencil on **Book a dentist appointment**, change the priority and save.
4. Press **Export Todos** to download your list as JSON, then **Import Todos** with the same file to add it back (all or nothing: one bad item rejects the whole file).
5. Log out, then register a new user: you start with an empty list and cannot see the demo user's tasks.

<table>
  <tr>
    <td width="50%"><img src="docs/images/login.png" alt="The login and register page"><p align="center"><sub>Login and register, with the server's message on a failure (<a href="#api-reference">API reference</a>)</sub></p></td>
    <td width="50%"><img src="docs/images/filtered.png" alt="The list filtered to high priority tasks matching the search text"><p align="center"><sub>Search and priority filter (<a href="#features">features</a>)</sub></p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/edit.png" alt="A task open for editing inline, with description, date, priority and category fields"><p align="center"><sub>Inline editing (<a href="#how-it-works">how it works</a>)</sub></p></td>
    <td width="50%"><img src="docs/images/list.png" alt="The full list with one task ticked off"><p align="center"><sub>A completed task struck through (<a href="#engineering-quality">tests</a>)</sub></p></td>
  </tr>
</table>

<sub>Screenshots taken from the live site on 2026-10-17 with the demo account.</sub>

## Features

- **Accounts**: register and log in; passwords are hashed with bcrypt; a login is a signed token that expires (7 days by default).
- **Private lists**: every query is scoped to the logged-in user; another user's todo id returns 404, not their data.
- **Tasks**: description, due date, priority, category and a done flag; create, edit, tick, delete.
- **Search and filters**: by text, priority and category.
- **Overdue and due-soon markers**: overdue tasks get a red outline, tasks due within a day get a badge, and the browser can show a notification if you have already allowed notifications for the site.
- **Export and import**: your todos as JSON; import is validated item by item and applied in one transaction.
- **Operations**: `/health` checks the database, requests carry an id, logs are JSON lines.

## Why it exists

A first full-stack project: a relational schema, a REST API with token login and a React client. It is being used as a worked example of taking a small app from "runs on my machine" to something deployed, tested and monitored, and the history shows each step: secrets out of the repo, then the deploy, then validation, tests, CI and an audit-clean dependency tree.

## How it works

```mermaid
flowchart LR
    U[Browser] -->|HTTPS| V
    subgraph V[Vercel - free]
        C[React client<br/>static Vite build]
    end
    U -->|fetch + token| R
    subgraph R[Render - free]
        A[Express API<br/>helmet, rate limit, validation]
    end
    A -->|pg, TLS| N[(Neon Postgres<br/>free)]
    G[GitHub Actions<br/>CI + uptime check] -.->|tests, health ping| A
```

What happens when you tick a task (`PUT /todos/:id`):

```mermaid
sequenceDiagram
    actor User
    participant Client as React client
    participant API as Express API
    participant DB as PostgreSQL
    User->>Client: tick the checkbox
    Client->>API: PUT /todos/12 (authorization token, full todo with completed flipped)
    API->>API: verify token, validate id and body
    API->>DB: UPDATE todo ... WHERE todo_id = 12 AND user_id = token user
    DB-->>API: updated row, or none
    API-->>Client: 200 todo, or 404 if it is not yours
    Client->>API: GET /todos
    API-->>Client: the list, ordered by due date
```

Both queries carry `user_id` from the verified token, so a todo that belongs to someone else behaves exactly like one that does not exist.

### Tech stack

| Layer | Technology |
|---|---|
| API | Node 22, Express 4, `pg`, bcrypt, jsonwebtoken, helmet, express-rate-limit |
| Database | PostgreSQL 16 (Docker locally, Neon in production) |
| Client | React 18, Vite 8, Tailwind CSS 3 compiled at build time |
| Tests and checks | `node:test` and supertest (API), Vitest and Testing Library (client), ESLint, Prettier |
| CI and monitoring | GitHub Actions: CI on every push, an uptime check every 30 minutes |
| Hosting | Vercel (client), Render free web service (API), Neon free Postgres |
| Local setup | Docker Compose for Postgres, `mise.toml` pins Node 22 |

### Design decisions

1. **Validation lives in one module** (`server/validation.js`) that returns either an error message or a normalised value, so every route, including import, applies the same rules and the rules are unit-tested without a database. Trade-off: hand-written rules instead of a schema library; fine for four fields, would not scale to many.
2. **Wrong password and unknown user get the same 401**, and both go through the same rate limit, so the login route does not reveal which usernames exist. Trade-off: slightly less helpful error text.
3. **Import is one transaction.** A 300-item file with a bad item 200 changes nothing, instead of leaving half a list. Trade-off: the whole request is held in memory (capped at 500 items and 200 kB).
4. **DATE columns are returned as plain `YYYY-MM-DD` strings.** The default driver behaviour builds a local-time `Date`, and JSON serialisation then shifts the day by the server's timezone offset. Trade-off: the string is not a `Date` object in server code, which nothing needs.
5. **Tests run against a real PostgreSQL**, not a mock: the queries and the per-user scoping are the point of the app. Trade-off: the API tests need a database (Docker Compose locally, a service container in CI).

<details>
<summary><strong>Project structure</strong></summary>

```
server/
  app.js          routes, middleware, error handling (createApp)
  validation.js   input rules for credentials, todos and ids
  config.js       reads and checks environment variables
  logger.js       JSON log lines
  index.js        starts the server
  migrate.js      applies database.sql (idempotent)
  seed.js         creates the demo account
  database.sql    schema
  test/           unit tests (validation) and API tests (real database)
client/
  src/App.jsx             state, filters, export and import
  src/components/         Login, InputTodo, ListTodos, EditTodo, Icon
  src/api.js, config.js   auth header, error messages, API URL
  src/App.test.jsx        client tests
docker-compose.yml        local Postgres with the schema loaded
.github/workflows/        ci.yml, uptime.yml
docs/images/              screenshots used in this README
```

</details>

## API reference

Every route except `/health`, `/register` and `/login` needs the token from `/login` in the `authorization` header (a `Bearer ` prefix is accepted). Errors are JSON: `{ "error": "message" }`.

| Method and path | What it does | Success | Failures |
|---|---|---|---|
| `GET /health` | Database check | 200 `{status}` | 503 |
| `POST /register` | Create an account: username 3-50, password 8-72 characters | 201 `{user_id, username}` | 400, 409 taken, 429 |
| `POST /login` | Exchange credentials for a token | 200 `{token}` | 400, 401, 429 |
| `GET /todos` | Your todos, by due date | 200 list | 401 |
| `POST /todos` | Create: `description` (1-300), optional `due_date` (`YYYY-MM-DD`), `priority` (Low, Medium, High), `category` (up to 50), `completed` | 201 todo | 400, 401 |
| `PUT /todos/:id` | Replace the editable fields of one of your todos | 200 todo | 400, 401, 404 |
| `DELETE /todos/:id` | Delete one of your todos | 200 `{deleted}` | 400, 401, 404 |
| `GET /export` | Your todos without ids | 200 list | 401 |
| `POST /import` | `{ "todos": [...] }`, 1 to 500 items, all or nothing | 201 `{imported}` | 400, 401 |

## Engineering quality

| Area | What is in place |
|---|---|
| Tests | 21 server tests (9 unit tests for validation, 12 API tests against Postgres: auth, validation, per-user isolation, import rollback, rate limit, health) and 5 client tests (login errors, token storage, ticking a task, expired token). All passing on 2026-10-17. |
| CI | GitHub Actions on every push and pull request: ESLint, Prettier, migrations, tests and `npm audit` for the API; ESLint, Prettier, tests, build and `npm audit` for the client. |
| Monitoring | An uptime workflow requests `/health` and the client every 30 minutes; a failure emails the repository owner. |
| Security | Passwords hashed with bcrypt, tokens expire, helmet headers, CORS limited to the client origin, login and register rate limited, every query parameterised and scoped to the user, secrets only from the environment. `npm audit` for production dependencies: 0 vulnerabilities on 2026-10-17 (server and client). |
| Logs | One JSON line per request (id, method, path, status, duration) and per error (id, code); no passwords, tokens or todo text. |
| Measured | Lighthouse on the live login page, 2026-10-17: mobile 99 performance, 100 accessibility, 100 best practices, 100 SEO (LCP 1.5 s); desktop 100 in all four (LCP 0.3 s). The logged-in screens were not audited. |

Run them:

```bash
docker compose up -d                  # Postgres for the API tests
cd server && npm ci && npm run lint && npm test
cd ../client && npm ci && npm run lint && npm test
```

## Run it locally

Works on Windows (Git Bash), macOS and Linux. You need **Node 22** (pinned in `mise.toml`; `mise install` picks it up) and **Docker** (for PostgreSQL).

```bash
git clone https://github.com/A-RYAN-1/todo-app-pern.git
cd todo-app-pern

# 1. Database: starts Postgres 16 and loads server/database.sql on first start
docker compose up -d

# 2. API on http://localhost:5000
cd server
cp .env.example .env     # set JWT_SECRET, see Environment variables
npm install
npm run seed             # optional: demo / demo-pass-123 with two todos
npm start

# 3. Client on http://localhost:3000 (second terminal, from the repo root)
cd client
cp .env.example .env
npm install
npm run dev
```

It is ready when this returns `{"status":"ok"}`:

```bash
curl http://localhost:5000/health
```

<details>
<summary><strong>Common problems</strong></summary>

- `Missing required environment variable JWT_SECRET`: copy `server/.env.example` to `server/.env` and set a value of 32 or more characters.
- `ECONNREFUSED 127.0.0.1:5432`: Postgres is not running; start Docker and run `docker compose up -d`.
- `relation "users" does not exist`: the schema was not loaded (an old volume); run `cd server && npm run migrate`.
- The page loads but every request fails with a CORS error: `CORS_ORIGIN` in `server/.env` must match the address the client is served from (default `http://localhost:3000`).

</details>

<details>
<summary><strong>Without Docker</strong></summary>

Install PostgreSQL 16, create a database, run `psql <database> -f server/database.sql`, and put its connection string in `DATABASE_URL` in `server/.env`.

</details>

## Environment variables

API (`server/.env`, template `server/.env.example`):

| Variable | What it is | Local value / Needed |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | `postgres://postgres:postgres@localhost:5432/todos` locally; the Neon string in production (required) |
| `DATABASE_SSL` | `true` for hosts that require TLS | `false` locally, `true` on Neon |
| `JWT_SECRET` | Token signing secret, 32 or more characters | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (required) |
| `JWT_EXPIRES_IN` | Login lifetime | `7d` |
| `PORT` | API port | `5000` |
| `CORS_ORIGIN` | The client origin allowed to call the API | `http://localhost:3000`; the Vercel URL in production |

Client (`client/.env`, template `client/.env.example`):

| Variable | What it is | Local value / Needed |
|---|---|---|
| `VITE_API_URL` | API base URL, no trailing slash, read at build time | `http://localhost:5000`; the Render URL in production |

Never commit a real `.env` file; only the `.example` files are tracked.

## Deployment

Everything runs on free tiers. Pushing to `main` deploys both parts.

| Part | Host | Deploys | Variables the host needs |
|---|---|---|---|
| Client | Vercel Hobby, project `todo-app-pern`, root directory `client`, framework Vite | On push to `main` | `VITE_API_URL` |
| API | Render free web service `todo-app-pern-api`, root directory `server`, Singapore | On push to `main`; build runs `npm ci && npm run migrate`, health check on `/health` | `DATABASE_URL`, `DATABASE_SSL`, `JWT_SECRET`, `CORS_ORIGIN`, `NODE_VERSION` |
| Database | Neon free Postgres in Singapore, created through Vercel Storage | Schema applied by `npm run migrate` on every API build | none |

Free-tier limits a visitor notices (checked 2026-10-17): Render's free service sleeps after 15 minutes without traffic, so the first request takes up to a minute; Neon suspends an idle database and wakes it on the next query.

<details>
<summary><strong>Recreate the deploy from nothing</strong></summary>

1. Create a Neon database and copy its direct connection string.
2. Render: new web service from this repo, root directory `server`, runtime Node, plan Free, build command `npm ci && npm run migrate`, start command `node index.js`, health check path `/health`, and the variables above.
3. Vercel: import the repo, root directory `client`, framework Vite, install `npm ci`, build `npm run build`, output `dist`, and `VITE_API_URL` set to the Render URL.
4. Set `CORS_ORIGIN` on Render to the Vercel URL and redeploy the API.
5. Optional: `npm run seed` against the production database for the demo account.

</details>

## Status and roadmap

**Reached:** live on free tiers since 2026-10-16 and through the production-grade checklist on 2026-10-17: validation, tests and CI, security headers and rate limit, audit-clean dependencies, uptime check, measured Lighthouse scores. Checked on the live site on 2026-10-17 in a real browser: login, listing, ticking and unticking a task, the search and priority filter, opening the inline editor and the validation message on a too-short description; and the API from the Vercel origin.

**Known limitations**

- Tokens are kept in `localStorage`, so a script injected into the page could read them; there is no refresh token or "log out everywhere".
- No password reset and no email: a forgotten password cannot be recovered.
- Rate limiting covers login and register only, and counts per IP address.
- The category list in the UI is fixed (Work, Personal, Shopping) while the API accepts any text up to 50 characters.
- Lighthouse was run on the login page only; the logged-in screens are not audited.

**Planned**

- [ ] Move the token to an httpOnly cookie
- [ ] Per-user rate limit on todo routes
- [ ] Custom categories
- [ ] Lighthouse for the logged-in screens

## Credits

Built by [Aryan Deshmukh](https://github.com/A-RYAN-1).
