# Taskora — System Architecture

This document explains how Taskora is put together: how data flows between layers, how authentication works end to end, how the database is structured, and how the deployed system fits together. It's written for someone evaluating the project technically — an interviewer, a future contributor, or future-me revisiting this after a few months away.

For AI-specific architecture (prompts, validation, provider abstraction), see [`AI-ARCHITECTURE.md`](./AI-ARCHITECTURE.md).

---

## High-Level Overview

```
Browser (Vercel-hosted static frontend)
        │
        │  fetch(), credentials: 'include'
        ▼
Express API (Render)
        │
        ├──► PostgreSQL (Neon) — users, tasks, activity
        │
        └──► Google Gemini API — AI features only, backend-initiated
```

Three independently deployed pieces, each replaceable without touching the others:
- **Frontend** is a static site — no server-side rendering, no build step. It can be redeployed or even swapped for a different host without any backend change, since the only coupling point is a single configured API base URL.
- **Backend** is a single Express process. It owns all business logic, all database access, and all AI orchestration — the frontend never talks to the database or to Gemini directly.
- **Database** is a managed Postgres instance, reachable only from the backend (the frontend has no credentials to it, by design).

This is a monolithic backend, not microservices — deliberately. At this scale (a handful of resources: users, tasks, activity, and now AI features layered on top), splitting into separate services would add deployment complexity and network calls without a corresponding benefit. The `services/ai/` module is internally separated for a similar reason discussed below, without needing to become a separate deployed service.

---

## Request/Data Flow

A typical authenticated request (e.g. loading tasks):

1. Browser sends `GET /api/tasks` with the session cookie attached (`credentials: 'include'`)
2. Express's `requireAuth` middleware verifies the JWT from the cookie, extracting `userId` and attaching it to `req`
3. The route handler queries Postgres, always filtering by `WHERE user_id = $1` using the ID from the verified token — never from anything the client sent in the request body or query string
4. Postgres returns rows; the handler maps column names back into the JSON shape the frontend expects
5. Response goes back to the browser; the frontend renders it

The consistent rule throughout: **the identity used to scope every query comes from the verified token, never from client-supplied data.** This is what makes cross-user data access structurally difficult rather than just "checked for" — there's no code path where a user ID from the request body ever reaches a `WHERE` clause.

---

## Authentication Flow

1. **Register:** email + password submitted → password hashed with bcrypt → user row inserted → JWT signed (containing `userId`, `email`) → set as an httpOnly cookie → response sent
2. **Login:** email looked up → bcrypt compares the submitted password against the stored hash → same JWT issuance and cookie-setting as register → deliberately generic error message on any failure (unknown email and wrong password return the identical response, to avoid confirming which accounts exist)
3. **Every subsequent request:** the browser automatically attaches the cookie (it's httpOnly, so JavaScript never touches it directly) → `requireAuth` verifies the JWT signature and expiry → attaches `userId`/`email` to `req` for the route handler to use
4. **Logout:** cookie is cleared server-side

### Why httpOnly cookies over `localStorage`

A token in `localStorage` is readable by any JavaScript running on the page — including injected scripts from an XSS vulnerability. An httpOnly cookie is invisible to JavaScript entirely; only the browser can read and send it. This trades one risk (XSS token theft) for a different, generally more manageable one (CSRF), which is mitigated here by `sameSite` cookie settings rather than a separate CSRF token scheme — a deliberate scope decision appropriate for this app's size.

### Cookie configuration is environment-aware

| | Local development | Production |
|---|---|---|
| `secure` | `false` | `true` |
| `sameSite` | `'lax'` | `'none'` |

Locally, frontend and backend are both `127.0.0.1` (different ports, same host) — a same-site context where `lax` works fine and `secure` isn't needed since there's no HTTPS. In production, Vercel and Render are genuinely different origins over HTTPS — `sameSite: 'none'` is required for the cookie to be sent cross-site at all, and browsers require `secure: true` to be paired with it. This distinction is driven by `NODE_ENV`, set automatically by each environment (`development` locally, `production` on Render).

---

## Database

### Schema

```
users
├── id (UUID, PK)
├── email (unique)
├── password_hash
└── created_at

tasks
├── id (UUID, PK)
├── user_id (FK → users.id, ON DELETE CASCADE, indexed)
├── title, category, priority, status
├── due_date, labels, notes
├── created_at, updated_at

activity
├── id (UUID, PK)
├── user_id (FK → users.id, ON DELETE CASCADE, indexed)
├── message
└── timestamp
```

### Why Postgres, and why this schema shape

The project started on local SQL Server and was deliberately migrated to managed PostgreSQL (Neon) for deployment — SQL Server has no realistic free managed-hosting option, so this wasn't optional once cloud deployment was the goal. The migration meant re-expressing `NEWID()`/`UNIQUEIDENTIFIER`/`DATETIME2`/`OUTPUT INSERTED.*` in Postgres equivalents (`gen_random_uuid()`/`UUID`/`TIMESTAMPTZ`/`RETURNING`), and switching from named (`@Param`) to positional (`$1`) parameter binding.

Deliberately no ORM. With three tables and a small, stable query set, a thin `pg` query layer stayed more transparent and easier to reason about than an ORM's abstraction would have been — every query in the codebase is plain, readable SQL.

Column names in the query results are aliased back to capitalized keys (e.g. `title AS "Title"`) specifically so the migration didn't require any frontend changes — the API's JSON shape stayed identical across the entire database swap.

---

## Deployment Architecture

```
GitHub (single repo, frontend/ and backend/ as sibling folders)
   │
   ├──► Vercel — watches frontend/, deploys static files on push
   │
   └──► Render — watches backend/, runs `npm install` + `npm start` on push
                     │
                     ├──► DATABASE_URL → Neon Postgres
                     └──► GEMINI_API_KEY → Google Gemini API
```

Both platforms deploy automatically on every push to `main` — no manual deploy step, no CLI required day-to-day. Environment-specific values (database connection string, JWT secret, Gemini key, allowed frontend origin) live entirely in each platform's dashboard, never in the repository.

### A note on the free-tier tradeoff

Render's free web services spin down after 15 minutes of inactivity; the next request triggers a cold start (30–60 seconds). This is a known, accepted tradeoff for a zero-cost portfolio deployment — the alternative (a paid always-on tier) wasn't necessary for this project's purpose, but it's worth naming explicitly rather than pretending the deployed app behaves identically to a production system with real, continuous traffic.

---

## Error Handling Philosophy

Every route follows the same pattern: catch errors, log the real detail server-side (`console.error`), return a generic, safe message to the client (`"Failed to update task"`, not the underlying Postgres error text). This was specifically tested — a malformed task ID that causes a Postgres type error returns a clean 500 with no leaked SQL or stack trace, confirmed by both an automated test and a live manual check against the deployed API.

The same philosophy extends to AI failures: if Gemini is unreachable or errors out, the response is a calm `"AI is temporarily unavailable. Your Taskora data is safe."` — the core task manager keeps functioning regardless of AI availability, by design, not by accident.
