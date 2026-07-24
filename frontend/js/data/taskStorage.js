const API_BASE = "http://localhost:3000/api";

function mapTaskFromApi(row) {
  return {
    id: row.Id,
    title: row.Title,
    category: row.Category,
    priority: row.Priority,
    status: row.Status,
    dueDate: row.DueDate ? row.DueDate.slice(0, 10) : null,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt
  };
}

async function getAllTasks() {
  const res = await fetch(`${API_BASE}/tasks`);
  const data = await res.json();
  return data.map(mapTaskFromApi);
}

async function addTask(taskData) {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(taskData)
  });
  const row = await res.json();
  return mapTaskFromApi(row);
}

async function updateTask(id, changes) {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes)
  });
  if (!res.ok) return null;
  const row = await res.json();
  return mapTaskFromApi(row);
}

async function deleteTask(id) {
  await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
}

// Activity log stays on localStorage — no backend table for it yet
const ACTIVITY_KEY = "taskora_activity";

function getActivity() {
  const raw = localStorage.getItem(ACTIVITY_KEY);
  return raw ? JSON.parse(raw) : [];
}

function logActivity(message) {
  const activity = getActivity();
  activity.unshift({
    id: crypto.randomUUID(),
    message,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity.slice(0, 10)));
}