async function refreshUI() {
  await renderTaskList();
  await renderStats();
  renderActivity();
}

async function seedTasksIfEmpty() {
  const existing = await getAllTasks();
  if (existing.length > 0) return;

  await addTask({ title: "Finish API docs", priority: "high", category: "Work" });
  await addTask({ title: "Review PR #182", priority: "medium", category: "Work" });
  await addTask({ title: "Team standup notes", priority: "low", category: "Work" });
}

async function getVisibleTasks() {
  let tasks = await getAllTasks();

  const searchTerm = document.getElementById("searchInput").value.toLowerCase().trim();
  const filterValue = document.getElementById("filterSelect").value;
  const sortValue = document.getElementById("sortSelect").value;

  if (searchTerm) {
    tasks = tasks.filter(t => t.title.toLowerCase().includes(searchTerm));
  }

  if (filterValue === "todo") {
    tasks = tasks.filter(t => t.status !== "done");
  } else if (filterValue === "done") {
    tasks = tasks.filter(t => t.status === "done");
  } else if (filterValue === "overdue") {
    tasks = tasks.filter(t => t.dueDate && t.status !== "done" && new Date(t.dueDate) < new Date());
  }

  const priorityRank = { urgent: 4, high: 3, medium: 2, low: 1 };

  if (sortValue === "priority") {
    tasks = [...tasks].sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);
  } else if (sortValue === "dueDate") {
    tasks = [...tasks].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  } else {
    tasks = [...tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return tasks;
}

async function renderTaskList() {
  const listEl = document.getElementById("todayTaskList");
  const tasks = await getVisibleTasks();

  if (tasks.length === 0) {
    listEl.innerHTML = `<li class="task-item task-item--empty">No tasks match your search or filter.</li>`;
    attachTaskListeners();
    return;
  }

  listEl.innerHTML = tasks.map(task => {
    const isOverdue = task.dueDate && task.status !== "done" && new Date(task.dueDate) < new Date();

    return `
      <li class="task-item ${task.status === 'done' ? 'task-item--done' : ''} ${isOverdue ? 'task-item--overdue' : ''}">
        <input type="checkbox" class="task-item__checkbox" data-id="${task.id}" ${task.status === 'done' ? 'checked' : ''} />
        <span class="task-item__title">${task.title}</span>
        <span class="task-item__category">${task.category}</span>
        ${task.dueDate ? `<span class="task-item__due">${task.dueDate}</span>` : ''}
        <span class="task-item__badge task-item__badge--${task.priority}">
          ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
        <button class="task-item__delete" data-id="${task.id}" aria-label="Delete task">
          &times;
        </button>
      </li>
    `;
  }).join("");

  attachTaskListeners();
}

function attachTaskListeners() {
  document.querySelectorAll(".task-item__checkbox").forEach(checkbox => {
    checkbox.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const newStatus = e.target.checked ? "done" : "todo";
      const allTasks = await getAllTasks();
      const task = allTasks.find(t => t.id === id);
      await updateTask(id, { status: newStatus });

      if (newStatus === "done") {
        logActivity(`Completed "${task.title}"`);
      }
      await refreshUI();
    });
  });

  document.querySelectorAll(".task-item__delete").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      const allTasks = await getAllTasks();
      const task = allTasks.find(t => t.id === id);
      await deleteTask(id);
      logActivity(`Deleted "${task.title}"`);
      await refreshUI();
    });
  });
}

function openModal() {
  document.getElementById("modalOverlay").classList.add("modal-overlay--open");
  document.getElementById("taskTitle").focus();
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("modal-overlay--open");
  document.getElementById("taskForm").reset();
}

async function handleTaskFormSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("taskTitle").value.trim();
  if (!title) return;

  const category = document.getElementById("taskCategory").value.trim() || "General";
  const priority = document.getElementById("taskPriority").value;
  const dueDate = document.getElementById("taskDueDate").value || null;

  await addTask({ title, category, priority, dueDate });
  logActivity(`Added task "${title}"`);
  closeModal();
  await refreshUI();
}

async function renderStats() {
  const tasks = await getAllTasks();

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === "done").length;
  const inProgress = tasks.filter(t => t.status === "in-progress").length;
  const overdue = tasks.filter(t => {
    if (!t.dueDate || t.status === "done") return false;
    return new Date(t.dueDate) < new Date();
  }).length;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statCompleted").textContent = completed;
  document.getElementById("statInProgress").textContent = inProgress;
  document.getElementById("statOverdue").textContent = overdue;
}

function timeAgo(isoString) {
  const seconds = Math.floor((new Date() - new Date(isoString)) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderActivity() {
  const listEl = document.getElementById("activityList");
  const activity = getActivity();

  if (activity.length === 0) {
    listEl.innerHTML = `<li class="activity-item activity-item--empty">No activity yet</li>`;
    return;
  }

  listEl.innerHTML = activity.map(entry => `
    <li class="activity-item">
      <span class="activity-item__message">${entry.message}</span>
      <span class="activity-item__time">${timeAgo(entry.timestamp)}</span>
    </li>
  `).join("");
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("taskora_theme", theme);
  document.getElementById("themeToggleIcon").textContent = theme === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

function loadSavedTheme() {
  const saved = localStorage.getItem("taskora_theme") || "light";
  applyTheme(saved);
}

async function switchPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.add("page--hidden");
  });
  document.getElementById(pageId).classList.remove("page--hidden");

  document.querySelectorAll(".sidebar__nav-link").forEach(link => {
    link.classList.remove("sidebar__nav-link--active");
  });
  document.querySelector(`[data-page="${pageId}"]`).classList.add("sidebar__nav-link--active");

  if (pageId === "page-taskboard") {
    await renderBoard();
  } else if (pageId === "page-statistics") {
    await renderStatistics();
  } else if (pageId === "page-settings") {
    loadDefaultPriority();
    updateNotifsButton();
  } else if (pageId === "page-calendar") {
    await renderCalendar();
  }
}

async function renderBoard() {
  const tasks = await getAllTasks();
  const columns = {
    todo: document.getElementById("board-todo"),
    inprogress: document.getElementById("board-inprogress"),
    done: document.getElementById("board-done")
  };

  columns.todo.innerHTML = "";
  columns.inprogress.innerHTML = "";
  columns.done.innerHTML = "";

  tasks.forEach(task => {
    const key = task.status === "in-progress" ? "inprogress" : task.status;
    const card = document.createElement("li");
    card.className = "board__card";
    card.innerHTML = `
      <span class="board__card-title">${task.title}</span>
      <div class="board__card-actions">
        ${task.status !== "todo" ? `<button data-id="${task.id}" data-status="todo">To do</button>` : ""}
        ${task.status !== "in-progress" ? `<button data-id="${task.id}" data-status="in-progress">In progress</button>` : ""}
        ${task.status !== "done" ? `<button data-id="${task.id}" data-status="done">Done</button>` : ""}
      </div>
    `;
    columns[key].appendChild(card);
  });

  document.querySelectorAll(".board__card-actions button").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      const newStatus = e.target.dataset.status;
      await updateTask(id, { status: newStatus });
      const allTasks = await getAllTasks();
      logActivity(`Moved "${allTasks.find(t => t.id === id).title}" to ${newStatus}`);
      await renderBoard();
      await renderStats();
    });
  });
}

async function renderStatistics() {
  const tasks = await getAllTasks();
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === "done").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  document.getElementById("completionDonut").style.setProperty("--pct", percent);
  document.getElementById("completionPercent").textContent = `${percent}%`;

  const priorityCounts = { urgent: 0, high: 0, medium: 0, low: 0 };
  tasks.forEach(t => priorityCounts[t.priority]++);
  renderBarChart("priorityChart", priorityCounts, total);

  const categoryCounts = {};
  tasks.forEach(t => {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
  });
  renderBarChart("categoryChart", categoryCounts, total);
}

function renderBarChart(containerId, counts, total) {
  const el = document.getElementById(containerId);
  const max = Math.max(...Object.values(counts), 1);

  el.innerHTML = Object.entries(counts).map(([label, count]) => `
    <div class="bar-row">
      <span class="bar-row__label">${label}</span>
      <div class="bar-row__track">
        <div class="bar-row__fill" style="width: ${(count / max) * 100}%"></div>
      </div>
      <span class="bar-row__count">${count}</span>
    </div>
  `).join("");
}

function loadDefaultPriority() {
  const saved = localStorage.getItem("taskora_default_priority") || "medium";
  document.getElementById("defaultPrioritySelect").value = saved;
  document.getElementById("taskPriority").value = saved;
}

function handleDefaultPriorityChange(e) {
  const value = e.target.value;
  localStorage.setItem("taskora_default_priority", value);
  document.getElementById("taskPriority").value = value;
}

async function handleClearData() {
  const confirmed = confirm("This will permanently delete all tasks and activity. Continue?");
  if (!confirmed) return;

  const tasks = await getAllTasks();
  for (const task of tasks) {
    await deleteTask(task.id);
  }

  localStorage.removeItem("taskora_activity");
  await refreshUI();
}

let calendarDate = new Date();
calendarDate.setDate(1);

async function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  const monthNames = ["January","February","March","April","May","June",
                       "July","August","September","October","November","December"];
  document.getElementById("calMonthLabel").textContent = `${monthNames[month]} ${year}`;

  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekday = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const tasks = await getAllTasks();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  let cells = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, outside: false });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - (startWeekday + daysInMonth) + 1, outside: true });
  }

  grid.innerHTML = cells.map(cell => {
    const cellDate = cell.outside ? null : new Date(year, month, cell.day);
    const cellDateStr = cellDate ? cellDate.toISOString().slice(0, 10) : "";
    const isToday = cellDateStr === todayStr;

    const dayTasks = cell.outside ? [] : tasks.filter(t => t.dueDate === cellDateStr);

    const taskTags = dayTasks.map(t => {
      const isOverdue = t.status !== "done" && new Date(t.dueDate) < today;
      return `<span class="calendar__day-task ${isOverdue ? 'calendar__day-task--overdue' : ''}">${t.title}</span>`;
    }).join("");

    return `
      <div class="calendar__day ${cell.outside ? 'calendar__day--outside' : ''} ${isToday ? 'calendar__day--today' : ''}">
        <span class="calendar__day-number">${cell.day}</span>
        ${taskTags}
      </div>
    `;
  }).join("");
}

function goToPrevMonth() {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
}

function goToNextMonth() {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
}

let notifiedTaskIds = new Set();
let reminderIntervalId = null;

function updateNotifsButton() {
  const btn = document.getElementById("enableNotifsBtn");
  const enabled = localStorage.getItem("taskora_notifs_enabled") === "true";

  if (enabled) {
    btn.textContent = "Disable reminders";
    btn.classList.add("btn--danger");
  } else {
    btn.textContent = "Enable reminders";
    btn.classList.remove("btn--danger");
  }
}

function toggleReminders() {
  const currentlyEnabled = localStorage.getItem("taskora_notifs_enabled") === "true";

  if (currentlyEnabled) {
    localStorage.setItem("taskora_notifs_enabled", "false");
    if (reminderIntervalId) {
      clearInterval(reminderIntervalId);
      reminderIntervalId = null;
    }
    updateNotifsButton();
    return;
  }

  if (!("Notification" in window)) {
    alert("This browser doesn't support notifications.");
    return;
  }

  if (Notification.permission === "granted") {
    localStorage.setItem("taskora_notifs_enabled", "true");
    updateNotifsButton();
    startReminderCheck();
    return;
  }

  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      localStorage.setItem("taskora_notifs_enabled", "true");
      updateNotifsButton();
      startReminderCheck();
    } else {
      alert("Notifications permission was denied in the browser. You can change this in your browser's site settings.");
    }
  });
}

async function checkDueTasks() {
  if (localStorage.getItem("taskora_notifs_enabled") !== "true") return;
  if (Notification.permission !== "granted") return;

  const tasks = await getAllTasks();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  tasks.forEach(task => {
    if (task.status === "done" || !task.dueDate) return;
    if (notifiedTaskIds.has(task.id)) return;

    const isDueOrOverdue = task.dueDate <= todayStr;
    if (!isDueOrOverdue) return;

    const isOverdue = task.dueDate < todayStr;
    new Notification("Taskora", {
      body: isOverdue ? `Overdue: "${task.title}"` : `Due today: "${task.title}"`,
      icon: "🔔"
    });

    notifiedTaskIds.add(task.id);
  });
}

function startReminderCheck() {
  notifiedTaskIds.clear();
  checkDueTasks();
  reminderIntervalId = setInterval(checkDueTasks, 60000);
}

document.addEventListener("DOMContentLoaded", async () => {
  loadSavedTheme();

  document.getElementById("taskPriority").value = localStorage.getItem("taskora_default_priority") || "medium";
  await seedTasksIfEmpty();
  await refreshUI();

  document.querySelector(".btn--primary").addEventListener("click", openModal);
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("taskForm").addEventListener("submit", handleTaskFormSubmit);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);

  document.getElementById("searchInput").addEventListener("input", renderTaskList);
  document.getElementById("filterSelect").addEventListener("change", renderTaskList);
  document.getElementById("sortSelect").addEventListener("change", renderTaskList);

  document.querySelectorAll(".sidebar__nav-link[data-page]").forEach(link => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      await switchPage(link.dataset.page);
    });
  });

  document.getElementById("enableNotifsBtn").addEventListener("click", toggleReminders);
  updateNotifsButton();

  if (localStorage.getItem("taskora_notifs_enabled") === "true" && Notification.permission === "granted") {
    startReminderCheck();
  }

  document.getElementById("settingsThemeToggle").addEventListener("click", toggleTheme);
  document.getElementById("defaultPrioritySelect").addEventListener("change", handleDefaultPriorityChange);
  document.getElementById("clearDataBtn").addEventListener("click", handleClearData);
  document.getElementById("calPrevBtn").addEventListener("click", goToPrevMonth);
  document.getElementById("calNextBtn").addEventListener("click", goToNextMonth);
});