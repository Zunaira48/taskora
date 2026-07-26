# Taskora

Taskora is a full-stack task management app: a vanilla HTML/CSS/JavaScript frontend backed by a Node.js/Express API, with data persisted in Microsoft SQL Server and secured behind per-account authentication.

It started as a localStorage-only prototype and was rebuilt in stages into a real client-server application — a relational database, JWT-based authentication with per-user data isolation, and a live activity log.

## Features

- **Authentication** — email/password registration and login, passwords hashed with bcrypt, sessions handled via an httpOnly JWT cookie; every task and activity entry is scoped to the logged-in user
- **Dashboard** — quick stats (total, completed, in progress, overdue), today's task list with inline **Start** action to move a task into progress, recent activity feed
- **Task board** — Kanban-style columns (To do / In progress / Done), plus a **notepad-style notes panel** per task (task-board-only, not shown on the Dashboard) for context, blockers, or meeting notes
- **Statistics** — completion rate, tasks by priority, tasks by category
- **Calendar** — monthly view with due dates plotted per day, overdue highlighting
- **Task management** — create, edit, complete, and delete tasks, including category, priority, due date, and labels
- **Live activity log** — backed by SQL, shows recent actions (added/started/edited/completed/deleted/moved)
- **Backend health awareness** — a banner appears if the API is unreachable, and disappears automatically once it's back
- **Dark mode**, **due-date browser notifications**, **default priority setting**

## Architecture

```
taskora/
├── frontend/         # Static HTML/CSS/JS client (no build step, no framework)
│   ├── index.html
│   ├── css/
│   │   └── components/notepad.css   # Lined-paper notes panel styling
│   └── js/
│       ├── models/Task.js       # Task shape reference (client-side)
│       ├── data/
│       │   ├── auth.js          # register/login/logout/getCurrentUser API calls
│       │   └── taskStorage.js   # All task/activity API calls to the backend
│       └── main.js              # All UI logic, auth gate, and event wiring
│
├── backend/          # Express REST API
│   ├── server.js             # Routes: /api/auth, /api/tasks, /api/activity
│   ├── auth.js                # bcrypt hashing + JWT sign/verify + cookie options
│   ├── db.js                   # SQL Server connection pool (mssql package)
│   ├── middleware/requireAuth.js  # Verifies the JWT cookie, attaches req.userId
│   ├── .env.example            # Template for required environment variables
│   └── package.json
│
└── docs/
    ├── API.md
    └── QA-TEST-PLAN.md
```

**Data flow:** Browser (`frontend/js/main.js`) → `auth.js` / `taskStorage.js` (`fetch` calls, credentials included) → Express routes (`backend/server.js`) → `requireAuth` middleware verifies the JWT cookie → `mssql` connection pool (`backend/db.js`) → SQL Server (`TaskoraDB` database, `Users`, `Tasks`, and `Activity` tables, all task/activity rows scoped by `UserId`).

There is no frontend build tool — `frontend/` is served as static files (e.g. via VS Code's Live Server extension) and talks to the backend over `http://127.0.0.1:3000/api`.

## Design system

Taskora's visual identity plays on its name — *Task* + *Aurora* — a "dawn breaking" theme tied to the dashboard's "Good morning" greeting.

- **Palette:** warm paper background, ink-black sidebar, clay-amber primary accent paired with a teal "aurora" secondary accent
- **Typography:** Fraunces (serif) for headings, Inter for body text, IBM Plex Mono for numbers/dates — a "ledger" feel for anything data-like
- **Signature motif:** a thin amber→teal gradient arc appears under every page title, as the sidebar's active-page indicator, and as the completion-rate donut's ring — one consistent visual thread instead of scattered effects
- Dark mode uses the same warm-ink palette, not a generic cool gray

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (no framework) |
| Backend | Node.js, Express |
| Database | Microsoft SQL Server, accessed via the `mssql` npm package |
| Auth to DB | SQL Server Authentication (not Windows/Integrated Auth) |
| App authentication | bcrypt password hashing, JWT stored in an httpOnly cookie |

## Setup — Backend

**Prerequisites:** Node.js installed, SQL Server + SSMS installed and running locally, TCP/IP protocol enabled on port 1433.

1. In SSMS, create the database and tables:

```sql
CREATE DATABASE TaskoraDB;
GO
USE TaskoraDB;
GO

CREATE TABLE Users (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Tasks (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id),
    Title NVARCHAR(255) NOT NULL,
    Category NVARCHAR(100) NOT NULL DEFAULT 'General',
    Priority NVARCHAR(20) NOT NULL DEFAULT 'medium',
    Status NVARCHAR(20) NOT NULL DEFAULT 'todo',
    DueDate DATE NULL,
    Labels NVARCHAR(300) NULL,
    Notes NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Activity (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id),
    Message NVARCHAR(255) NOT NULL,
    Timestamp DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
```

2. Create a SQL login for the app (do not use `sa` or Windows Auth in the app itself):

```sql
CREATE LOGIN taskora WITH PASSWORD = 'YourStrongPassword', CHECK_POLICY = OFF;
USE TaskoraDB;
CREATE USER taskora FOR LOGIN taskora;
ALTER ROLE db_owner ADD MEMBER taskora;
```

3. Copy the environment template and fill in your real values:

```powershell
cd backend
copy .env.example .env
```

Edit `.env`:
```dotenv
DB_SERVER=localhost
DB_DATABASE=TaskoraDB
DB_PORT=1433
DB_USER=taskora
DB_PASSWORD=YourStrongPassword
JWT_SECRET=some-long-random-string-used-to-sign-tokens
```

4. Install dependencies and run:

```powershell
npm install
node server.js
```

You should see:
```
Taskora backend running on http://localhost:3000
```

## Setup — Frontend

No build step required.

1. Open the `frontend/` folder in VS Code.
2. Right-click `frontend/index.html` → **Open with Live Server** (or serve it with any static file server).
3. Make sure the backend (above) is running first — the frontend expects the API at `http://127.0.0.1:3000/api` (see `frontend/js/data/taskStorage.js`, `API_BASE`).
4. On first load you'll see the login/register screen — create an account to get started. Each account has its own private tasks and activity log.

If the backend isn't reachable, a red banner appears at the top of the app; it disappears automatically once the backend responds again.

## API Reference

See [`docs/API.md`](docs/API.md) for the full list of endpoints, request/response shapes, and status codes.

## QA / Test Plan

See [`docs/QA-TEST-PLAN.md`](docs/QA-TEST-PLAN.md) for the manual test cases used to verify this app end-to-end.

## Known limitations / roadmap

- No pagination — `GET /api/tasks` returns all rows for the logged-in user
- Desktop-first layout not yet optimized for mobile screens
- Task board is button-based, not drag-and-drop
- No password reset / email verification flow yet
- Currently runs locally only; not yet deployed to a public URL

## License

Personal / educational project.