const STORAGE_KEY = "taskora_tasks";

function getAllTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveAllTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function addTask(taskData) {
  const tasks = getAllTasks();
  const newTask = createTask(taskData);
  tasks.push(newTask);
  saveAllTasks(tasks);
  return newTask;
}

function updateTask(id, changes) {
  const tasks = getAllTasks();
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return null;

  tasks[index] = {
    ...tasks[index],
    ...changes,
    updatedAt: new Date().toISOString()
  };
  saveAllTasks(tasks);
  return tasks[index];
}

function deleteTask(id) {
  const tasks = getAllTasks();
  const filtered = tasks.filter(t => t.id !== id);
  saveAllTasks(filtered);
}

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

  const trimmed = activity.slice(0, 10);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(trimmed));
}