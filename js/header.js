// Kopfzeile: erscheint, wenn die Maus im oberen Viertel ist, sonst verschwindet sie.
// Auf Touch-Geräten: beim Hochscrollen sichtbar, beim Runterscrollen weg.
export function initHeader(header) {
  let visible = true;
  const set = (v) => {
    if (v === visible) return;
    visible = v;
    header.classList.toggle('is-hidden', !v);
  };
  const hasFocus = () => header.contains(document.activeElement);

  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (finePointer) {
    addEventListener('mousemove', (e) => {
      set(e.clientY < innerHeight * 0.25 || hasFocus());
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => {
      if (!hasFocus()) set(false);
    });
  } else {
    let lastY = new WeakMap();
    document.addEventListener('scroll', (e) => {
      const el = e.target;
      if (!(el instanceof Element) || !el.classList.contains('scroller')) return;
      const y = el.scrollTop;
      const prev = lastY.get(el) ?? 0;
      if (y < 40) set(true);
      else if (Math.abs(y - prev) > 6) set(y < prev);
      lastY.set(el, y);
    }, { capture: true, passive: true });
  }

  header.addEventListener('focusin', () => set(true));

  return { show: () => set(true) };
}
