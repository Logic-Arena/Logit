type ProtectedRegion = { element: HTMLElement | null; reason: string };

/** Copy can target body when a selection starts outside the protected component. */
export function installSetukCopyGuard(
  doc: Document,
  getRegions: () => ProtectedRegion[],
  onBlocked: (reason: string) => void,
): () => void {
  const guard = (event: Event) => {
    const selection = doc.getSelection();
    for (const { element, reason } of getRegions()) {
      if (!element) continue;
      const NodeClass = doc.defaultView?.Node;
      const targetInside = Boolean(NodeClass && event.target instanceof NodeClass && element.contains(event.target as Node));
      const activeInside = doc.activeElement !== null && element.contains(doc.activeElement);
      let selectionIntersects = false;
      if (selection && !selection.isCollapsed) {
        for (let index = 0; index < selection.rangeCount; index++) {
          if (selection.getRangeAt(index).intersectsNode(element)) {
            selectionIntersects = true;
            break;
          }
        }
      }
      if (!targetInside && !activeInside && !selectionIntersects) continue;
      event.preventDefault();
      event.stopPropagation();
      if ('clipboardData' in event) (event as ClipboardEvent).clipboardData?.clearData();
      onBlocked(reason);
      return;
    }
  };
  // Capture on document also covers browser-menu copy and selections across sections.
  const events = ['copy', 'cut', 'dragstart'] as const;
  const options = { capture: true };
  events.forEach(type => doc.addEventListener(type, guard, options));
  return () => events.forEach(type => doc.removeEventListener(type, guard, options));
}
