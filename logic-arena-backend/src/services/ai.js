const provider = process.env.AI_PROVIDER || 'openai';

let service;
if (provider === 'openai') {
  service = await import('./openai.js');
} else {
  service = await import('./gemini.js');
}

console.log(`[AI] Provider: ${provider}`);

export const { generateTopic, generateAiResponse } = service;
