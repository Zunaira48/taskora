function buildTaskBreakdownPrompt(taskTitle) {
  return `You are a productivity assistant helping break a task into clear, actionable subtasks.

Task: "${taskTitle}"

Break this task into 4 to 8 concrete subtasks a person could complete one at a time, in a sensible order. Each subtask should be short and specific — not a vague restatement of the task itself.`;
}

module.exports = { buildTaskBreakdownPrompt };

function buildSmartTaskPrompt(naturalLanguageInput) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });

  return `You are extracting structured task data from a person's natural language description.

Today is ${dayName}, ${today}. Use this to compute any relative dates precisely — for example, if today is Thursday and the input says "Friday," that means tomorrow, not today. If it says "next Friday," that means the Friday after this coming one.

Input: "${naturalLanguageInput}"

Extract:
- title: a short, clear task title (not the full input verbatim)
- category: a single short category word like "Work", "Personal", "Study", or similar — infer from context, default to "General" if unclear
- priority: one of "low", "medium", "high" — infer urgency from the wording
- dueDate: an ISO date (YYYY-MM-DD) if the input mentions a specific day, deadline, or relative date like "Friday" or "next week" — otherwise null
- labels: 0 to 3 short single-word labels relevant to the task, or an empty array if none fit`;
}

module.exports = { buildTaskBreakdownPrompt, buildSmartTaskPrompt };

function buildPriorityRecommendationPrompt(task) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });

  return `You are recommending a priority level for a task based on its context.

Today is ${dayName}, ${today}.

Task details:
- Title: "${task.title}"
- Category: ${task.category}
- Current priority: ${task.priority}
- Status: ${task.status}
- Due date: ${task.dueDate || 'none set'}

Recommend a priority of "low", "medium", or "high" based on how urgent this task appears given its due date and status. If the due date is very close or has passed and the task isn't done, that should push priority up. If there's no due date and nothing suggests urgency, lean toward the existing priority unless the title itself suggests urgency.

Provide a short reason (one sentence, plain language) explaining the recommendation — something the person could read and immediately understand, like "Due tomorrow and still not started."`;
}

module.exports = { buildTaskBreakdownPrompt, buildSmartTaskPrompt, buildPriorityRecommendationPrompt };