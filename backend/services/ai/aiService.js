const geminiProvider = require('./geminiProvider');

async function ping(prompt) {
  return geminiProvider.generateText(prompt);
}

module.exports = { ping };