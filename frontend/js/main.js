function showBackendError() {
  document.getElementById("backendBanner").classList.add("backend-banner--visible");
}

function hideBackendError() {
  document.getElementById("backendBanner").classList.remove("backend-banner--visible");
}

function showToast(message, type = "error") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}
// ===== AUTH GATE =====

function showAuthScreen() {
  document.getElementById("authScreen").style.display = "flex";
  document.getElementById("appRoot").style.display = "none";
}

function showApp(email) {
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("appRoot").style.display = "grid";
  document.getElementById("userEmailDisplay").textContent = email;
  document.getElementById("userAvatar").textContent = email.slice(0, 2).toUpperCase();
}

function handleSessionExpired() {
  showAuthScreen();
}

let isRegisterMode = false;

function toggleAuthMode(e) {
  e.preventDefault();
  isRegisterMode = !isRegisterMode;
  document.getElementById("authSubtitle").textContent = isRegisterMode
    ? "Create your account" : "Log in to your account";
  document.getElementById("authSubmitBtn").textContent = isRegisterMode
    ? "Create account" : "Log in";
  document.getElementById("authToggleText").textContent = isRegisterMode
    ? "Already have an account?" : "Don't have an account?";
  document.getElementById("authToggleLink").textContent = isRegisterMode
    ? "Log in" : "Create one";
  document.getElementById("authError").textContent = "";
}

async function handleAuthFormSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const errorEl = document.getElementById("authError");
  errorEl.textContent = "";

  try {
    const result = isRegisterMode
      ? await registerAccount(email, password)
      : await loginAccount(email, password);

    showApp(result.email);
    await initializeApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function handleLogout() {
  await logoutAccount();
  showAuthScreen();
  document.getElementById("authForm").reset();
}

async function initializeApp() {
  const loadingEl = document.getElementById("appLoading");
  loadingEl.classList.add("app-loading--visible");
  try {
    loadSavedTheme();
    document.getElementById("taskPriority").value = localStorage.getItem("taskora_default_priority") || "medium";
    await seedTasksIfEmpty();
    await refreshUI();
  } finally {
    loadingEl.classList.remove("app-loading--visible");
  }
}

// ===== CORE APP LOGIC =====

async function refreshUI() {
  await updateGreeting();
  await renderTaskList();
  await renderStats();
  await renderActivity();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Hey, night owl";
}

async function updateGreeting() {
  document.getElementById("dashboardGreeting").textContent = getGreeting();

  const tasks = await getAllTasks();
  const todayStr = new Date().toISOString().slice(0, 10);
  const dueToday = tasks.filter(t => t.dueDate === todayStr && t.status !== "done").length;

  const subtextEl = document.getElementById("dashboardSubtext");
  if (dueToday === 0) {
    subtextEl.textContent = "You have no tasks due today.";
  } else if (dueToday === 1) {
    subtextEl.textContent = "You have 1 task due today.";
  } else {
    subtextEl.textContent = `You have ${dueToday} tasks due today.`;
  }
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
    const labelChips = task.labels.map(l => `<span class="task-item__label">${l}</span>`).join("");

    return `
      <li class="task-item ${task.status === 'done' ? 'task-item--done' : ''} ${isOverdue ? 'task-item--overdue' : ''}">
        <input type="checkbox" class="task-item__checkbox" data-id="${task.id}" ${task.status === 'done' ? 'checked' : ''} />
        <span class="task-item__title">${task.title}</span>
         ${task.status === "todo" ? `<button class="task-item__start" data-id="${task.id}">Start</button>` : ""}
         ${task.status === "in-progress" ? `<button class="task-item__status-pill" data-id="${task.id}" title="Click to move back to To do">↺ In progress</button>` : ""}
         <span class="task-item__category">${task.category}</span>
        ${labelChips}
        ${task.dueDate ? `<span class="task-item__due">${task.dueDate}</span>` : ''}
        <span class="task-item__badge task-item__badge--${task.priority}">
          ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
        <button class="task-item__edit" data-id="${task.id}" aria-label="Edit task">✎</button>
        <button class="task-item__delete" data-id="${task.id}" aria-label="Delete task">&times;</button>
      </li>
    `;
  }).join("");

  attachTaskListeners();
}

async function attachTaskListeners() {
  document.querySelectorAll(".task-item__checkbox").forEach(checkbox => {
    checkbox.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const newStatus = e.target.checked ? "done" : "todo";
      const allTasks = await getAllTasks();
      const task = allTasks.find(t => t.id === id);
      await updateTask(id, { status: newStatus });

      if (newStatus === "done") {
        await logActivity(`Completed "${task.title}"`);
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
      await logActivity(`Deleted "${task.title}"`);
      await refreshUI();
    });
  });

  document.querySelectorAll(".task-item__edit").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      const allTasks = await getAllTasks();
      const task = allTasks.find(t => t.id === id);
      openModal(task);
    });
  });

  document.querySelectorAll(".task-item__start").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      const allTasks = await getAllTasks();
      const task = allTasks.find(t => t.id === id);
      await updateTask(id, { status: "in-progress" });
      await logActivity(`Started "${task.title}"`);
      await refreshUI();
    });
  });

  document.querySelectorAll(".task-item__status-pill").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      const allTasks = await getAllTasks();
      const task = allTasks.find(t => t.id === id);
      await updateTask(id, { status: "todo" });
      await logActivity(`Moved "${task.title}" back to To do`);
      await refreshUI();
    });
  });
}

function openModal(task = null) {
  const form = document.getElementById("taskForm");
  form.reset();

  const aiPriorityBtn = document.getElementById("aiPriorityBtn");
  document.getElementById("aiPrioritySuggestion").style.display = "none";

  if (task) {
    document.getElementById("modalTitle").textContent = "Edit task";
    document.getElementById("modalSubmitBtn").textContent = "Save changes";
    document.getElementById("editingTaskId").value = task.id;
    document.getElementById("taskTitle").value = task.title;
    document.getElementById("taskCategory").value = task.category;
    document.getElementById("taskPriority").value = task.priority;
    document.getElementById("taskDueDate").value = task.dueDate || "";
    document.getElementById("taskLabels").value = task.labels.join(", ");
    aiPriorityBtn.style.display = "inline-block"; // only meaningful for an existing task
  } else {
    document.getElementById("modalTitle").textContent = "Add task";
    document.getElementById("modalSubmitBtn").textContent = "Add task";
    document.getElementById("editingTaskId").value = "";
    aiPriorityBtn.style.display = "none";
  }

  document.getElementById("modalOverlay").classList.add("modal-overlay--open");
  document.getElementById("taskTitle").focus();
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("modal-overlay--open");
  document.getElementById("taskForm").reset();
  document.getElementById("editingTaskId").value = "";
  hideAiBreakdownResults();
}

function hideAiBreakdownResults() {
  document.getElementById("aiBreakdownResults").style.display = "none";
  document.getElementById("aiBreakdownList").innerHTML = "";
}

async function handleAiBreakdown() {
  const title = document.getElementById("taskTitle").value.trim();
  if (!title) {
    alert("Enter a task title first.");
    return;
  }

  const btn = document.getElementById("aiBreakdownBtn");
  const originalText = btn.textContent;
  btn.textContent = "Thinking…";
  btn.disabled = true;

  try {
    const res = await safeFetch(`${API_BASE}/ai/breakdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "AI is temporarily unavailable. Your Taskora data is safe.");
      return;
    }

    const { subtasks } = await res.json();
    const listEl = document.getElementById("aiBreakdownList");
    listEl.innerHTML = subtasks.map((subtask, i) => `
      <li>
        <input type="checkbox" id="ai-subtask-${i}" checked value="${subtask.replace(/"/g, '&quot;')}" />
        <label for="ai-subtask-${i}">${subtask}</label>
      </li>
    `).join("");

    document.getElementById("aiBreakdownResults").style.display = "block";
  } catch (err) {
    showToast("AI is temporarily unavailable. Your Taskora data is safe.");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function handleAddSelectedSubtasks() {
  const checkboxes = document.querySelectorAll('#aiBreakdownList input[type="checkbox"]:checked');
  const category = document.getElementById("taskCategory").value.trim() || "General";

  for (const checkbox of checkboxes) {
    await addTask({ title: checkbox.value, category, priority: "medium" });
    await logActivity(`Added task "${checkbox.value}"`);
  }

  hideAiBreakdownResults();
  closeModal();
  await refreshUI();
}

async function handleAiPriorityRecommend() {
  const taskId = document.getElementById("editingTaskId").value;
  if (!taskId) return;

  const btn = document.getElementById("aiPriorityBtn");
  const originalText = btn.textContent;
  btn.textContent = "Thinking…";
  btn.disabled = true;

  try {
    const res = await safeFetch(`${API_BASE}/ai/priority-recommendation/${taskId}`, {
      method: "POST"
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "AI is temporarily unavailable. Your Taskora data is safe.");
      return;
    }

    const { recommendedPriority, reason } = await res.json();
    document.getElementById("aiPriorityText").textContent =
      `Recommended: ${recommendedPriority.toUpperCase()} — ${reason}`;
    document.getElementById("aiPrioritySuggestion").dataset.recommended = recommendedPriority;
    document.getElementById("aiPrioritySuggestion").style.display = "block";
  } catch (err) {
    showToast("AI is temporarily unavailable. Your Taskora data is safe.");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function handleAiPriorityAccept() {
  const recommended = document.getElementById("aiPrioritySuggestion").dataset.recommended;
  document.getElementById("taskPriority").value = recommended;
  document.getElementById("aiPrioritySuggestion").style.display = "none";
}

function handleAiPriorityReject() {
  document.getElementById("aiPrioritySuggestion").style.display = "none";
}

function openSmartAddModal() {
  document.getElementById("smartAddModalOverlay").classList.add("modal-overlay--open");
  document.getElementById("smartAddInput").value = "";
  document.getElementById("smartAddReview").style.display = "none";
  document.getElementById("smartAddInput").focus();
}

function closeSmartAddModal() {
  document.getElementById("smartAddModalOverlay").classList.remove("modal-overlay--open");
}

async function handleSmartAddExtract() {
  const input = document.getElementById("smartAddInput").value.trim();
  if (!input) return;

  const btn = document.getElementById("smartAddExtractBtn");
  const originalText = btn.textContent;
  btn.textContent = "Thinking…";
  btn.disabled = true;

  try {
    const res = await safeFetch(`${API_BASE}/ai/smart-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "AI is temporarily unavailable. Your Taskora data is safe.");
      return;
    }

    const extracted = await res.json();
    document.getElementById("smartTitle").value = extracted.title;
    document.getElementById("smartCategory").value = extracted.category;
    document.getElementById("smartPriority").value = extracted.priority;
    document.getElementById("smartDueDate").value = extracted.dueDate || "";
    document.getElementById("smartLabels").value = extracted.labels.join(", ");
    document.getElementById("smartAddReview").style.display = "block";
  } catch (err) {
    showToast("AI is temporarily unavailable. Your Taskora data is safe.");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function handleSmartAddConfirm() {
  const title = document.getElementById("smartTitle").value.trim();
  if (!title) return;

  const category = document.getElementById("smartCategory").value.trim() || "General";
  const priority = document.getElementById("smartPriority").value;
  const dueDate = document.getElementById("smartDueDate").value || null;
  const labels = document.getElementById("smartLabels").value
    .split(",").map(l => l.trim()).filter(Boolean);

  await addTask({ title, category, priority, dueDate, labels });
  await logActivity(`Added task "${title}"`);
  closeSmartAddModal();
  await refreshUI();
}

function openPlanMyDayModal() {
  document.getElementById("planMyDayModalOverlay").classList.add("modal-overlay--open");
}

function closePlanMyDayModal() {
  document.getElementById("planMyDayModalOverlay").classList.remove("modal-overlay--open");
}

async function handlePlanMyDay() {
  const btn = document.getElementById("planMyDayBtn");
  const originalText = btn.textContent;
  btn.textContent = "Thinking…";
  btn.disabled = true;

  try {
    const res = await safeFetch(`${API_BASE}/ai/plan-my-day`, { method: "POST" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "AI is temporarily unavailable. Your Taskora data is safe.");
      return;
    }

    const { summary, plan } = await res.json();
    document.getElementById("planMyDaySummary").textContent = summary;

    const listEl = document.getElementById("planMyDayList");
    if (plan.length === 0) {
      listEl.innerHTML = `<li style="color: var(--color-text-muted);">Nothing to plan right now.</li>`;
    } else {
      listEl.innerHTML = plan.map(item => `
        <li style="background: var(--color-surface-alt); border-radius: var(--radius-md); padding: 10px 14px;">
          <strong>${item.title}</strong>
          <div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 4px;">${item.reason}</div>
        </li>
      `).join("");
    }

    openPlanMyDayModal();
  } catch (err) {
    showToast("AI is temporarily unavailable. Your Taskora data is safe.");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function handleTaskFormSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("taskTitle").value.trim();
  if (!title) return;

  const category = document.getElementById("taskCategory").value.trim() || "General";
  const priority = document.getElementById("taskPriority").value;
  const dueDate = document.getElementById("taskDueDate").value || null;
  const labels = document.getElementById("taskLabels").value
    .split(",").map(l => l.trim()).filter(Boolean);
  const editingId = document.getElementById("editingTaskId").value;

  if (editingId) {
    await updateTask(editingId, { title, category, priority, dueDate, labels });
    await logActivity(`Edited "${title}"`);
  } else {
    await addTask({ title, category, priority, dueDate, labels });
    await logActivity(`Added task "${title}"`);
  }

  closeModal();
  await refreshUI();
}

// ===== NOTES (task board only) =====

let currentNotesTaskId = null;

function openNotesModal(task) {
  currentNotesTaskId = task.id;
  document.getElementById("notesModalTitle").textContent = "Notes";
  document.getElementById("notesModalSubtitle").textContent = task.title;
  document.getElementById("notesTextarea").value = task.notes || "";
  document.getElementById("notesModalOverlay").classList.add("modal-overlay--open");
  document.getElementById("notesTextarea").focus();
}

function closeNotesModal() {
  document.getElementById("notesModalOverlay").classList.remove("modal-overlay--open");
  currentNotesTaskId = null;
}

async function saveNotes() {
  if (!currentNotesTaskId) return;
  const notes = document.getElementById("notesTextarea").value;
  await updateTask(currentNotesTaskId, { notes });
  await logActivity(`Updated notes`);
  closeNotesModal();
  await renderBoard();
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

async function renderActivity() {
  const listEl = document.getElementById("activityList");
  const activity = await getActivity();

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
  document.querySelectorAll(".page").forEach(page => page.classList.add("page--hidden"));
  document.getElementById(pageId).classList.remove("page--hidden");

  document.querySelectorAll(".sidebar__nav-link").forEach(link => link.classList.remove("sidebar__nav-link--active"));
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

  if (tasks.length === 0) {
    columns.todo.innerHTML = `<li class="board__card board__card--empty">No tasks yet — add one from the dashboard.</li>`;
    return;
  }

  tasks.forEach(task => {
    const key = task.status === "in-progress" ? "inprogress" : task.status;
    const card = document.createElement("li");
    card.className = "board__card";
    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <span class="board__card-title">${task.title}</span>
        <button class="board__card-notes-icon ${task.notes ? 'board__card-notes-icon--has-notes' : ''}" data-id="${task.id}" title="Notes">📝</button>
      </div>
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
      await logActivity(`Moved "${allTasks.find(t => t.id === id).title}" to ${newStatus}`);
      await renderBoard();
      await renderStats();
    });
  });

  document.querySelectorAll(".board__card-notes-icon").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      const allTasks = await getAllTasks();
      const task = allTasks.find(t => t.id === id);
      openNotesModal(task);
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
  const confirmed = confirm("This will permanently delete all tasks. Continue?");
  if (!confirmed) return;

  const tasks = await getAllTasks();
  for (const task of tasks) {
    await deleteTask(task.id);
  }

  await refreshUI();
}


let calendarDate = new Date();
calendarDate.setDate(1);

async function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  document.getElementById("calMonthLabel").textContent = `${monthNames[month]} ${year}`;

  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekday = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const tasks = await getAllTasks();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  let cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) cells.push({ day: daysInPrevMonth - i, outside: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, outside: false });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - (startWeekday + daysInMonth) + 1, outside: true });

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

function goToPrevMonth() { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); }
function goToNextMonth() { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); }

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
    if (reminderIntervalId) { clearInterval(reminderIntervalId); reminderIntervalId = null; }
    updateNotifsButton();
    return;
  }
  if (!("Notification" in window)) { alert("This browser doesn't support notifications."); return; }
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
      alert("Notifications permission was denied. Change this in your browser's site settings.");
    }
  });
}

async function checkDueTasks() {
  if (localStorage.getItem("taskora_notifs_enabled") !== "true") return;
  if (Notification.permission !== "granted") return;

  const tasks = await getAllTasks();
  const todayStr = new Date().toISOString().slice(0, 10);

  tasks.forEach(task => {
    if (task.status === "done" || !task.dueDate) return;
    if (notifiedTaskIds.has(task.id)) return;
    if (task.dueDate > todayStr) return;

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

let copilotHistory = [];

function openCopilotPanel() {
  document.getElementById("copilotPanel").classList.add("copilot-panel--open");
  document.getElementById("copilotInput").focus();
}

function closeCopilotPanel() {
  document.getElementById("copilotPanel").classList.remove("copilot-panel--open");
}

function appendCopilotMessage(role, content) {
  const messagesEl = document.getElementById("copilotMessages");
  const bubble = document.createElement("div");
  bubble.className = `copilot-message copilot-message--${role}`;
  bubble.textContent = content;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function handleCopilotSend() {
  const input = document.getElementById("copilotInput");
  const message = input.value.trim();
  if (!message) return;

  appendCopilotMessage("user", message);
  input.value = "";

  const sendBtn = document.getElementById("copilotSendBtn");
  sendBtn.disabled = true;

  try {
    const res = await safeFetch(`${API_BASE}/ai/copilot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: copilotHistory })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      appendCopilotMessage("assistant", data.error || "AI is temporarily unavailable. Your Taskora data is safe.");
      return;
    }

    const { reply } = await res.json();
    appendCopilotMessage("assistant", reply);

    copilotHistory.push({ role: "user", content: message });
    copilotHistory.push({ role: "assistant", content: reply });
    copilotHistory = copilotHistory.slice(-10); // keep client-side history bounded too
  } catch (err) {
    appendCopilotMessage("assistant", "AI is temporarily unavailable. Your Taskora data is safe.");
  } finally {
    sendBtn.disabled = false;
  }
}

async function handleWeeklyReview() {
  const btn = document.getElementById("weeklyReviewBtn");
  const originalText = btn.textContent;
  btn.textContent = "Thinking…";
  btn.disabled = true;

  try {
    const res = await safeFetch(`${API_BASE}/ai/weekly-review`, { method: "POST" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "AI is temporarily unavailable. Your Taskora data is safe.");
      return;
    }

    const { completedThisWeek, createdThisWeek, completionRate, overdueCount, insight, recommendations } = await res.json();

    document.getElementById("reviewCompleted").textContent = completedThisWeek;
    document.getElementById("reviewCreated").textContent = createdThisWeek;
    document.getElementById("reviewRate").textContent = `${completionRate}%`;
    document.getElementById("reviewOverdue").textContent = overdueCount;
    document.getElementById("reviewInsight").textContent = insight;
    document.getElementById("reviewRecommendations").innerHTML =
      recommendations.map(r => `<li>${r}</li>`).join("");

    document.getElementById("weeklyReviewPanel").style.display = "block";
  } catch (err) {
    showToast("AI is temporarily unavailable. Your Taskora data is safe.");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// ===== STARTUP =====

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("authForm").addEventListener("submit", handleAuthFormSubmit);
  document.getElementById("authToggleLink").addEventListener("click", toggleAuthMode);
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);

  const user = await getCurrentUser();
  if (user) {
    showApp(user.email);
    await initializeApp();
  } else {
    showAuthScreen();
  }

  document.getElementById("quickAddBtn").addEventListener("click", () => openModal());
  document.getElementById("smartAddBtn").addEventListener("click", openSmartAddModal);
  document.getElementById("planMyDayBtn").addEventListener("click", handlePlanMyDay);  
  document.getElementById("weeklyReviewBtn").addEventListener("click", handleWeeklyReview);
  document.getElementById("copilotFab").addEventListener("click", openCopilotPanel);
  document.getElementById("copilotClose").addEventListener("click", closeCopilotPanel);
  document.getElementById("copilotSendBtn").addEventListener("click", handleCopilotSend);
  document.getElementById("copilotInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleCopilotSend();
  });
  document.getElementById("planMyDayModalClose").addEventListener("click", closePlanMyDayModal);
  document.getElementById("planMyDayModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "planMyDayModalOverlay") closePlanMyDayModal();
  });
  document.getElementById("smartAddModalClose").addEventListener("click", closeSmartAddModal);
  document.getElementById("smartAddExtractBtn").addEventListener("click", handleSmartAddExtract);
  document.getElementById("smartAddConfirmBtn").addEventListener("click", handleSmartAddConfirm);
  document.getElementById("smartAddModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "smartAddModalOverlay") closeSmartAddModal();
  });
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("aiBreakdownBtn").addEventListener("click", handleAiBreakdown);
  document.getElementById("aiPriorityBtn").addEventListener("click", handleAiPriorityRecommend);
  document.getElementById("aiPriorityAccept").addEventListener("click", handleAiPriorityAccept);
  document.getElementById("aiPriorityReject").addEventListener("click", handleAiPriorityReject);
  document.getElementById("aiAddSelectedBtn").addEventListener("click", handleAddSelectedSubtasks);
  document.getElementById("taskForm").addEventListener("submit", handleTaskFormSubmit);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);

  document.getElementById("searchInput").addEventListener("input", renderTaskList);
  document.getElementById("filterSelect").addEventListener("change", renderTaskList);
  document.getElementById("sortSelect").addEventListener("change", renderTaskList);

  const mobileMenuToggle = document.getElementById("mobileMenuToggle");
  const sidebarNav = document.getElementById("sidebarNav");

  mobileMenuToggle.addEventListener("click", () => {
    const isOpen = sidebarNav.classList.toggle("sidebar__nav--open");
    mobileMenuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  document.querySelectorAll(".sidebar__nav-link[data-page]").forEach(link => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      await switchPage(link.dataset.page);
      sidebarNav.classList.remove("sidebar__nav--open"); // close the mobile menu after picking a page
      mobileMenuToggle.setAttribute("aria-expanded", "false");
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

  document.getElementById("notesModalClose").addEventListener("click", closeNotesModal);
  document.getElementById("saveNotesBtn").addEventListener("click", saveNotes);
  document.getElementById("notesModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "notesModalOverlay") closeNotesModal();
  });
});