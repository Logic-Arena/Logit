import test from 'node:test';
import assert from 'node:assert/strict';
import { installSetukCopyGuard } from '../src/lib/setukCopyGuard.ts';

// Model document-level copy events: selection can cross a protected region even
// when the event target and focus are both outside that component.
function setup() {
  const doc = new EventTarget();
  const protectedElement = { contains: (node: unknown) => node === protectedElement };
  let intersects = false;
  let enabled = true;
  let activeElement: unknown = null;
  let blocked = 0;
  Object.assign(doc, {
    defaultView: { Node: EventTarget },
    getSelection: () => ({ isCollapsed: false, rangeCount: 1, getRangeAt: () => ({ intersectsNode: () => intersects }) }),
  });
  Object.defineProperty(doc, 'activeElement', { get: () => activeElement });
  const cleanup = installSetukCopyGuard(doc as unknown as Document, () => enabled ? [{ element: protectedElement as unknown as HTMLElement, reason: 'blocked' }] : [], () => blocked++);
  return {
    doc, cleanup,
    selectAcross: () => { intersects = true; },
    focusEditor: () => { activeElement = protectedElement; },
    allow: () => { enabled = false; },
    blocked: () => blocked,
    fire: (type: string) => {
      const event = new Event(type, { cancelable: true });
      doc.dispatchEvent(event);
      return event.defaultPrevented;
    },
  };
}

for (const type of ['copy', 'cut', 'dragstart']) {
  test(`영역 밖에서 시작한 선택의 ${type}도 document에서 차단`, () => {
    const guard = setup();
    guard.selectAcross();
    assert.equal(guard.fire(type), true);
    assert.equal(guard.blocked(), 1);
    guard.cleanup();
  });
}

test('편집란 선택은 document Selection에 나타나지 않아도 차단', () => {
  const guard = setup();
  guard.focusEditor();
  assert.equal(guard.fire('copy'), true);
  guard.allow();
  assert.equal(guard.fire('copy'), false);
  guard.cleanup();
});

test('관련 없는 선택과 컴포넌트 종료 이후 복사는 허용', () => {
  const guard = setup();
  assert.equal(guard.fire('copy'), false);
  guard.selectAcross();
  guard.cleanup();
  assert.equal(guard.fire('copy'), false);
});

test('차단 시 클립보드 이벤트에 다른 핸들러가 넣은 내용도 제거', () => {
  const guard = setup();
  guard.selectAcross();
  let cleared = false;
  const event = new Event('copy', { cancelable: true });
  Object.assign(event, { clipboardData: { clearData: () => { cleared = true; } } });
  guard.doc.dispatchEvent(event);
  assert.equal(cleared, true);
  guard.cleanup();
});
