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

// Constrains Gemini's output to match responseSchema (an OpenAPI-style schema object).
// Still treat the result as untrusted — validate it again after parsing (see schemas.js).
async function generateJSON(prompt, responseSchema) {
  const response = await client.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema
    }
  });
  return JSON.parse(response.text);
}

module.exports = { generateText, generateJSON };