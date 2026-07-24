const API_BASE = "http://localhost:3000/api";

function mapTaskFromApi(row) {
  return {
    id: row.Id,
    title: row.Title,
    category: row.Category,
    priority: row.Priority,
    status: row.Status,
    dueDate: row.DueDate ? row.DueDate.slice(0, 10) : null,
    labels: row.Labels ? row.Labels.split(",").map(l => l.trim()).filter(Boolean) : [],
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt
  };
}

async function safeFetch(url, options) {
  try {
    const res = await fetch(url, options);
    hideBackendError();
    return res;
  } catch (err) {
    showBackendError();
    throw err;
  }
}

async function getAllTasks() {
  try {
    const res = await safeFetch(`${API_BASE}/tasks`);
    const data = await res.json();
    return data.map(mapTaskFromApi);
  } catch {
    return [];
  }
}

async function addTask(taskData) {
  const payload = { ...taskData, labels: Array.isArray(taskData.labels) ? taskData.labels.join(",") : taskData.labels };
  const res = await safeFetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const row = await res.json();
  return mapTaskFromApi(row);
}

async function updateTask(id, changes) {
  const payload = { ...changes };
  if ("labels" in payload) {
    payload.labels = Array.isArray(payload.labels) ? payload.labels.join(",") : payload.labels;
  }
  const res = await safeFetch(`${API_BASE}/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) return null;
  const row = await res.json();
  return mapTaskFromApi(row);
}

async function deleteTask(id) {
  await safeFetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
}

// ===== Activity — now backed by SQL =====

async function getActivity() {
  try {
    const res = await safeFetch(`${API_BASE}/activity`);
    const data = await res.json();
    return data.map(row => ({ id: row.Id, message: row.Message, timestamp: row.Timestamp }));
  } catch {
    return [];
  }
}

async function logActivity(message) {
  try {
    await safeFetch(`${API_BASE}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
  } catch {
    // silently ignore — backend-down banner already shown by safeFetch
  }
}