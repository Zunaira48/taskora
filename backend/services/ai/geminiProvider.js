const { GoogleGenAI } = require('@google/genai');

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

async function generateText(prompt) {
  const response = await client.models.generateContent({
    model: MODEL,
    contents: prompt
  });
  return response.text;
}

module.exports = { generateText };