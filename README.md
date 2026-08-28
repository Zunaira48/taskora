# Taskora

**AI-Powered Personal Productivity Platform**

Live app: [taskora-tau-wine.vercel.app](https://taskora-tau-wine.vercel.app)
API: [taskora-backend-f2ir.onrender.com](https://taskora-backend-f2ir.onrender.com)

> Note: the backend runs on Render's free tier, which spins down after 15 minutes of inactivity. The first request after a period of idle time may take 30–60 seconds while it cold-starts — this is expected, not a bug.

---

## Overview

Taskora is a full-stack task manager built around a simple idea: **a to-do app shouldn't just store tasks — it should understand your workload and help you decide what to do next.**

Most task managers are passive containers. You put things in, you take things out, and the app never actually helps you *think*. Taskora adds an AI layer on top of a solid, conventional task manager — one that breaks down vague goals into concrete steps, extracts structured tasks from plain language, recommends priorities with real reasoning, plans your day around what's actually due, and answers direct questions about your own workload through a conversational assistant.

The AI is deliberately scoped as a productivity layer, not a general-purpose chatbot glued on for novelty — every AI feature is grounded in the user's real task data, fetched server-side and scoped to that user alone.

---

## Key Features

- Full task CRUD — title, category, priority, status, due date, labels, freeform notes
- Kanban-style task board (To do / In progress / Done)
- Dashboard with live stats (total, completed, in progress, overdue) and a recent activity feed
- Calendar view with tasks plotted by due date
- Statistics page (completion rate, breakdowns by priority and category)
- Dark mode
- Browser notifications for due/overdue tasks
- Responsive layout with a mobile hamburger nav and swipeable task board
- Graceful backend-unavailable handling — the core app keeps working even if the API or AI is temporarily down

## AI Capabilities

| Feature | What it does |
|---|---|
| **AI Task Breakdown** | Turn a vague task into 4–8 concrete subtasks; review and select which ones to add |
| **AI Smart Task Creation** | Describe a task in plain language ("finish the migration by Friday, it's urgent") and get structured title/category/priority/due date/labels — reviewed before anything is saved |
| **AI Priority Recommendation** | For an existing task, get a suggested priority with a stated reason, based on due date, status, and context — accept or dismiss |
| **AI Plan My Day** | An ordered, reasoned plan pulled from your actual open tasks, prioritizing overdue and due-soon items |
| **AI Copilot** | A conversational assistant grounded in your real task data — ask "what should I work on now," "what am I behind on," or follow-up questions in context |

Every AI feature follows the same safety principle: **AI proposes, the user confirms.** Nothing is created or modified automatically — every suggestion is shown for review before it touches real data.

---

## Architecture

```
Browser
  │
  ▼
Vercel (static frontend — HTML/CSS/vanilla JS)
  │  fetch, credentials: include
  ▼
Render (Express API)
  │                         │
  ▼                         ▼
Neon PostgreSQL      Google Gemini API
(tasks, users,       (gemini-3.1-flash-lite,
 activity)             backend-only, key never
                        exposed to the client)
```

The frontend never talks to Gemini directly — every AI request goes through the backend, which fetches the relevant task context itself (never trusting whatever the client claims about task state), sends a scoped prompt, and validates the response before it reaches the browser.

## Tech Stack

**Frontend:** HTML, CSS, vanilla JavaScript — no framework, no build step, no bundler
**Backend:** Node.js, Express
**Database:** PostgreSQL, hosted on Neon
**AI:** Google Gemini API (`gemini-3.1-flash-lite`) via the official `@google/genai` SDK
**Auth:** JWT in an httpOnly cookie, bcrypt password hashing
**Testing:** Jest + Supertest
**Deployment:** Vercel (frontend), Render (backend)

No ORM — the database access layer is a thin, explicit `pg` query layer, not because ORMs are bad, but because the schema and query set here were small enough that hand-written parameterized SQL stayed clearer than an abstraction layer would have.

---

## Authentication

- Passwords hashed with bcrypt before storage — plaintext passwords are never persisted
- Sessions are JWTs stored in an **httpOnly cookie**, so client-side JavaScript can never read the token (a meaningful XSS mitigation)
- Cookie configuration adapts to environment: `secure: false` / `sameSite: 'lax'` in local development (same-machine, different ports), `secure: true` / `sameSite: 'none'` in production (genuinely cross-origin — Vercel talking to Render)
- Login errors are intentionally generic ("Invalid email or password") regardless of whether the email exists or the password is wrong, to avoid leaking which accounts exist

## Database

Originally built on local SQL Server for development, migrated to managed PostgreSQL (Neon) for cloud deployment — SQL Server has no viable free-tier hosting option, which made this migration a deployment requirement, not just a nice-to-have.

Three tables: `users`, `tasks`, `activity` — UUID primary keys, `TIMESTAMPTZ` timestamps, foreign keys with `ON DELETE CASCADE`, and indexes on every `user_id` foreign key column.

## API

All routes except `/health`, registration, and login require a valid session cookie. Every task/activity/AI route that touches user data is scoped by `user_id` at the query level — confirmed by dedicated isolation tests, not just assumed from the code.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/auth/me` | Current session info |
| GET / POST | `/api/tasks` | List / create tasks |
| PUT / DELETE | `/api/tasks/:id` | Update / delete a task |
| GET / POST | `/api/activity` | List / log activity entries |
| POST | `/api/ai/breakdown` | AI task breakdown |
| POST | `/api/ai/smart-task` | AI smart task extraction |
| POST | `/api/ai/priority-recommendation/:id` | AI priority suggestion |
| POST | `/api/ai/plan-my-day` | AI daily plan |
| POST | `/api/ai/copilot` | AI conversational assistant |
| GET | `/health` | Health check |

## AI Safety & Validation

AI output is treated as untrusted input, the same way user input is:

- Every AI call uses Gemini's structured output mode (a constrained response schema), then the result is **re-validated server-side regardless** — string lengths are capped, enums are checked, malformed fields are rejected or defaulted
- **Plan My Day** filters out any task ID the model references that wasn't actually sent to it — a direct guard against hallucinated data being displayed as real
- **Copilot** sanitizes client-supplied conversation history — invalid roles, missing content, and malformed entries are filtered server-side before ever reaching the prompt (tested against a simulated prompt-injection attempt)
- Dedicated rate limits per AI feature (20–40 requests per 15 minutes, tighter than general API limits) to stay within Gemini's free tier
- If Gemini is unavailable, the app degrades gracefully — a clear "AI is temporarily unavailable, your data is safe" message, and the rest of the app keeps working normally

## Security

- `helmet` for security headers (Content-Security-Policy, cross-origin isolation headers, etc.)
- Tiered rate limiting: general API, stricter auth-route limiting (brute-force mitigation), and separate AI/Copilot limits
- CORS locked to an explicit configured origin — never a wildcard
- All SQL parameterized — no string-concatenated queries anywhere
- Generic client-facing error messages; detailed errors logged server-side only, never leaked to the client (verified with malformed-input tests)
- User isolation enforced and tested on every data-touching route

## Testing

62 automated tests across 6 suites (Jest + Supertest), run against a mocked database and mocked AI service — fast, deterministic, no real network calls:

- Authentication (register, login, logout, session validation, duplicate accounts, generic error messages)
- Task CRUD, including malformed-ID handling and empty-update rejection
- Activity logging
- `requireAuth` middleware in isolation
- AI routes — auth requirements, input validation, success paths, and graceful failure (simulated Gemini timeout → clean 503)
- AI response validation — malformed output rejection, array/string capping, and the hallucination guard specifically
- User isolation — direct inspection of the SQL and parameters sent to the database, not just the response shape, on tasks and activity routes

```bash
cd backend
npm test
```

## Deployment

- **Frontend:** Vercel, deployed as a static site from `frontend/`
- **Backend:** Render, deployed as a Node web service from `backend/`
- **Database:** Neon PostgreSQL (free tier)

Both are on free tiers. The one real tradeoff of the free Render tier is a cold start after 15 minutes of inactivity — acceptable for a portfolio project, not something you'd want for a production app with real traffic.

## Environment Variables

```dotenv
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@YOUR_HOST/YOUR_DB?sslmode=no-verify
JWT_SECRET=YOUR_JWT_SECRET
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-3.1-flash-lite
NODE_ENV=development
FRONTEND_URL=http://127.0.0.1:5500
```

`GEMINI_MODEL` is deliberately configurable, not hardcoded — Gemini's model lineup changes over time, so a deprecated model can be swapped in one env var without a code change.

## Local Development

```bash
git clone https://github.com/Zunaira48/taskora.git
cd taskora/backend
npm install
# copy .env.example to .env and fill in real values
npm test        # 6 suites, 62 tests, should all pass
node server.js  # starts on http://localhost:3000
```

Open `frontend/index.html` with a local static server (e.g. VS Code's Live Server) — it defaults to pointing at `http://127.0.0.1:3000/api` via `frontend/js/config.js`.

## Roadmap

- Persistent Copilot conversation history (currently resets on page reload by design — no dedicated table/isolation logic built for it yet)
- Automated frontend tests (currently backend-only test coverage)
- Drag-and-drop reordering on the task board
- Weekly AI review / productivity insight summaries

## Author

Built by Zunaira Zahid — [github.com/Zunaira48](https://github.com/Zunaira48)
