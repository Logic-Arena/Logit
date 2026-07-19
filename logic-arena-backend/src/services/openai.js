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

function buildHandicapPrompt(handicap) {
  if (!handicap?.enabled) return '';
  const lines = [];
  if (handicap.vocab) lines.push('초등학교 교과서에서 사용하는 어휘 수준으로만 발언하세요.');
  if (handicap.evidenceLimit) lines.push('발언당 근거(통계, 사례, 인용)는 1가지만 제시하세요.');
  if (handicap.rebuttalLimit) lines.push('상대 주장 전체를 반박하지 말고 한 가지 논점만 반박하세요.');
  return lines.length ? '\n\n[AI 제약 사항]\n' + lines.join('\n') : '';
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

export async function generateArgument({ topic, vote, handicap = null }) {
  const stance = vote === 'pro' ? '찬성' : '반대';
  const prompt =
    `토론 주제: "${topic}"\n` +
    `당신은 이 주제에 대해 ${stance} 입장입니다.\n` +
    `${stance} 입장의 핵심 주장을 논리적으로 3-5문장으로 작성해주세요.` +
    buildHandicapPrompt(handicap);
  try {
    return await ask(prompt);
  } catch {
    return `[AI ${stance}] ${topic}에 대한 ${stance} 주장을 준비 중입니다.`;
  }
}

export async function generateRebuttal({ topic, vote, opponentArguments, handicap = null }) {
  const stance = vote === 'pro' ? '찬성' : '반대';
  const opponentStance = vote === 'pro' ? '반대' : '찬성';
  const opponentText = opponentArguments.filter(Boolean).join('\n\n');
  const prompt =
    `토론 주제: "${topic}"\n` +
    `당신은 ${stance} 입장입니다.\n\n` +
    `상대방(${opponentStance}) 주장:\n${opponentText}\n\n` +
    `위 주장들에 대해 논리적으로 반론을 2-4문장으로 작성해주세요.` +
    buildHandicapPrompt(handicap);
  try {
    return await ask(prompt);
  } catch {
    return `[AI ${stance}] 상대방 주장에 대한 반론을 준비 중입니다.`;
  }
}

export async function generateDefense({ topic, vote, rebuttalContent, handicap = null }) {
  const stance = vote === 'pro' ? '찬성' : '반대';
  const opponentStance = vote === 'pro' ? '반대' : '찬성';
  const prompt =
    `토론 주제: "${topic}"\n` +
    `당신은 ${stance} 입장입니다.\n\n` +
    `상대방(${opponentStance})의 반론:\n${rebuttalContent}\n\n` +
    `이 반론에 대해 당신의 입장을 변론해주세요. 2-4문장으로 작성해주세요.` +
    buildHandicapPrompt(handicap);
  try {
    return await ask(prompt);
  } catch {
    return `[AI ${stance}] 변론을 준비 중입니다.`;
  }
}

export async function generateCounter({ topic, vote, defenseContent, handicap = null }) {
  const stance = vote === 'pro' ? '찬성' : '반대';
  const opponentStance = vote === 'pro' ? '반대' : '찬성';
  const prompt =
    `토론 주제: "${topic}"\n` +
    `당신은 ${stance} 입장입니다.\n\n` +
    `상대방(${opponentStance})의 변론:\n${defenseContent}\n\n` +
    `이 변론에 대해 재반론을 2-3문장으로 작성해주세요.` +
    buildHandicapPrompt(handicap);
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

export async function judgeDebate({ topic, content, mode = 'ai_debate' }) {
  const isHumanMode = mode === 'human_debate';
  const summary = buildDebateSummary(content, isHumanMode);
  if (!summary) return makeDrawResult('토론 내용이 없어 무승부로 처리합니다.', isHumanMode);

  // ai_debate와 human_debate 모두 학생(플레이어) 2명만 채점
  const participantDesc = `참가자 2명(찬성P, 반대P)`;

  // persuasion: 과거 데이터 호환을 위해 키 유지. 2026-07 이후 채점 기준은 '표현 명확성'
  const scoresTemplate =
    `{"name":"찬성P","vote":"pro","type":"player","logic":0,"evidence":0,"persuasion":0,"rebuttal":0,"consistency":0,"total":0,"rank":0,"advice":"구체적 조언 3-4문장"},` +
    `{"name":"반대P","vote":"con","type":"player","logic":0,"evidence":0,"persuasion":0,"rebuttal":0,"consistency":0,"total":0,"rank":0,"advice":"구체적 조언 3-4문장"}`;

  const prompt =
    `토론 주제: "${topic}"\n\n` +
    `${summary}\n\n` +
    `당신은 공정한 토론 심판입니다. 위 발언에서 ${participantDesc}을 동일한 기준으로 채점하세요.\n` +
    `(참고: AI 발언(찬성AI, 반대AI)은 토론 맥락 이해를 위한 참고용이며 채점 대상이 아닙니다. 오직 학생 2명만 채점하세요.)\n\n` +
    `채점 기준 (각 항목 0~20점, 합계 0~100점):\n` +
    `【논리성 0~20점】\n` +
    `17~20: 전제와 결론의 구조가 명확하고 논리적 비약이 없으며 인과관계를 정확히 설명함\n` +
    `13~16: 대체로 논리적이나 일부 연결이 어색하거나 약함\n` +
    `8~12: 논리 구조는 있으나 인과관계가 자주 불명확함\n` +
    `4~7: 주장과 근거가 자주 분리되어 있고 논리적 연결이 약함\n` +
    `0~3: 논리적 구조가 거의 없고 단순 주장 나열에 불과함\n\n` +
    `【근거 0~20점】\n` +
    `17~20: 신뢰할 수 있는 출처(통계, 뉴스, 연구 사례 등)를 구체적으로 제시함\n` +
    `13~16: 근거를 제시하나 출처가 불명확하거나 구체성이 부족함\n` +
    `8~12: "~라고 들었다" 수준의 막연한 근거만 있음\n` +
    `4~7: 근거가 추측이거나 개인 경험에만 의존함\n` +
    `0~3: 근거 제시가 거의 없음\n\n` +
    `【표현 명확성 0~20점】\n` +
    `17~20: 표현이 명확하고 구조적이며 감정 호소 없이 이성적으로 청중을 설득함\n` +
    `13~16: 대체로 명확하나 일부 표현이 모호하거나 전달력이 약함\n` +
    `8~12: 전달하려는 내용은 있으나 구성이 산만하거나 핵심이 흐림\n` +
    `4~7: 표현이 불명확하거나 같은 말을 반복함\n` +
    `0~3: 무슨 말을 하려는지 거의 파악하기 어려움\n\n` +
    `【반론 0~20점】\n` +
    `17~20: 상대 주장의 핵심을 정확히 짚고 구체적인 근거로 반박함\n` +
    `13~16: 핵심은 짚었으나 반박의 논거가 다소 약함\n` +
    `8~12: 상대 말 일부만 다루거나 "그건 틀렸다"는 수준에 머묾\n` +
    `4~7: 상대 말을 잘못 이해했거나 논점과 무관한 반박을 함\n` +
    `0~3: 반론이 거의 없음\n\n` +
    `【일관성 0~20점】\n` +
    `17~20: 처음부터 끝까지 같은 입장을 유지, 앞뒤 발언이 모순 없음\n` +
    `13~16: 대체로 일관적이나 한 군데 정도 앞뒤가 맞지 않는 부분 있음\n` +
    `8~12: 중간에 입장이 흔들리거나 자기 주장을 스스로 부정하는 경우 있음\n` +
    `4~7: 발언마다 입장이 달라지거나 같은 주제에 대해 다른 말을 함\n` +
    `0~3: 처음과 끝의 주장이 완전히 다르거나 자기 주장이 없음\n\n` +
    `채점 규칙 (반드시 준수):\n` +
    `1. 1점 단위로 채점하고 절대 5의 배수로 반올림하지 말 것\n` +
    `2. 참가자 간 점수 차이를 반드시 둘 것\n` +
    `3. 내용이 부실하거나 짧으면 각 항목 0~7점, 평범하면 8~13점, 우수하면 14~20점\n` +
    `4. 총점(5개 항목 합계) 기준: 미흡 0~39점, 보통 40~59점, 양호 60~79점, 우수 80~100점\n` +
    `5. 실제 발언 내용을 근거로 엄격하게 차별화해서 채점할 것\n\n` +
    `summary(총평) 작성 규칙:\n` +
    `- 3~4문장으로 작성\n` +
    `- 이번 토론의 핵심 쟁점이 무엇이었는지 언급\n` +
    `- 찬성/반대 각 팀의 가장 강했던 논점과 가장 약했던 논점을 구체적으로 지적\n` +
    `- 실제 발언 내용을 인용하거나 참조하여 구체적으로 서술\n\n` +
    `advice(개인 조언) 작성 규칙:\n` +
    `- 각 참가자마다 3~4문장\n` +
    `- 해당 참가자의 실제 발언에서 잘한 점 1가지와 개선할 점 1가지를 구체적으로 지적\n` +
    `- 실제 논리나 표현을 인용해서 서술\n` +
    `- 다음 토론에서 바로 적용 가능한 실천적 조언 포함\n\n` +
    `반드시 아래 JSON 형식으로만 답하세요 (설명 없이 JSON만):\n` +
    `{"winner":"pro또는con또는draw","summary":"총평 3-4문장","scores":[${scoresTemplate}]}`;

  try {
    const raw = await ask(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패');
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.scores || !Array.isArray(parsed.scores)) throw new Error('scores 없음');
    parsed.scores.forEach((s) => {
      // 각 항목을 [0, 20]으로 제한 (AI가 범위를 벗어난 값을 반환할 경우 방어)
      s.logic = Math.min(Math.max(Math.round(s.logic ?? 0), 0), 20);
      s.evidence = Math.min(Math.max(Math.round(s.evidence ?? 0), 0), 20);
      s.persuasion = Math.min(Math.max(Math.round(s.persuasion ?? 0), 0), 20);
      s.rebuttal = Math.min(Math.max(Math.round(s.rebuttal ?? 0), 0), 20);
      s.consistency = Math.min(Math.max(Math.round(s.consistency ?? 0), 0), 20);
      s.total = s.logic + s.evidence + s.persuasion + s.rebuttal + s.consistency;
      // 5개 항목 × 20점 = 100점 만점 → 관전자 있을 때 70점으로 정규화
      s.aiScore = Math.round(s.total * 0.7);
      s.peerVotes = 0;
      s.peerScore = 0;
      s.finalScore = s.aiScore;
    });
    const sorted = [...parsed.scores].sort((a, b) => b.total - a.total);
    sorted.forEach((s, i) => { s.rank = i + 1; });

    // 플레이어 총점 기반으로 winner 계산
    const proTotal = parsed.scores.filter(s => s.vote === 'pro' && s.type === 'player').reduce((sum, s) => sum + s.total, 0);
    const conTotal = parsed.scores.filter(s => s.vote === 'con' && s.type === 'player').reduce((sum, s) => sum + s.total, 0);
    if (proTotal > conTotal) parsed.winner = 'pro';
    else if (conTotal > proTotal) parsed.winner = 'con';
    else parsed.winner = 'draw';

    return parsed;
  } catch {
    return makeDrawResult('AI 판정에 실패하여 무승부로 처리합니다.', isHumanMode);
  }
}

function makeDrawResult(reason, isHumanMode = false) {
  const defaultScore = (name, vote, type) => ({
    name, vote, type, logic: 0, evidence: 0, persuasion: 0, rebuttal: 0, consistency: 0, total: 0, rank: 0,
    aiScore: 0, peerVotes: 0, peerScore: 0, finalScore: 0, advice: reason,
  });
  // ai_debate와 human_debate 모두 플레이어 2명만 반환
  const scores = [
    defaultScore('찬성P', 'pro', 'player'),
    defaultScore('반대P', 'con', 'player'),
  ];
  return { winner: 'draw', summary: reason, scores };
}

function buildDebateSummary(content, isHumanMode = false) {
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
  if (!isHumanMode) {
    sec('찬성AI', [
      ['주장', c.pro_ai_argument], ['반론(vs반대)', c.pro_a_rebuttal], ['재반론', c.pro_a_counter],
    ]);
    sec('반대AI', [
      ['주장', c.con_ai_argument], ['반론(vs찬성)', c.con_a_rebuttal], ['재반론', c.con_a_counter],
    ]);
  }
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

/**
 * 특정 슬롯(A/B/C)에 맞는 커뮤니티 주제 1개 생성
 * @param {string} slot - 슬롯 이름 ('A', 'B', 'C')
 * @returns {Promise<{question: string, category: string}>}
 */
export async function generateCommunityTopicForSlot(slot) {
  const categoryMap = {
    A: '사회·정치',
    B: '경제·과학',
    C: '문화·환경',
  };

  const category = categoryMap[slot] || '사회';

  const prompt =
    `당신은 토론 주제 생성 전문가입니다.\n` +
    `아래 카테고리에 맞는 논쟁적인 토론 주제를 **1개만** 생성해주세요.\n\n` +
    `카테고리: ${category}\n\n` +
    `요구사항:\n` +
    `- 찬반이 명확하게 나뉠 수 있는 주제\n` +
    `- 간결하고 명확한 질문 형태\n` +
    `- 40자 이내\n` +
    `- 한국 사회에서 실제로 논의되는 주제\n\n` +
    `JSON 형식으로만 응답해주세요 (설명 없이 JSON만):\n` +
    `{"question": "주제 질문", "category": "${category}"}`;

  try {
    const raw = await ask(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패');
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      question: parsed.question,
      category: parsed.category || category,
    };
  } catch (error) {
    console.error(`[AI] 슬롯 ${slot} 주제 생성 실패:`, error.message);
    // Fallback 주제
    const fallbackTopics = {
      A: { question: '사형제도, 폐지해야 하나요?', category: '사회·정치' },
      B: { question: 'AI 기술 발전, 일자리를 위협할까요?', category: '경제·과학' },
      C: { question: '학교 급식, 채식 메뉴를 늘려야 할까요?', category: '문화·환경' },
    };
    return fallbackTopics[slot] || fallbackTopics.A;
  }
}

export async function generateTeacherDebateSummary({ studentName, topic, position, result, score, logic, evidence, persuasion, rebuttal, consistency, advice }) {
  const resultLabel = result === 'win' ? '승리' : result === 'lose' ? '패배' : '무승부';
  const positionLabel = position === 'pro' ? '찬성' : '반대';

  const prompt =
    `당신은 중고등학교 토론 수업을 담당하는 교사의 학생 평가 보조 도구입니다.\n\n` +
    `아래는 학생 "${studentName}"의 토론 기록입니다:\n` +
    `- 주제: ${topic}\n` +
    `- 포지션: ${positionLabel}\n` +
    `- 결과: ${resultLabel} (최종 ${score}점 / 100점 만점)\n` +
    `- 항목별 점수 (20점 만점): 논리성 ${logic}, 근거 ${evidence}, 표현 명확성 ${persuasion}, 반론 ${rebuttal}, 일관성 ${consistency}\n` +
    `- AI 채점관 상세 총평: ${advice || '없음'}\n\n` +
    `교사 관점에서 학생의 토론 수행을 전문적으로 분석하여, 아래 JSON 형식으로만 답하세요 (설명 없이 JSON만):\n` +
    `{"summary":"해당 학생의 전반적인 토론 수행을 4~5문장으로 평가. 논리 구조, 근거의 질, 표현 명확성, 반론 대응 방식, 일관성을 종합적으로 서술. 교사 전문 어투.","strengths":["구체적인 발언 내용을 인용하거나 근거로 들어 서술 (3~4가지)"],"improvements":["구체적인 발언 내용을 근거로 들고 개선 방향도 함께 제시 (3~4가지)"],"coaching":"교사가 학생에게 직접 건네는 따뜻하고 구체적인 코칭 멘트 1~2문장"}`;

  try {
    const raw = await ask(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패');
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.summary || !Array.isArray(parsed.strengths) || !Array.isArray(parsed.improvements)) throw new Error('응답 구조 오류');
    if (!parsed.coaching) parsed.coaching = '꾸준한 연습을 통해 더욱 발전할 수 있을 것입니다.';
    return parsed;
  } catch {
    return {
      summary: `${studentName} 학생은 ${topic} 주제로 ${positionLabel} 측에서 토론을 수행하여 ${score}점을 획득했습니다.`,
      strengths: ['토론에 적극적으로 참여하였습니다.'],
      improvements: ['근거 자료의 다양성을 높이고 논리적 일관성을 강화할 필요가 있습니다.'],
      coaching: '꾸준한 연습을 통해 더욱 발전할 수 있을 것입니다.',
    };
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
