import { createAiGuard } from './aiBudget.js';
const provider = process.env.AI_PROVIDER || 'openai';

let service;
if (provider === 'openai') {
  service = await import('./openai.js');
} else {
  service = await import('./gemini.js');
}

console.log(`[AI] Provider: ${provider}`);

const guard = createAiGuard();

export const {
  generateTopic,
  generateArgument,
  generateRebuttal,
  generateDefense,
  generateCounter,
  generateCoaching,
  generateSoloFeedback,
  judgeDebate,
  judgeSoloEssay,
  generateTrainingRecommendation,
  generateTeacherDebateSummary,
  generateSetukDraft,
  summarizeSetuk,
} = Object.fromEntries(Object.entries(service).map(([name, fn]) => [name, typeof fn === 'function' ? guard(fn) : fn]));
