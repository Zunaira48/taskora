# API Reference

Base URL (local development): `http://localhost:3000/api`

All request and response bodies are JSON. There is no authentication — this API is designed for local single-user use.

---

## Tasks

### `GET /api/tasks`

Returns all tasks, newest first.

**Response `200`**
```json
[
  {
    "Id": "C65A1EBF-48B8-4772-A2ED-568B20D94E20",
    "Title": "Review PR #182",
    "Category": "Work",
    "Priority": "medium",
    "Status": "in-progress",
    "DueDate": null,
    "Labels": null,
    "CreatedAt": "2026-07-24T10:34:42.498Z",
    "UpdatedAt": "2026-07-24T10:34:42.498Z"
  }
]
```

---

### `POST /api/tasks`

Creates a new task. New tasks always start with `Status = "todo"`.

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

Partially updates a task. Only the fields present in the request body are changed.

**Request body** (any subset of):
```json
{
  "title": "Buy groceries and cook dinner",
  "category": "Personal",
  "priority": "high",
  "status": "done",
  "dueDate": "2026-08-02",
  "labels": "urgent"
}
```

**Response `200`** — the updated task row.
**Response `400`** — `{ "error": "No valid fields to update" }`
**Response `404`** — `{ "error": "Task not found" }`

---

### `DELETE /api/tasks/:id`

Permanently deletes a task.

**Response `204`** — no body.
**Response `404`** — `{ "error": "Task not found" }`

---

## Activity

### `GET /api/activity`

Returns the 10 most recent activity log entries, newest first.

**Response `200`**
```json
[
  {
    "Id": "2ABC4F83-FF22-49C9-B95E-483DA31EC0E3",
    "Message": "Added task \"Buy groceries\"",
    "Timestamp": "2026-07-24T16:39:17.553Z"
  }
]
```

### `POST /api/activity`

Logs a new activity entry. Called automatically by the frontend after task actions (add/edit/complete/delete/move) — not typically called directly by a user.

**Request body**
```json
{ "message": "Added task \"Buy groceries\"" }
```

**Response `201`** — the created activity row.
**Response `400`** — `{ "error": "Message is required" }`

---

## Error handling

All routes return `500` with `{ "error": "..." }` on unexpected server/database errors (e.g. the SQL Server connection is down). The frontend detects network-level failures (backend not running at all) separately and shows a persistent banner until the API responds successfully again.
