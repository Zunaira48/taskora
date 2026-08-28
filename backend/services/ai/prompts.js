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

function buildPlanMyDayPrompt(tasks) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });

  const taskList = tasks.map(t =>
    `- id: ${t.id} | "${t.title}" | priority: ${t.priority} | status: ${t.status} | due: ${t.dueDate || 'none'}`
  ).join('\n');

  return `You are a productivity assistant helping someone plan their day.

Today is ${dayName}, ${today}.

Here are their current open tasks:
${taskList}

Select and order a practical subset of these tasks for today — don't necessarily include everything, just what's realistic to focus on. Prioritize overdue and due-soon items, then high priority, then everything else. For each task you include, give a short one-sentence reason. Also provide a brief one-sentence overall summary of the day's focus.

Reference tasks only by their exact id shown above — do not invent ids.`;
}

module.exports = {
  buildTaskBreakdownPrompt,
  buildSmartTaskPrompt,
  buildPriorityRecommendationPrompt,
  buildPlanMyDayPrompt
};

function buildCopilotPrompt(userMessage, history, context) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });

  const taskList = context.openTasks.length === 0
    ? '(no open tasks)'
    : context.openTasks.map(t =>
        `- "${t.title}" | priority: ${t.priority} | status: ${t.status} | due: ${t.dueDate || 'none'}`
      ).join('\n');

  const historyText = history.map(turn =>
    `${turn.role === 'user' ? 'User' : 'Taskora'}: ${turn.content}`
  ).join('\n');

  return `You are Taskora Copilot, a productivity assistant with access to this person's current task data. Be concise, direct, and practical — a few sentences, not an essay, unless the question genuinely needs more detail.

Today is ${dayName}, ${today}.

Their current open tasks:
${taskList}

This week: ${context.completedThisWeek} completed, ${context.createdThisWeek} created, ${context.overdueCount} currently overdue.

${historyText ? `Conversation so far:\n${historyText}\n` : ''}
User: ${userMessage}

Respond directly to what they asked, grounded only in the task data above. If asked to break a task into subtasks, you can suggest a short list in plain text. Never invent tasks that aren't in the list above.`;
}

module.exports = {
  buildTaskBreakdownPrompt, buildSmartTaskPrompt,
  buildPriorityRecommendationPrompt, buildPlanMyDayPrompt,
  buildCopilotPrompt
};