const TASK_BREAKDOWN_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    subtasks: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['subtasks']
};

// AI output is untrusted input — re-check it even though we asked for a constrained shape.
function validateTaskBreakdown(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.subtasks)) {
    throw new Error('AI response was not in the expected format');
  }

  const cleaned = data.subtasks
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0 && item.length <= 150)
    .slice(0, 10); // hard cap regardless of what the model claims to have returned

  if (cleaned.length === 0) {
    throw new Error('AI did not return any usable subtasks');
  }

  return cleaned;
}

module.exports = { TASK_BREAKDOWN_RESPONSE_SCHEMA, validateTaskBreakdown };

const SMART_TASK_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    category: { type: 'string' },
    priority: { type: 'string', enum: ['low', 'medium', 'high'] },
    dueDate: { type: 'string', nullable: true },
    labels: { type: 'array', items: { type: 'string' } }
  },
  required: ['title', 'category', 'priority']
};

const VALID_PRIORITIES = ['low', 'medium', 'high'];
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateSmartTask(data) {
  if (!data || typeof data !== 'object' || typeof data.title !== 'string' || !data.title.trim()) {
    throw new Error('AI response was not in the expected format');
  }

  const title = data.title.trim().slice(0, 255);
  const category = (typeof data.category === 'string' && data.category.trim())
    ? data.category.trim().slice(0, 100)
    : 'General';
  const priority = VALID_PRIORITIES.includes(data.priority) ? data.priority : 'medium';
  const dueDate = (typeof data.dueDate === 'string' && ISO_DATE_PATTERN.test(data.dueDate))
    ? data.dueDate
    : null;
  const labels = Array.isArray(data.labels)
    ? data.labels.filter(l => typeof l === 'string').map(l => l.trim()).filter(Boolean).slice(0, 3)
    : [];

  return { title, category, priority, dueDate, labels };
}

module.exports = {
  TASK_BREAKDOWN_RESPONSE_SCHEMA,
  validateTaskBreakdown,
  SMART_TASK_RESPONSE_SCHEMA,
  validateSmartTask
};

const PRIORITY_RECOMMENDATION_SCHEMA = {
  type: 'object',
  properties: {
    recommendedPriority: { type: 'string', enum: ['low', 'medium', 'high'] },
    reason: { type: 'string' }
  },
  required: ['recommendedPriority', 'reason']
};

function validatePriorityRecommendation(data) {
  if (!data || typeof data !== 'object' || !VALID_PRIORITIES.includes(data.recommendedPriority)) {
    throw new Error('AI response was not in the expected format');
  }

  const reason = (typeof data.reason === 'string' && data.reason.trim())
    ? data.reason.trim().slice(0, 200)
    : 'No specific reason provided.';

  return { recommendedPriority: data.recommendedPriority, reason };
}

module.exports = {
  TASK_BREAKDOWN_RESPONSE_SCHEMA,
  validateTaskBreakdown,
  SMART_TASK_RESPONSE_SCHEMA,
  validateSmartTask,
  PRIORITY_RECOMMENDATION_SCHEMA,
  validatePriorityRecommendation
};