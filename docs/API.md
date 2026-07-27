# API Reference

Base URL (local development): `http://127.0.0.1:3000/api`

All request and response bodies are JSON. **All `/api/tasks` and `/api/activity` routes require authentication** — the client must include the `token` cookie set at login/registration (`fetch` calls from the frontend use `credentials: "include"` for this reason). Every task and activity row is scoped to the logged-in user; there is no way for one account to read or modify another account's data.

---

## Authentication

### `POST /api/auth/register`

Creates a new account and logs the user in immediately (sets the session cookie).

**Request body**
```json
{ "email": "jane@example.com", "password": "at-least-6-characters" }
```

| Field | Required | Notes |
|---|---|---|
| `email` | Yes | Stored lowercase/trimmed; must be unique |
| `password` | Yes | Minimum 6 characters; hashed with bcrypt before storage, never stored or returned in plain text |

**Response `201`** — `{ "email": "jane@example.com" }`, plus a `Set-Cookie: token=...` header (httpOnly JWT, 7-day expiry)
**Response `400`** — `{ "error": "A valid email and a password of at least 6 characters are required" }`
**Response `409`** — `{ "error": "An account with this email already exists" }`

---

### `POST /api/auth/login`

**Request body**
```json
{ "email": "jane@example.com", "password": "at-least-6-characters" }
```

**Response `200`** — `{ "email": "jane@example.com" }`, plus the session cookie
**Response `401`** — `{ "error": "Invalid email or password" }` (deliberately the same message whether the email doesn't exist or the password is wrong, to avoid revealing which accounts exist)

---

### `POST /api/auth/logout`

Clears the session cookie. No request body.

**Response `204`** — no body.

---

### `GET /api/auth/me`

Returns the currently logged-in user, based on the session cookie. Used by the frontend on page load to decide whether to show the app or the login screen.

**Response `200`** — `{ "email": "jane@example.com", "userId": "..." }`
**Response `401`** — no valid session (missing/expired/invalid cookie)

---

## Tasks

*All routes below require a valid session cookie (`requireAuth` middleware). A missing/invalid/expired token returns `401` before any database work happens.*

### `GET /api/tasks`

Returns all tasks belonging to the logged-in user, newest first.

**Response `200`**
```json
[
  {
    "Id": "C65A1EBF-48B8-4772-A2ED-568B20D94E20",
    "UserId": "8B1F...",
    "Title": "Review PR #182",
    "Category": "Work",
    "Priority": "medium",
    "Status": "in-progress",
    "DueDate": null,
    "Labels": null,
    "Notes": null,
    "CreatedAt": "2026-07-24T10:34:42.498Z",
    "UpdatedAt": "2026-07-24T10:34:42.498Z"
  }
]
```

---

### `POST /api/tasks`

Creates a new task owned by the logged-in user. New tasks always start with `Status = "todo"`.

**Request body**
```json
{
  "title": "Buy groceries",
  "category": "Personal",
  "priority": "medium",
  "dueDate": "2026-08-01",
  "labels": "urgent,errand"
}
```

| Field | Required | Default if omitted |
|---|---|---|
| `title` | Yes | — (400 error if missing/blank) |
| `category` | No | `"General"` |
| `priority` | No | `"medium"` |
| `dueDate` | No | `null` |
| `labels` | No | `null` (comma-separated string) |

**Response `201`** — the created task row (same shape as `GET`).
**Response `400`** — `{ "error": "Title is required" }`

---

### `PUT /api/tasks/:id`

Partially updates a task. Only the fields present in the request body are changed. The update only applies if the task belongs to the logged-in user (matched by `Id AND UserId`) — attempting to edit another user's task by guessing its `id` returns `404`, not `403`, so existence of the row is never confirmed to an unauthorized caller.

**Request body** (any subset of):
```json
{
  "title": "Buy groceries and cook dinner",
  "category": "Personal",
  "priority": "high",
  "status": "done",
  "dueDate": "2026-08-02",
  "labels": "urgent",
  "notes": "Recipe link: ..."
}
```

**Response `200`** — the updated task row.
**Response `400`** — `{ "error": "No valid fields to update" }`
**Response `404`** — `{ "error": "Task not found" }` (also returned if the task exists but belongs to a different user)

---

### `DELETE /api/tasks/:id`

Permanently deletes a task, scoped to the logged-in user the same way as `PUT`.

**Response `204`** — no body.
**Response `404`** — `{ "error": "Task not found" }`

---

## Activity

*Also requires authentication; entries are scoped per-user.*

### `GET /api/activity`

Returns the 10 most recent activity log entries for the logged-in user, newest first.

**Response `200`**
```json
[
  {
    "Id": "2ABC4F83-FF22-49C9-B95E-483DA31EC0E3",
    "UserId": "8B1F...",
    "Message": "Added task \"Buy groceries\"",
    "Timestamp": "2026-07-24T16:39:17.553Z"
  }
]
```

### `POST /api/activity`

Logs a new activity entry for the logged-in user. Called automatically by the frontend after task actions (add/start/edit/complete/delete/move/notes update) — not typically called directly by a user.

**Request body**
```json
{ "message": "Added task \"Buy groceries\"" }
```

**Response `201`** — the created activity row.
**Response `400`** — `{ "error": "Message is required" }`

---

## Error handling

All routes return `500` with `{ "error": "..." }` on unexpected server/database errors (e.g. the SQL Server connection is down). The frontend detects network-level failures (backend not running at all) separately and shows a persistent banner until the API responds successfully again. `401` responses from any protected route are treated by the frontend as "session expired" and redirect back to the login screen.