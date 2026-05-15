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

async function ask(prompt) {
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.choices[0].message.content.trim();
}

export async function generateTopic(previousTopics = []) {
  try {
    let prompt = '찬반 토론이 가능한 주제를 한국어로 하나만 추천해주세요. 주제만 답해주세요.';
    if (previousTopics.length > 0) {
      prompt += `\n이미 사용한 주제는 제외해주세요: ${previousTopics.join(', ')}`;
    }
    return await ask(prompt);
  } catch {
    const unused = FALLBACK_TOPICS.filter((t) => !previousTopics.includes(t));
    const pool = unused.length > 0 ? unused : FALLBACK_TOPICS;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

export async function generateArgument({ topic, vote }) {
  const stance = vote === 'pro' ? '찬성' : '반대';
  const prompt =
    `토론 주제: "${topic}"\n` +
    `당신은 이 주제에 대해 ${stance} 입장입니다.\n` +
    `${stance} 입장의 핵심 주장을 논리적으로 3-5문장으로 작성해주세요.`;
  try {
    return await ask(prompt);
  } catch {
    return `[AI ${stance}] ${topic}에 대한 ${stance} 주장을 준비 중입니다.`;
  }
}

export async function generateRebuttal({ topic, vote, opponentArguments }) {
  const stance = vote === 'pro' ? '찬성' : '반대';
  const opponentStance = vote === 'pro' ? '반대' : '찬성';
  const opponentText = opponentArguments.filter(Boolean).join('\n\n');
  const prompt =
    `토론 주제: "${topic}"\n` +
    `당신은 ${stance} 입장입니다.\n\n` +
    `상대방(${opponentStance}) 주장:\n${opponentText}\n\n` +
    `위 주장들에 대해 논리적으로 반론을 2-4문장으로 작성해주세요.`;
  try {
    return await ask(prompt);
  } catch {
    return `[AI ${stance}] 상대방 주장에 대한 반론을 준비 중입니다.`;
  }
}

export async function generateDefense({ topic, vote, rebuttalContent }) {
  const stance = vote === 'pro' ? '찬성' : '반대';
  const opponentStance = vote === 'pro' ? '반대' : '찬성';
  const prompt =
    `토론 주제: "${topic}"\n` +
    `당신은 ${stance} 입장입니다.\n\n` +
    `상대방(${opponentStance})의 반론:\n${rebuttalContent}\n\n` +
    `이 반론에 대해 당신의 입장을 변론해주세요. 2-4문장으로 작성해주세요.`;
  try {
    return await ask(prompt);
  } catch {
    return `[AI ${stance}] 변론을 준비 중입니다.`;
  }
}

export async function generateCounter({ topic, vote, defenseContent }) {
  const stance = vote === 'pro' ? '찬성' : '반대';
  const opponentStance = vote === 'pro' ? '반대' : '찬성';
  const prompt =
    `토론 주제: "${topic}"\n` +
    `당신은 ${stance} 입장입니다.\n\n` +
    `상대방(${opponentStance})의 변론:\n${defenseContent}\n\n` +
    `이 변론에 대해 재반론을 2-3문장으로 작성해주세요.`;
  try {
    return await ask(prompt);
  } catch {
    return `[AI ${stance}] 재반론을 준비 중입니다.`;
  }
}

export async function generateCoaching({ topic, content }) {
  const c = content;
  const proP = [c.pro_argument, c.pro_p_rebuttal, c.pro_p_counter, c.con_p_defense_player, c.con_a_defense_player].filter(Boolean).join('\n');
  const conP = [c.con_argument, c.con_p_rebuttal, c.con_p_counter, c.pro_p_defense_player, c.pro_a_defense_player].filter(Boolean).join('\n');
  const proAi = [c.pro_ai_argument, c.pro_a_rebuttal, c.pro_a_counter].filter(Boolean).join('\n');
  const conAi = [c.con_ai_argument, c.con_a_rebuttal, c.con_a_counter].filter(Boolean).join('\n');

  const base =
    `토론 주제: "${topic}"\n\n` +
    (proP ? `【찬성P 발언】\n${proP}\n\n` : '') +
    (conP ? `【반대P 발언】\n${conP}\n\n` : '') +
    (proAi ? `【찬성AI 발언】\n${proAi}\n\n` : '') +
    (conAi ? `【반대AI 발언】\n${conAi}\n\n` : '');

  const proPrompt = base +
    `당신은 찬성P 전담 토론 코치입니다.\n` +
    `찬성P의 발언만을 중심으로 분석하되, 상대방(반대P·반대AI)의 주장도 참고하여 ` +
    `찬성P가 최종 주장에서 활용할 수 있는 구체적인 조언을 3-4문장으로 작성하세요.\n` +
    `실제 발언 내용을 언급하며 구체적으로 작성하세요. 한국어로만 답하세요.`;

  const conPrompt = base +
    `당신은 반대P 전담 토론 코치입니다.\n` +
    `반대P의 발언만을 중심으로 분석하되, 상대방(찬성P·찬성AI)의 주장도 참고하여 ` +
    `반대P가 최종 주장에서 활용할 수 있는 구체적인 조언을 3-4문장으로 작성하세요.\n` +
    `실제 발언 내용을 언급하며 구체적으로 작성하세요. 한국어로만 답하세요.`;

  try {
    const [pro, con] = await Promise.all([ask(proPrompt), ask(conPrompt)]);
    return { pro, con };
  } catch {
    return { pro: 'AI 훈수 분석 중 오류가 발생했습니다.', con: 'AI 훈수 분석 중 오류가 발생했습니다.' };
  }
}

export async function judgeDebate({ topic, content }) {
  const summary = buildDebateSummary(content);
  if (!summary) return makeDrawResult('토론 내용이 없어 무승부로 처리합니다.');

  const prompt =
    `토론 주제: "${topic}"\n\n` +
    `${summary}\n\n` +
    `당신은 공정한 토론 심판입니다. 위 전체 발언을 바탕으로 참가자 4명(찬성P, 반대P, 찬성AI, 반대AI)을 동일한 기준으로 채점하세요.\n\n` +
    `채점 기준 (각 항목 0~25점, 합계 0~100점):\n` +
    `- 논리성(0~25): 주장의 논리적 일관성, 전제-결론 구조, 오류 없음\n` +
    `- 근거(0~25): 사실·데이터·사례에 기반한 구체적 근거의 충실도\n` +
    `- 설득력(0~25): 표현의 명확성, 감정 호소 없이 이성적으로 청중을 설득하는 힘\n` +
    `- 반론(0~25): 상대 주장의 핵심을 정확히 파악하고 효과적으로 반박한 정도\n\n` +
    `채점 규칙 (반드시 준수):\n` +
    `1. 1점 단위로 채점하고 절대 5의 배수로 반올림하지 말 것\n` +
    `2. 참가자 간 점수 차이를 반드시 둘 것 (4명이 같은 점수이면 안 됨)\n` +
    `3. 내용이 부실하거나 짧으면 각 항목 0~10점, 평범하면 11~17점, 우수하면 18~25점\n` +
    `4. 총점 기준: 미흡 0~39점, 보통 40~59점, 양호 60~79점, 우수 80~100점\n` +
    `5. 실제 발언 내용을 근거로 엄격하게 차별화해서 채점할 것\n\n` +
    `summary(총평) 작성 규칙:\n` +
    `- 3~4문장으로 작성\n` +
    `- 이번 토론의 핵심 쟁점이 무엇이었는지 언급\n` +
    `- 찬성/반대 각 팀의 가장 강했던 논점과 가장 약했던 논점을 구체적으로 지적\n` +
    `- 실제 발언 내용을 인용하거나 참조하여 구체적으로 서술\n\n` +
    `advice(개인 조언) 작성 규칙:\n` +
    `- 각 참가자마다 3~4문장\n` +
    `- 해당 참가자의 실제 발언에서 잘한 점 1가지와 개선할 점 1가지를 구체적으로 지적\n` +
    `- "~했습니다" 형식의 추상적 칭찬 금지, 실제 논리나 표현을 인용해서 서술\n` +
    `- 다음 토론에서 바로 적용 가능한 실천적 조언 포함\n\n` +
    `반드시 아래 JSON 형식으로만 답하세요 (설명 없이 JSON만):\n` +
    `{"winner":"pro또는con또는draw","summary":"총평 3-4문장","scores":[` +
    `{"name":"찬성P","vote":"pro","type":"player","logic":0,"evidence":0,"persuasion":0,"rebuttal":0,"total":0,"rank":0,"advice":"구체적 조언 3-4문장"},` +
    `{"name":"반대P","vote":"con","type":"player","logic":0,"evidence":0,"persuasion":0,"rebuttal":0,"total":0,"rank":0,"advice":"구체적 조언 3-4문장"},` +
    `{"name":"찬성AI","vote":"pro","type":"ai","logic":0,"evidence":0,"persuasion":0,"rebuttal":0,"total":0,"rank":0,"advice":"구체적 조언 3-4문장"},` +
    `{"name":"반대AI","vote":"con","type":"ai","logic":0,"evidence":0,"persuasion":0,"rebuttal":0,"total":0,"rank":0,"advice":"구체적 조언 3-4문장"}` +
    `]}`;

  try {
    const raw = await ask(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패');
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.scores || !Array.isArray(parsed.scores)) throw new Error('scores 없음');
    // total 재계산, rank 정렬
    parsed.scores.forEach((s) => {
      s.total = (s.logic ?? 0) + (s.evidence ?? 0) + (s.persuasion ?? 0) + (s.rebuttal ?? 0);
    });
    const sorted = [...parsed.scores].sort((a, b) => b.total - a.total);
    sorted.forEach((s, i) => { s.rank = i + 1; });
    return parsed;
  } catch {
    return makeDrawResult('AI 판정에 실패하여 무승부로 처리합니다.');
  }
}

function makeDrawResult(reason) {
  const defaultScore = (name, vote, type) => ({
    name, vote, type, logic: 0, evidence: 0, persuasion: 0, rebuttal: 0, total: 0, rank: 0, advice: reason,
  });
  return {
    winner: 'draw',
    summary: reason,
    scores: [
      defaultScore('찬성P', 'pro', 'player'),
      defaultScore('반대P', 'con', 'player'),
      defaultScore('찬성AI', 'pro', 'ai'),
      defaultScore('반대AI', 'con', 'ai'),
    ],
  };
}

function buildDebateSummary(content) {
  const c = content;
  const sections = [];
  const sec = (title, items) => {
    const lines = items.filter(([, v]) => v).map(([k, v]) => `  - ${k}: ${v}`);
    if (lines.length) sections.push(`【${title}】\n${lines.join('\n')}`);
  };
  sec('찬성P', [
    ['주장', c.pro_argument], ['반론(vs반대P)', c.pro_p_rebuttal], ['재반론', c.pro_p_counter],
    ['변론(vs반대P반론)', c.con_p_defense_player], ['변론(vs반대AI)', c.con_a_defense_player], ['최종', c.pro_final],
  ]);
  sec('반대P', [
    ['주장', c.con_argument], ['반론(vs찬성P)', c.con_p_rebuttal], ['재반론', c.con_p_counter],
    ['변론(vs찬성P반론)', c.pro_p_defense_player], ['변론(vs찬성AI)', c.pro_a_defense_player], ['최종', c.con_final],
  ]);
  sec('찬성AI', [
    ['주장', c.pro_ai_argument], ['반론(vs반대)', c.pro_a_rebuttal], ['재반론', c.pro_a_counter],
  ]);
  sec('반대AI', [
    ['주장', c.con_ai_argument], ['반론(vs찬성)', c.con_a_rebuttal], ['재반론', c.con_a_counter],
  ]);
  return sections.join('\n\n') || null;
}

// Legacy - kept for compatibility
export async function generateAiResponse({ topic, vote, chatHistory, triggerMessage }) {
  const stance = vote === 'pro' ? '찬성' : '반대';
  const historyText = chatHistory.length > 0
    ? '\n\n대화 내역:\n' + chatHistory.slice(-10).map((m) => `${m.username}: ${m.content}`).join('\n')
    : '';
  const prompt =
    `당신은 "${topic}" 주제에 대해 ${stance} 입장에서 토론하는 AI입니다.` +
    historyText +
    `\n\n상대방 발언: "${triggerMessage}"\n\n` +
    `위 발언에 대해 ${stance} 입장에서 1-3문장으로 답변하세요.`;
  return await ask(prompt);
}
