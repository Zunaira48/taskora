function createTask({ title, category = "General", priority = "medium", dueDate = null }) {
  return {
    id: crypto.randomUUID(),
    title,
    category,
    priority,       // "low" | "medium" | "high" | "urgent"
    status: "todo",  // "todo" | "in-progress" | "done"
    dueDate,
    labels: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}