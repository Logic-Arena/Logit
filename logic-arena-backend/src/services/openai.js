import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!process.env.OPENAI_API_KEY) {
  console.warn('[OpenAI] WARNING: OPENAI_API_KEY is not set.');
} else {
  console.log(`[OpenAI] API key loaded. Model: ${MODEL}`);
}

const FALLBACK_TOPICS = [
  '초등학생 스마트폰 교내 보관을 의무화해야 하나?',
  '청소년 SNS 사용 시간을 법으로 제한해야 하나?',
  '딥페이크 탐지 표시를 모든 플랫폼에 의무화해야 하나?',
  'AI 생성물 워터마크 표시를 의무화해야 하나?',
  '대학 입시에 AI 활용 내역을 공개해야 하나?',
  '수업 중 태블릿 필기를 제한해야 하나?',
  '학교 시험에서 오픈북 평가를 확대해야 하나?',
  '고교학점제 절대평가를 확대해야 하나?',
  '학교 급식에 채식 선택권을 의무화해야 하나?',
  '유튜브 키즈 광고 규제를 강화해야 하나?',
  '직장 내 퇴근 후 메신저 응답 요구를 금지해야 하나?',
  '주 4일제를 단계적으로 도입해야 하나?',
  '최저임금을 업종별로 다르게 정해야 하나?',
  '카페 장시간 자리 이용에 추가 요금을 받아야 하나?',
  '배달앱 리뷰 블라인드 제도를 도입해야 하나?',
  '온라인 중고거래 신원 인증을 의무화해야 하나?',
  '무인점포 심야 운영을 제한해야 하나?',
  '편의점 야간 무인 운영을 확대해야 하나?',
  '택시 호출 플랫폼 수수료 상한제를 도입해야 하나?',
  '공유 킥보드 헬멧 단속을 강화해야 하나?',
  '전기차 충전 방해 과태료를 높여야 하나?',
  '아파트 층간소음 기준을 더 엄격히 해야 하나?',
  '공공장소 노키즈존을 허용해야 하나?',
  '반려동물 보유세를 도입해야 하나?',
  '지하철 무임승차 연령을 조정해야 하나?',
  '대형마트 의무휴업을 완화해야 하나?',
  '지역화폐 예산을 늘려야 하나?',
  '지역 축제 바가지요금을 강하게 처벌해야 하나?',
  '월세 상한제를 도입해야 하나?',
  '공공 와이파이 확대에 세금을 더 써야 하나?',
  '대학 축제 외부인 출입을 제한해야 하나?',
  '미성년자 배달앱 주문 제한을 강화해야 하나?',
  '공무원 점심시간 휴무제를 확대해야 하나?',
  '도심 내 차량 진입 혼잡통행료를 확대해야 하나?',
  '공공기관 민원 상담에 녹음 고지를 의무화해야 하나?',
];
const MAX_TOPIC_GENERATION_ATTEMPTS = 3;
const TOPIC_ANGLES = [
  '학교와 청소년 생활',
  '직장과 노동 문화',
  '동네 생활과 소비자 권리',
  '디지털 플랫폼과 개인정보',
  '환경과 교통 정책',
  '지역 사회와 공공서비스',
  '문화 규범과 생활 윤리',
];

function cleanTopicResponse(topic) {
  if (typeof topic !== 'string') return '';
  return topic.trim().replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '').trim();
}

function normalizeTopic(topic) {
  return cleanTopicResponse(topic)
    .replace(/\s+/g, ' ')
    .replace(/[.。．!?？！…]+$/u, '')
    .trim()
    .toLowerCase();
}

function matchesPreviousTopic(topic, previousTopics) {
  const normalizedTopic = normalizeTopic(topic);
  return !!normalizedTopic && previousTopics.some((previousTopic) =>
    normalizeTopic(previousTopic) === normalizedTopic
  );
}

function buildTopicPrompt(previousTopics, attempt) {
  const angle = TOPIC_ANGLES[Math.floor(Math.random() * TOPIC_ANGLES.length)];
  let prompt =
    `찬반 토론이 가능한 한국어 주제를 하나만 추천해주세요.\n` +
    `이번 초점: ${angle}\n` +
    `조건:\n` +
    `- 흔한 교과서식 주제는 피하세요.\n` +
    `- 최근 사회 변화, 생활 밀착 문제, 세대 간 의견 차이가 있는 쟁점을 우선하세요.\n` +
    `- 너무 넓은 주제가 아니라 바로 찬반을 고를 수 있는 구체적인 정책/규칙 형태로 쓰세요.\n` +
    `- 일반적인 AI 규제, 사형제, 원격근무 생산성, 소셜 미디어 유해성, 대학 무상교육 같은 과사용 주제는 피하세요.\n` +
    `- 35자 안팎의 질문형 한 문장만 답하세요.`;
  if (previousTopics.length > 0) {
    prompt += `\n이미 사용한 주제와 의미가 같거나 문장만 다른 주제는 제외해주세요: ${previousTopics.join(', ')}`;
  }
  if (attempt > 0) {
    prompt += '\n방금 중복된 주제가 나왔습니다. 위 목록과 완전히 다른 새 주제로 답해주세요.';
  }
  return prompt;
}

function pickFallbackTopic(previousTopics) {
  const unused = FALLBACK_TOPICS.filter((topic) => !matchesPreviousTopic(topic, previousTopics));
  const pool = unused.length > 0 ? unused : FALLBACK_TOPICS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeFallbackTopic(previousTopics) {
  const topic = pickFallbackTopic(previousTopics);
  console.warn(`[AI] topic fallback used: ${topic}`);
  return { topic, source: 'fallback' };
}

async function ask(prompt) {
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.choices[0].message.content.trim();
}

export async function generateTopic(previousTopics = []) {
  for (let attempt = 0; attempt < MAX_TOPIC_GENERATION_ATTEMPTS; attempt++) {
    try {
      const topic = cleanTopicResponse(await ask(buildTopicPrompt(previousTopics, attempt)));
      if (topic && !matchesPreviousTopic(topic, previousTopics)) {
        return { topic, source: 'ai' };
      }
    } catch {
      break;
    }
  }
  return makeFallbackTopic(previousTopics);
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

export async function generateTrainingRecommendation({ weakScores, recentTopics }) {
  const weakPoints = [...weakScores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((w) => `${w.axis} (평균 ${w.score}점)`)
    .join(', ');

  const recentText = recentTopics.length > 0 ? recentTopics.slice(0, 3).join(', ') : '없음';

  const prompt =
    `당신은 토론 훈련 코치입니다.\n` +
    `사용자의 최근 토론 분석:\n` +
    `- 취약한 영역: ${weakPoints}\n` +
    `- 최근 토론 주제: ${recentText}\n\n` +
    `위 데이터를 바탕으로 오늘의 맞춤 훈련을 추천해주세요.\n` +
    `반드시 아래 JSON 형식으로만 답하세요 (설명 없이 JSON만):\n` +
    `{"title":"훈련 제목 (10~20자)","description":"훈련 설명 (2~3문장, 왜 이 훈련이 필요한지와 구체적 방법 포함)","topic":"추천 토론 주제 (찬반 논쟁 가능한 한국어 주제)"}`;

  try {
    const raw = await ask(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      title: '반박 논리 강화 훈련',
      description: '상대방 주장을 정확히 파악하고 논리적으로 재반박하는 연습이 필요합니다. 감정적 표현을 피하고 구체적 근거로 반박하는 방식을 연습해보세요.',
      topic: '인공지능이 인간의 창의성을 대체할 수 있다',
    };
  }
}

export async function generateCommunityTopics() {
  const prompt =
    `현재 시사적으로 논쟁이 활발한 찬반 토론 주제 3개를 생성해주세요.\n` +
    `일반인이 쉽게 의견을 가질 수 있는 주제로, 질문형으로 작성해주세요.\n` +
    `반드시 아래 JSON 형식으로만 답하세요 (설명 없이 JSON만):\n` +
    `[{"question":"~, 찬성하시나요? 형식 질문 (25자 이내)","category":"교육/기술·사회/환경/정치/문화 중 하나"},` +
    `{"question":"질문","category":"카테고리"},{"question":"질문","category":"카테고리"}]`;

  try {
    const raw = await ask(prompt);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패');
    const topics = JSON.parse(jsonMatch[0]);
    return topics.slice(0, 3).map((t, i) => ({
      question: t.question,
      category: t.category ?? '시사',
      badge: i === 0 ? 'HOT' : i === 2 ? 'NEW' : null,
    }));
  } catch {
    return [
      { question: '학교 스마트폰 전면 금지, 찬성하시나요?', category: '교육', badge: 'HOT' },
      { question: '대입 수능, 절대평가로 전환해야 한다', category: '교육', badge: null },
      { question: 'AI 면접관 도입, 공정한가?', category: '기술·사회', badge: 'NEW' },
    ];
  }
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
