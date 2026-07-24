# Taskora

Taskora is a full-stack task management app: a vanilla HTML/CSS/JavaScript frontend backed by a Node.js/Express API, with data persisted in Microsoft SQL Server.

It started as a localStorage-only prototype and was rebuilt to use a real relational database, with a proper client-server architecture, error handling for backend downtime, and a live activity log.

## Features

- **Dashboard** — quick stats (total, completed, in progress, overdue), today's task list, recent activity feed
- **Task board** — Kanban-style columns (To do / In progress / Done)
- **Statistics** — completion rate, tasks by priority, tasks by category
- **Calendar** — monthly view with due dates plotted per day, overdue highlighting
- **Task editing** — create, edit, complete, and delete tasks, including category, priority, due date, and labels
- **Live activity log** — backed by SQL, shows recent actions (added/edited/completed/deleted/moved)
- **Backend health awareness** — a banner appears if the API is unreachable, and disappears automatically once it's back
- **Dark mode**, **due-date browser notifications**, **default priority setting**

## Architecture

```
taskora/
├── frontend/         # Static HTML/CSS/JS client (no build step, no framework)
│   ├── index.html
│   ├── css/
│   └── js/
│       ├── models/Task.js       # Task shape reference (client-side)
│       ├── data/taskStorage.js  # All API calls to the backend live here
│       └── main.js              # All UI logic and event wiring
│
├── backend/          # Express REST API
│   ├── server.js     # Routes: /api/tasks, /api/activity
│   ├── db.js          # SQL Server connection pool (mssql package)
│   ├── .env.example   # Template for required environment variables
│   └── package.json
│
└── docs/
    ├── API.md
    └── QA-TEST-PLAN.md
```

**Data flow:** Browser (`frontend/js/main.js`) → `taskStorage.js` (`fetch` calls) → Express routes (`backend/server.js`) → `mssql` connection pool (`backend/db.js`) → SQL Server (`TaskoraDB` database, `Tasks` and `Activity` tables).

There is no frontend build tool — `frontend/` is served as static files (e.g. via VS Code's Live Server extension) and talks to the backend over `http://localhost:3000/api`.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (no framework) |
| Backend | Node.js, Express |
| Database | Microsoft SQL Server, accessed via the `mssql` npm package |
| Auth to DB | SQL Server Authentication (not Windows/Integrated Auth) |

## Setup — Backend

**Prerequisites:** Node.js installed, SQL Server + SSMS installed and running locally, TCP/IP protocol enabled on port 1433.

1. In SSMS, create the database and tables:

```sql
CREATE DATABASE TaskoraDB;
GO
USE TaskoraDB;
GO

CREATE TABLE Tasks (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Title NVARCHAR(255) NOT NULL,
    Category NVARCHAR(100) NOT NULL DEFAULT 'General',
    Priority NVARCHAR(20) NOT NULL DEFAULT 'medium',
    Status NVARCHAR(20) NOT NULL DEFAULT 'todo',
    DueDate DATE NULL,
    Labels NVARCHAR(300) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Activity (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
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
3. Make sure the backend (above) is running first — the frontend expects the API at `http://localhost:3000/api` (see `frontend/js/data/taskStorage.js`, `API_BASE`).

If the backend isn't reachable, a red banner appears at the top of the app; it disappears automatically once the backend responds again.

## API Reference

See [`docs/API.md`](docs/API.md) for the full list of endpoints, request/response shapes, and status codes.

## QA / Test Plan

See [`docs/QA-TEST-PLAN.md`](docs/QA-TEST-PLAN.md) for the manual test cases used to verify this app end-to-end.

## Known limitations / roadmap

- No authentication  single shared task list, not per-user
- No pagination  `GET /api/tasks` returns all rows
- Desktop-first layout not yet optimized for mobile screens
- Task board is button-based, not drag-and-drop
- Currently runs locally only; not yet deployed to a public URL

## License

Personal / educational project.