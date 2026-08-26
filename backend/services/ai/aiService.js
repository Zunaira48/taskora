const geminiProvider = require('./geminiProvider');
const { buildTaskBreakdownPrompt, buildSmartTaskPrompt } = require('./prompts');
const {
  TASK_BREAKDOWN_RESPONSE_SCHEMA, validateTaskBreakdown,
  SMART_TASK_RESPONSE_SCHEMA, validateSmartTask
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

module.exports = { ping, breakdownTask, extractSmartTask };