import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { generateSetukDraft, getTeacherSubject } from '../../lib/api';
import type { SetukContext, SetukDraft } from '../../lib/api';
import { analyzeForbidden, analyzeNominal, convertToNominal } from '../../lib/setukText';
import { copyBlockReason, neisBytes } from '../../lib/setukReview';
import { installSetukCopyGuard } from '../../lib/setukCopyGuard';
import styles from '../../pages/TeacherPage.module.css';
import ui from './SetukAssistant.module.css';

const checks = [
  '모든 문장을 직접 관찰·평가한 기록과 대조했고, 실제 수행과 다른 내용·과장·근거 없는 성장이나 태도를 제거했습니다.',
  '교과 성취기준에 따른 학습 특성과 수업 참여를 확인했고, 금지 활동·실적·개인정보 및 특정 명칭을 기재요령에 따라 검토했습니다.',
  'AI 자료를 그대로 입력하지 않았으며, 담당 교사로서 최종 작성 내용을 확인했습니다.',
];

export function SetukAssistant({ token, userId }: { token: string; userId: number }) {
  const proposalsRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const subjectEditedRef = useRef(false);
  const [context, setContext] = useState<SetukContext>({ schoolYear: 2026, schoolLevel: 'high', grade: 1, subject: '', activity: '', observations: '', observedByTeacher: false, schoolCurriculum: false });
  const [subjectLoadError, setSubjectLoadError] = useState(false);
  const [appliedSubject, setAppliedSubject] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<SetukDraft[]>([]);
  const [aiTexts, setAiTexts] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [review, setReview] = useState<boolean[]>(checks.map(() => false));
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const findings = analyzeForbidden(text);
  const findingKey = (item: typeof findings[number]) => `${item.start}:${item.end}:${item.text}`;
  const contextReady = Boolean(context.subject.trim() && context.activity.trim() && context.observations.trim() && context.observedByTeacher && context.schoolCurriculum);
  const blocked = copyBlockReason({ text, aiTexts, contextReady, reviewed: review.every(Boolean), unresolved: findings.some(item => !resolutions[findingKey(item)]?.trim()), busy });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getTeacherSubject(token, controller.signal)
      .then(settings => {
        if (!active) return;
        setSubjectLoadError(false);
        const subject = settings.subject?.trim();
        if (!subject || subject === '기타' || subjectEditedRef.current) return;
        setContext(previous => subjectEditedRef.current ? previous : { ...previous, subject });
        setDrafts([]);
        setAppliedSubject(null);
      })
      .catch(() => { if (active) setSubjectLoadError(true); });
    return () => { active = false; controller.abort(); };
  }, [token, userId]);

  useLayoutEffect(() => installSetukCopyGuard(document, () => [
    { element: proposalsRef.current, reason: 'AI 제안은 직접 복사할 수 없습니다. 관찰 기록과 대조하여 직접 작성하세요.' },
    { element: blocked ? editorRef.current : null, reason: blocked },
  ], setError), [blocked]);

  function invalidate() {
    setReview(checks.map(() => false));
    setResolutions({});
    setCopied(false);
    setError('');
  }
  function edit(value: string) { setText(value); invalidate(); }
  function updateContext(update: Partial<SetukContext>) {
    if ('subject' in update) subjectEditedRef.current = true;
    setContext({ ...context, ...update });
    setDrafts([]);
    setAppliedSubject(null);
    invalidate();
  }
  async function generate() {
    if (!contextReady || busy) return;
    invalidate();
    setBusy(true);
    try {
      const { drafts: result, subject } = await generateSetukDraft(token, userId, context);
      setDrafts(result);
      setAppliedSubject(subject);
      setAiTexts(previous => [...previous, ...result.map(d => d.text)]);
    } catch (e) { setError(e instanceof Error ? e.message : '윤문을 완료하지 못했습니다. 작성한 내용은 유지됩니다.'); }
    finally { setBusy(false); }
  }
  async function copy() {
    if (blocked) { setError(blocked); return; }
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { setError('클립보드에 접근하지 못했습니다. 브라우저 권한을 확인하세요.'); }
  }

  return <section className={styles.card} aria-label="세특 작성 보조">
    <h3 className={styles.cardTitle}>세특 작성 보조</h3>
    <div className={styles.setukWarningBanner}>
      2026학년도 기준 · AI 생성 자료를 학생부에 그대로 입력할 수 없습니다. 교사가 직접 관찰·평가한 기록을 작성하고, AI는 윤문 보조로만 활용하세요.
      <a className={ui.source} href="https://star.moe.go.kr/web/contents/m21100.do?schM=list&schYr=2026" target="_blank" rel="noreferrer">교육부 기재요령 확인 ↗</a>
    </div>
    <fieldset disabled={busy} className={ui.form}>
      <legend>1. 수업 정보와 교사 관찰 기록</legend>
      <div className={ui.row}>
        <label>학년도<input value="2026" readOnly /></label>
        <label>학교급<select value={context.schoolLevel} onChange={e => updateContext({ schoolLevel: e.target.value as SetukContext['schoolLevel'] })}><option value="middle">중학교</option><option value="high">고등학교</option></select></label>
        <label>학년<select value={context.grade} onChange={e => updateContext({ grade: Number(e.target.value) })}>{[1, 2, 3].map(n => <option key={n} value={n}>{n}학년</option>)}</select></label>
        <label>과목<input value={context.subject} maxLength={100} onChange={e => updateContext({ subject: e.target.value })} placeholder="실제 개설 과목명" aria-describedby={`setuk-subject-help-${userId}`} /></label>
      </div>
      <p className={ui.hint} id={`setuk-subject-help-${userId}`} role="status">
        {subjectLoadError
          ? '담당 과목을 불러오지 못했습니다. 실제 개설 과목명을 직접 입력하세요.'
          : '저장한 담당 과목을 기본으로 채웁니다. 실제 개설 과목명을 확인·수정하세요. 미설정·기타인 경우 직접 입력하세요.'}
      </p>
      <label>수업 활동·관찰 시기<input value={context.activity} maxLength={500} onChange={e => updateContext({ activity: e.target.value })} placeholder="관찰한 날짜 또는 기간과 수업 활동을 적으세요." /></label>
      <label>교사가 직접 작성한 관찰·평가 내용<textarea className={styles.setukTextarea} rows={4} value={context.observations} maxLength={4000} onChange={e => updateContext({ observations: e.target.value })} placeholder="성취기준과 연결되는 실제 발언·산출물·학습 과정·개별 특성을 적으세요. 변화는 전후 관찰 근거가 있을 때만 적으세요." /></label>
      <p className={ui.hint}>위의 토론 점수와 AI 요약은 학습 참고 정보입니다. 그 자체가 교사의 관찰 기록은 아닙니다. 학생에게 세특 문안을 작성해 제출하도록 요구하지 마세요. 윤문 요청 시 입력한 수업 정보와 관찰 내용이 AI 서비스로 전송되므로 학생 이름 등 불필요한 개인정보를 적지 마세요.</p>
      <label className={ui.check}><input type="checkbox" checked={context.schoolCurriculum} onChange={e => updateContext({ schoolCurriculum: e.target.checked })} />해당 과목의 학교교육계획·교육과정에 따라 실시한 활동입니다.</label>
      <label className={ui.check}><input type="checkbox" checked={context.observedByTeacher} onChange={e => updateContext({ observedByTeacher: e.target.checked })} />담당 교사로서 직접 관찰·평가한 내용을 작성했습니다.</label>
      <button className="btn btn--primary" disabled={!contextReady} onClick={() => void generate()}>관찰 기록 윤문 제안 보기</button>
    </fieldset>

    {busy && <p role="status">관찰 기록을 바탕으로 윤문 중입니다…</p>}
    {error && <p className={styles.errorMsg} role="alert">{error}</p>}
    {drafts.length > 0 && <div ref={proposalsRef} className={ui.proposals} onCopy={e => { e.preventDefault(); setError('AI 제안은 직접 복사할 수 없습니다. 관찰 기록과 대조하여 아래에 직접 작성하세요.'); }} onCut={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>
      <h4>AI 윤문 제안 · 그대로 입력 불가</h4>
      {appliedSubject && <p className={ui.hint} role="status">{appliedSubject} 과목 기준으로 생성한 제안입니다.</p>}
      <div className={styles.setukDraftGrid}>{drafts.map(draft => <article key={draft.version} className={styles.setukDraftCard}>
        <strong>{draft.label}</strong><p className={styles.setukDraftText}>{draft.text}</p>
      </article>)}</div>
      <p className={ui.hint}>제안을 참고하여 관찰 사실에 맞게 직접 작성하세요. 제안이 사실과 다르면 사용하지 마세요.</p>
    </div>}

    <fieldset disabled={busy} className={ui.form}>
      <legend>2. 교사 작성·최종 검토</legend>
      <label>최종 검토할 문장<textarea ref={editorRef} className={styles.setukTextarea} rows={6} value={text} maxLength={10000} onChange={e => edit(e.target.value)} onCopy={e => { if (blocked) { e.preventDefault(); setError(blocked); } }} onCut={e => { if (blocked) { e.preventDefault(); setError(blocked); } }} onDragStart={e => { if (blocked) e.preventDefault(); }} placeholder="직접 관찰·평가한 내용을 바탕으로 작성하세요. AI 제안은 자동으로 입력되지 않습니다." /></label>
      {neisBytes(text) > 1500 && <div className={styles.setukForbiddenBox}>1,500바이트(한글 500자 기준) 이내로 줄이세요.</div>}
      <div className={styles.setukCounterRow}>
        <span className={neisBytes(text) > 1500 ? styles.setukCounterOver : styles.setukCounter}>{text.length}자 · {neisBytes(text)} / 1,500바이트</span>
      </div>
      <p className={ui.hint}>한글 3바이트, 영문·숫자·줄바꿈 1바이트로 계산합니다. 이미 입력한 분량은 나이스에서 합산하여 확인하세요. {context.schoolLevel === 'high' && context.grade <= 2 ? '2026학년도 고1·2 공통과목은 과목 1·2를 합산하여 한글 500자 이내입니다.' : '과목별 한글 500자 기준입니다.'} 전공실무과목은 학기별 한도를 확인하세요.</p>
      {analyzeNominal(text).length > 0 && <div className={styles.setukNominalBox}>문체 제안: 명사형 종결을 검토할 수 있습니다. 문체 변경만으로 기재요령을 충족하지는 않습니다.<button className={styles.setukInlineBtn} onClick={() => edit(convertToNominal(text))}>변환 가능한 어미 정리</button></div>}
      <details className={ui.hint}><summary>기재 전 확인할 주요 항목</summary><p>공인어학·인증시험, 교내외 대회 참여·수상, 모의고사 성적, 논문·학회 실적, 출간·특허, 해외 활동, 가족의 사회경제적 지위, 장학금, 자격증, 사교육 활동, 특정 대학·기관·상호·강사명 등을 확인하세요. 이름만 바꿔 금지된 활동 사실을 남길 수 없습니다. 교육관련기관 등 허용 예외와 탐구 대상에 대한 단순 언급은 원문 지침과 문맥을 확인하세요.</p></details>
      {findings.length > 0 && <div className={ui.findings}>
        <strong>직접 검토할 표현 {findings.length}개</strong>
        {findings.map(item => <label key={findingKey(item)}>“{item.text}” · {item.category}<span className={ui.hint}>{item.reason}</span><input value={resolutions[findingKey(item)] ?? ''} onChange={e => { setResolutions({ ...resolutions, [findingKey(item)]: e.target.value }); setReview(checks.map(() => false)); setCopied(false); }} placeholder="금지 사실이면 문장을 수정하세요. 허용 문맥이면 근거를 적으세요." /></label>)}
      </div>}
      <p className={ui.hint}>자동 점검은 모든 금지 표현이나 허위·과장을 판별하지 못합니다. 탐지가 없어도 아래 항목을 직접 확인하세요.</p>
      {checks.map((label, index) => <label key={label} className={ui.check}><input type="checkbox" checked={review[index]} onChange={e => { setReview(review.map((value, i) => i === index ? e.target.checked : value)); setCopied(false); }} />{label}</label>)}
      <p className={ui.hint} id={`setuk-copy-${userId}`}>{blocked || '검토한 문장을 복사할 수 있습니다. 나이스 입력 전 담당 교사가 최종 확인하세요.'}</p>
      <button className="btn btn--primary" disabled={Boolean(blocked)} aria-describedby={`setuk-copy-${userId}`} onClick={() => void copy()}>{copied ? '복사됨 ✓' : '검토한 문장 복사'}</button>
    </fieldset>
  </section>;
}
