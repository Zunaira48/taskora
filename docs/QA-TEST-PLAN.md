# QA Test Plan — Taskora

Manual test cases used to verify Taskora end-to-end, covering the frontend, the API, and the database layer together. Run these after any change to `backend/` or `frontend/js/`.

**Setup before testing:** SQL Server running with TCP/IP enabled on port 1433, `backend/.env` filled in, backend running (`node server.js`), frontend open via Live Server.

---

## 1. Task creation

| # | Steps | Expected result |
|---|---|---|
| 1.1 | Click **Quick add**, enter a title only, submit | Task appears in Today list and Task board's "To do" column, with default category "General" and priority "medium" |
| 1.2 | Add a task with title, category, priority, due date, and labels (e.g. `urgent, home`) filled in | Task appears with all fields shown correctly, including label chips |
| 1.3 | Try to submit the form with an empty title | Form does not submit / task is not created |
| 1.4 | Refresh the browser page after adding a task | Task is still present (confirms it's saved in SQL, not just in-memory) |

## 2. Task editing

| # | Steps | Expected result |
|---|---|---|
| 2.1 | Click the edit (✎) icon on an existing task | Modal opens pre-filled with that task's current title, category, priority, due date, labels |
| 2.2 | Change the title and priority, save | Dashboard and Task board reflect the new title/priority immediately |
| 2.3 | Edit a task's labels, save, refresh the page | New labels persist after refresh |

## 3. Task completion / status changes

| # | Steps | Expected result |
|---|---|---|
| 3.1 | Check a task's checkbox on the dashboard | Task moves to completed state, "Completed" stat count increases by 1 |
| 3.2 | Uncheck a completed task | Task returns to "todo", stat count decreases |
| 3.3 | On the Task board, click "In progress" on a To-do card | Card moves to the "In progress" column |
| 3.4 | On the Task board, click "Done" on an In-progress card | Card moves to "Done" column |

## 4. Task deletion

| # | Steps | Expected result |
|---|---|---|
| 4.1 | Click the delete (×) icon on a task | Task disappears from the list immediately |
| 4.2 | Refresh the page | Deleted task does not reappear |
| 4.3 | In SSMS, run `SELECT * FROM Tasks` | Deleted task's row is genuinely gone from the table |

## 5. Filtering, search, sort

| # | Steps | Expected result |
|---|---|---|
| 5.1 | Type a keyword into the search box | Only tasks with matching titles remain visible |
| 5.2 | Select filter "Overdue" | Only tasks with a past due date and not marked done are shown |
| 5.3 | Select sort "Priority" | Tasks reorder from Urgent → High → Medium → Low |

## 6. Statistics page

| # | Steps | Expected result |
|---|---|---|
| 6.1 | Open Statistics with a mix of completed/incomplete tasks | Completion rate donut shows the correct percentage |
| 6.2 | Compare "Tasks by priority" bar counts to the actual task list | Counts match exactly |
| 6.3 | Compare "Tasks by category" bar counts to the actual task list | Counts match exactly |

## 7. Calendar page

| # | Steps | Expected result |
|---|---|---|
| 7.1 | Add a task with a due date in the current month | Task title appears on the correct day cell |
| 7.2 | Add a task with a past due date, not marked done | That day's task tag is styled as overdue |
| 7.3 | Click next/previous month arrows | Calendar navigates correctly, tasks reload for the visible month |

## 8. Activity log

| # | Steps | Expected result |
|---|---|---|
| 8.1 | Add, edit, complete, and delete a task in sequence | Each action produces a corresponding entry in "Recent activity", most recent first |
| 8.2 | Refresh the page | Activity log entries persist (confirms SQL-backed, not localStorage) |

## 9. Backend resilience

| # | Steps | Expected result |
|---|---|---|
| 9.1 | Stop the backend (`Ctrl+C` in its terminal), then perform any action in the UI | A red "Can't reach the server" banner appears |
| 9.2 | Restart the backend, perform any action | Banner disappears automatically |

## 10. Settings

| # | Steps | Expected result |
|---|---|---|
| 10.1 | Toggle dark mode | Theme switches and persists after refresh |
| 10.2 | Change default priority in Settings | New tasks created afterward default to that priority |
| 10.3 | Click "Clear all data", confirm | All tasks are deleted (from SQL, not just the UI) |

---

## Known gaps not covered by manual testing

- No automated test suite yet (unit or integration tests)
- No concurrent-user / race-condition testing (single-user app by design)
- No load/performance testing
