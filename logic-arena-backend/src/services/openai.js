import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!process.env.OPENAI_API_KEY) {
  console.warn('[OpenAI] WARNING: OPENAI_API_KEY is not set.');
} else {
  console.log(`[OpenAI] API key loaded. Model: ${MODEL}`);
}

const FALLBACK_TOPICS = [
  '인공지능이 인간의 일자리를 대체해야 한다',
  '사형제도는 폐지되어야 한다',
  '원격 근무는 사무실 근무보다 생산적이다',
  '소셜 미디어는 사회에 해롭다',
  '대학 교육은 무상으로 제공되어야 한다',
];

/**
 * @param {string[]} previousTopics - Already-used topics to avoid repetition
 * @returns {Promise<string>} - A new debate topic
 */
export async function generateTopic(previousTopics = []) {
  try {
    let prompt =
      '찬반 토론이 가능한 주제를 한국어로 하나만 추천해주세요. 주제만 답해주세요, 다른 설명은 필요 없습니다.';

    if (previousTopics.length > 0) {
      prompt += `\n다음 주제들은 이미 사용했으므로 제외해주세요: ${previousTopics.join(', ')}`;
    }

    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
    });
    return res.choices[0].message.content.trim();
  } catch (err) {
    console.error('[OpenAI] generateTopic 실패, 폴백 주제 사용.');
    console.error('[OpenAI] Error detail:', err.message);
    const unused = FALLBACK_TOPICS.filter((t) => !previousTopics.includes(t));
    const pool = unused.length > 0 ? unused : FALLBACK_TOPICS;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

/**
 * @param {object} params
 * @param {string} params.topic - The debate topic
 * @param {'pro'|'con'} params.vote - AI's stance
 * @param {Array<{username: string, content: string, vote: 'pro'|'con'}>} params.chatHistory
 * @param {string} params.triggerMessage - The message the AI is responding to
 * @returns {Promise<string>} - AI response text
 */
export async function generateAiResponse({ topic, vote, chatHistory, triggerMessage }) {
  const stance = vote === 'pro' ? '찬성' : '반대';

  let historyText = '';
  if (chatHistory.length > 0) {
    historyText =
      '\n\n대화 내역:\n' +
      chatHistory
        .slice(-10)
        .map((m) => `${m.username}: ${m.content}`)
        .join('\n');
  }

  const prompt =
    `당신은 "${topic}" 주제에 대해 ${stance} 입장에서 토론하는 AI 참가자입니다.` +
    historyText +
    `\n\n상대방 발언: "${triggerMessage}"\n\n` +
    `위 발언에 대해 ${stance} 입장에서 논리적으로 1-3문장 이내로 간결하게 답변하세요.`;

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.choices[0].message.content.trim();
}
