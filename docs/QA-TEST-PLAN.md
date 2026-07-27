# QA Test Plan — Taskora

Manual test cases used to verify Taskora end-to-end, covering the frontend, the API, authentication, and the database layer together. Run these after any change to `backend/` or `frontend/js/`.

**Setup before testing:** SQL Server running with TCP/IP enabled on port 1433, `backend/.env` filled in (including `JWT_SECRET`), backend running (`node server.js`), frontend open via Live Server.

---

## 1. Authentication

| # | Steps | Expected result |
|---|---|---|
| 1.1 | Open the app with no prior session | Login/register screen is shown, not the dashboard |
| 1.2 | Click "Create one", register with a new email and a 6+ character password | Account is created, user is logged in automatically, dashboard loads |
| 1.3 | Try to register again with the same email | `409` error shown inline: "An account with this email already exists" |
| 1.4 | Try to register with a password under 6 characters | Form-level or `400` error shown; account not created |
| 1.5 | Log out, then log back in with the correct email/password | Returns to the dashboard with the same account's data |
| 1.6 | Log in with a correct email but wrong password | `401` error shown: "Invalid email or password" |
| 1.7 | Log in with an email that was never registered | Same generic "Invalid email or password" message (should not reveal the account doesn't exist) |
| 1.8 | Refresh the page while logged in | Session persists — dashboard loads directly, no re-login required |
| 1.9 | Log out | Returns to login screen; refreshing afterward does not restore the session |

## 2. Per-user data isolation

| # | Steps | Expected result |
|---|---|---|
| 2.1 | Register Account A, add 2–3 tasks | Tasks appear only under Account A |
| 2.2 | Log out, register Account B, view the dashboard | Account B sees zero tasks (its own seed tasks only), not Account A's tasks |
| 2.3 | In SSMS, run `SELECT Title, UserId FROM Tasks` | Each task's `UserId` correctly matches the account that created it |
| 2.4 | Attempt to `PUT` or `DELETE` Account A's task ID while logged in as Account B (e.g. via Postman with Account B's cookie) | `404 Task not found` — not a `200`, confirming the `UserId` check in the query is effective |

## 3. Task creation

| # | Steps | Expected result |
|---|---|---|
| 3.1 | Click **Quick add**, enter a title only, submit | Task appears in Today list and Task board's "To do" column, with default category "General" and priority "medium" |
| 3.2 | Add a task with title, category, priority, due date, and labels (e.g. `urgent, home`) filled in | Task appears with all fields shown correctly, including label chips |
| 3.3 | Try to submit the form with an empty title | Form does not submit / task is not created |
| 3.4 | Refresh the browser page after adding a task | Task is still present (confirms it's saved in SQL, not just in-memory) |

## 4. Task editing

| # | Steps | Expected result |
|---|---|---|
| 4.1 | Click the edit (✎) icon on an existing task | Modal opens pre-filled with that task's current title, category, priority, due date, labels |
| 4.2 | Change the title and priority, save | Dashboard and Task board reflect the new title/priority immediately |
| 4.3 | Edit a task's labels, save, refresh the page | New labels persist after refresh |

## 5. Task status changes (To do / In progress / Done)

| # | Steps | Expected result |
|---|---|---|
| 5.1 | On the Dashboard, click **Start** on a To-do task | Task shows an "↺ In progress" pill instead of Start; "In progress" stat count increases |
| 5.2 | Click the "↺ In progress" pill on that same task | Task reverts to showing the **Start** button again; "In progress" stat count decreases; a "Moved ... back to To do" activity entry is logged |
| 5.3 | Check a task's checkbox on the dashboard | Task moves to completed state, "Completed" stat count increases by 1 |
| 5.4 | Uncheck a completed task | Task returns to "todo", stat count decreases |
| 5.5 | On the Task board, click "In progress" on a To-do card | Card moves to the "In progress" column |
| 5.6 | On the Task board, click "Done" on an In-progress card | Card moves to "Done" column |

## 6. Task board notes (notepad)

| # | Steps | Expected result |
|---|---|---|
| 6.1 | On Task board, click the 📝 icon on any card | Notes modal opens, styled as a lined notepad, showing the task's title as subtitle |
| 6.2 | Type text, click "Save notes" | Modal closes; the 📝 icon on that card now shows the "has notes" highlighted style |
| 6.3 | Reopen notes on the same task | Previously saved text is shown, not blank |
| 6.4 | Check the Dashboard's Today list for that same task | Notes content is **not** visible anywhere on the Dashboard (notes are task-board-only, by design) |
| 6.5 | Refresh the page, reopen notes on that task | Notes persist after refresh (confirms SQL-backed, not in-memory only) |

## 7. Task deletion

| # | Steps | Expected result |
|---|---|---|
| 7.1 | Click the delete (×) icon on a task | Task disappears from the list immediately |
| 7.2 | Refresh the page | Deleted task does not reappear |
| 7.3 | In SSMS, run `SELECT * FROM Tasks WHERE UserId = '<your user id>'` | Deleted task's row is genuinely gone from the table |

## 8. Filtering, search, sort

| # | Steps | Expected result |
|---|---|---|
| 8.1 | Type a keyword into the search box | Only tasks with matching titles remain visible |
| 8.2 | Select filter "Overdue" | Only tasks with a past due date and not marked done are shown |
| 8.3 | Select sort "Priority" | Tasks reorder from Urgent → High → Medium → Low |

## 9. Statistics page

| # | Steps | Expected result |
|---|---|---|
| 9.1 | Open Statistics with a mix of completed/incomplete tasks | Completion rate donut shows the correct percentage |
| 9.2 | Compare "Tasks by priority" bar counts to the actual task list | Counts match exactly |
| 9.3 | Compare "Tasks by category" bar counts to the actual task list | Counts match exactly |

## 10. Calendar page

| # | Steps | Expected result |
|---|---|---|
| 10.1 | Add a task with a due date in the current month | Task title appears on the correct day cell |
| 10.2 | Add a task with a past due date, not marked done | That day's task tag is styled as overdue |
| 10.3 | Click next/previous month arrows | Calendar navigates correctly, tasks reload for the visible month |

## 11. Activity log

| # | Steps | Expected result |
|---|---|---|
| 11.1 | Add, start, edit, complete, and delete a task in sequence | Each action produces a corresponding entry in "Recent activity", most recent first |
| 11.2 | Refresh the page | Activity log entries persist (confirms SQL-backed, not localStorage) |
| 11.3 | Log in as a different account | Activity log shows only that account's own history, not another account's actions |

## 12. Backend resilience

| # | Steps | Expected result |
|---|---|---|
| 12.1 | Stop the backend (`Ctrl+C` in its terminal), then perform any action in the UI | A red "Can't reach the server" banner appears |
| 12.2 | Restart the backend, perform any action | Banner disappears automatically |

## 13. Settings

| # | Steps | Expected result |
|---|---|---|
| 13.1 | Toggle dark mode | Theme switches and persists after refresh |
| 13.2 | Change default priority in Settings | New tasks created afterward default to that priority |
| 13.3 | Click "Clear all data", confirm | All of the current user's tasks are deleted (from SQL, not just the UI) — other accounts' data is untouched |

---

## Known gaps not covered by manual testing

- No automated test suite yet (unit or integration tests)
- No concurrent-user / race-condition testing beyond basic per-user isolation checks above
- No load/performance testing
- No password reset or email verification flow to test
- JWT expiry (7 days) not tested for actual expiry behavior (would require waiting or manually crafting an expired token)