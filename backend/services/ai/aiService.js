const geminiProvider = require('./geminiProvider');
const {
  buildTaskBreakdownPrompt, buildSmartTaskPrompt,
  buildPriorityRecommendationPrompt, buildPlanMyDayPrompt
} = require('./prompts');
const {
  TASK_BREAKDOWN_RESPONSE_SCHEMA, validateTaskBreakdown,
  SMART_TASK_RESPONSE_SCHEMA, validateSmartTask,
  PRIORITY_RECOMMENDATION_SCHEMA, validatePriorityRecommendation,
  PLAN_MY_DAY_SCHEMA, validatePlanMyDay
} = require('./schemas');

async function ping(prompt) {
  return geminiProvider.generateText(prompt);
}

async function breakdownTask(taskTitle) {
  const prompt = buildTaskBreakdownPrompt(taskTitle);
  const data = await geminiProvider.generateJSON(prompt, TASK_BREAKDOWN_RESPONSE_SCHEMA);
  return validateTaskBreakdown(data);
}

async function extractSmartTask(naturalLanguageInput) {
  const prompt = buildSmartTaskPrompt(naturalLanguageInput);
  const data = await geminiProvider.generateJSON(prompt, SMART_TASK_RESPONSE_SCHEMA);
  return validateSmartTask(data);
}

async function recommendPriority(task) {
  const prompt = buildPriorityRecommendationPrompt(task);
  const data = await geminiProvider.generateJSON(prompt, PRIORITY_RECOMMENDATION_SCHEMA);
  return validatePriorityRecommendation(data);
}

async function planMyDay(tasks) {
  const prompt = buildPlanMyDayPrompt(tasks);
  const data = await geminiProvider.generateJSON(prompt, PLAN_MY_DAY_SCHEMA);
  const validTaskIds = new Set(tasks.map(t => t.id));
  return validatePlanMyDay(data, validTaskIds);
}

module.exports = { ping, breakdownTask, extractSmartTask, recommendPriority, planMyDay };