# todo-app-pern

A todo app with accounts: register, log in, then add, edit, complete, delete, export and import your own tasks. PERN stack: PostgreSQL, Express, React, Node.

Last updated: 2026-10-16. Status: runs locally (baseline), not deployed yet.

## Why it exists

A first full-stack project: a REST API with JWT login and per-user data, a React client and a relational schema. It is being brought up to production grade one step at a time (see Status and roadmap).

## Features

- Register and log in; passwords are hashed with bcrypt, logins are JWTs that expire.
- Todos have a description, due date, priority (Low, Medium, High), category and a done flag; each user sees only their own.
- Export your todos as JSON and import them back.

## Tech stack

| Part | Technology |
|---|---|
| Client | React 18 (Create React App), Bootstrap |
| API | Node 22, Express 4, pg, bcrypt, jsonwebtoken |
| Database | PostgreSQL 16 (Docker locally) |

## Run locally

Needs Node 22 (`mise.toml` pins it; `mise install`) and Docker.

```bash
git clone https://github.com/A-RYAN-1/todo-app-pern.git
cd todo-app-pern

# 1. Database (creates the tables from server/database.sql on first start)
docker compose up -d

# 2. API on http://localhost:5000
cd server
cp .env.example .env        # then set JWT_SECRET, see Environment variables
npm install
npm start

# 3. Client on http://localhost:3000 (second terminal)
cd client
cp .env.example .env
npm install
npm start
```

Check the API: `curl http://localhost:5000/health` returns `{"status":"ok"}`.

## Environment variables

API (`server/.env`, template `server/.env.example`):

| Variable | Needed | What it is |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string; the default matches `docker-compose.yml` |
| `DATABASE_SSL` | no | `true` for hosted databases that require TLS |
| `JWT_SECRET` | yes | Signing secret, 32+ characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_EXPIRES_IN` | no | Login lifetime, default `7d` |
| `PORT` | no | API port, default `5000` |
| `CORS_ORIGIN` | no | Client origin allowed to call the API, default `http://localhost:3000` |

Client (`client/.env`, template `client/.env.example`): `REACT_APP_API_URL`, the API base URL, default `http://localhost:5000`.

## API

All routes except `/health`, `/register` and `/login` need the token from `/login` in the `authorization` header.

| Method and path | What it does |
|---|---|
| `GET /health` | Database check |
| `POST /register` | Create an account (username 3-50, password 8-72 characters) |
| `POST /login` | Returns `{ token }` |
| `GET /todos`, `POST /todos` | List or create your todos |
| `PUT /todos/:id`, `DELETE /todos/:id` | Update or delete one of your todos |
| `GET /export`, `POST /import` | Export or import your todos as JSON |

## Engineering quality (tests, CI, security)

- Secrets come from environment variables only; no `.env` is tracked.
- Queries are parameterised; every todo query is scoped to the logged-in user.
- No tests and no CI yet (next iteration).

## Deployment

Not deployed. The earlier hosting (Vercel, Render, Supabase) was removed on 2026-10-16. Plan: Vercel for the client, Render free web service for the API, Neon free Postgres.

## Status and roadmap

- [x] Runs locally from this README (2026-10-16)
- [x] Config in environment variables, secrets untracked, token expiry, input validation on register
- [ ] API tests and CI
- [ ] Validation on every route, rate limiting on login, security headers
- [ ] Deploy on free tiers and add screenshots

## Credits

Built by Aryan Deshmukh.
