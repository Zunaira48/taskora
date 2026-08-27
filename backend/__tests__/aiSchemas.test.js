const {
  validateTaskBreakdown,
  validateSmartTask,
  validatePriorityRecommendation,
  validatePlanMyDay
} = require('../services/ai/schemas');

describe('validateTaskBreakdown', () => {
  test('throws if subtasks is missing or not an array', () => {
    expect(() => validateTaskBreakdown({})).toThrow();
    expect(() => validateTaskBreakdown({ subtasks: 'not an array' })).toThrow();
  });

  test('filters out empty strings and non-strings', () => {
    const result = validateTaskBreakdown({ subtasks: ['Do this', '', 42, '  ', 'Do that'] });
    expect(result).toEqual(['Do this', 'Do that']);
  });

  test('caps the list at 10 items regardless of how many the model returned', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Step ${i}`);
    const result = validateTaskBreakdown({ subtasks: many });
    expect(result).toHaveLength(10);
  });

  test('throws if every subtask was filtered out', () => {
    expect(() => validateTaskBreakdown({ subtasks: ['', '   ', 123] })).toThrow();
  });
});

describe('validateSmartTask', () => {
  test('throws if title is missing', () => {
    expect(() => validateSmartTask({ category: 'Work' })).toThrow();
  });

  test('defaults an invalid priority to medium', () => {
    const result = validateSmartTask({ title: 'Test', priority: 'urgent-ish' });
    expect(result.priority).toBe('medium');
  });

  test('rejects a malformed due date and falls back to null', () => {
    const result = validateSmartTask({ title: 'Test', priority: 'high', dueDate: 'next Friday' });
    expect(result.dueDate).toBeNull();
  });

  test('accepts a valid ISO due date', () => {
    const result = validateSmartTask({ title: 'Test', priority: 'high', dueDate: '2026-08-28' });
    expect(result.dueDate).toBe('2026-08-28');
  });

  test('caps labels at 3 items', () => {
    const result = validateSmartTask({ title: 'Test', priority: 'low', labels: ['a', 'b', 'c', 'd', 'e'] });
    expect(result.labels).toHaveLength(3);
  });
});

describe('validatePriorityRecommendation', () => {
  test('throws on an invalid priority value', () => {
    expect(() => validatePriorityRecommendation({ recommendedPriority: 'super-high', reason: 'x' })).toThrow();
  });

  test('accepts a valid recommendation', () => {
    const result = validatePriorityRecommendation({ recommendedPriority: 'high', reason: 'Due tomorrow' });
    expect(result.recommendedPriority).toBe('high');
  });
});

describe('validatePlanMyDay', () => {
  test('drops any taskId not in the valid set — the hallucination guard', () => {
    const validIds = new Set(['t1', 't2']);
    const result = validatePlanMyDay({
      plan: [
        { taskId: 't1', reason: 'Real task' },
        { taskId: 't999', reason: 'Hallucinated task' }
      ]
    }, validIds);

    expect(result.plan).toHaveLength(1);
    expect(result.plan[0].taskId).toBe('t1');
  });

  test('caps the plan at 10 items', () => {
    const validIds = new Set(Array.from({ length: 20 }, (_, i) => `t${i}`));
    const plan = Array.from({ length: 20 }, (_, i) => ({ taskId: `t${i}`, reason: 'reason' }));
    const result = validatePlanMyDay({ plan }, validIds);
    expect(result.plan).toHaveLength(10);
  });
});