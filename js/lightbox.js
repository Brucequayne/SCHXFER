// Großansicht mit Pfeiltasten, Wischen und Zoom aus dem angeklickten Foto.
const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createLightbox(root) {
  const img = root.querySelector('.lb-img');
  const counter = root.querySelector('.lb-count');
  const closeBtn = root.querySelector('.lb-close');
  let list = [];
  let idx = 0;
  let originFor = () => null; // liefert das Element in der Seite zu einem Index
  let lastFocus = null;

  const fit = (item) => {
    const pad = innerWidth < 700 ? 0 : 56;
    const maxW = innerWidth - pad * 2;
    const maxH = innerHeight - pad * 2;
    const s = Math.min(maxW / item.w, maxH / item.h);
    const w = item.w * s;
    const h = item.h * s;
    return { left: (innerWidth - w) / 2, top: (innerHeight - h) / 2, width: w, height: h };
  };

  const place = () => {
    const item = list[idx];
    const r = fit(item);
    Object.assign(img.style, {
      left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
    });
    img.src = item.src;
    img.alt = item.alt || '';
    counter.textContent = `${idx + 1} / ${list.length}`;
    // Nachbarn vorladen
    [idx - 1, idx + 1].forEach((i) => { if (list[i]) new Image().src = list[i].src; });
    return r;
  };

  const zoomFrom = (el, r, reverse = false) => {
    if (!el || reduceMotion()) return null;
    const a = el.getBoundingClientRect();
    if (a.bottom < 0 || a.top > innerHeight) return null;
    const from = `translate(${a.left - r.left}px, ${a.top - r.top}px) scale(${a.width / r.width}, ${a.height / r.height})`;
    const frames = [{ transform: from }, { transform: 'none' }];
    return img.animate(reverse ? frames.reverse() : frames, {
      duration: reverse ? 380 : 520, easing: EASE_OUT, fill: 'both',
    });
  };

  function open(items, index, getOrigin) {
    list = items;
    idx = index;
    originFor = getOrigin || (() => null);
    lastFocus = document.activeElement;
    root.hidden = false;
    const r = place();
    zoomFrom(originFor(idx), r);
    if (!reduceMotion()) root.animate([{ backgroundColor: 'rgba(22,22,23,0)' }, {}], { duration: 400, easing: EASE_OUT });
    closeBtn.focus({ preventScroll: true });
  }

  async function close() {
    if (root.hidden) return;
    const r = fit(list[idx]);
    const anim = zoomFrom(originFor(idx), r, true);
    if (anim) {
      root.animate([{}, { backgroundColor: 'rgba(22,22,23,0)' }], { duration: 380, easing: EASE_OUT, fill: 'forwards' });
      await anim.finished;
    }
    root.getAnimations().forEach((a) => a.cancel());
    img.getAnimations().forEach((a) => a.cancel());
    root.hidden = true;
    img.removeAttribute('src');
    lastFocus?.focus?.({ preventScroll: true });
  }

  function step(dir) {
    if (list.length < 2) return;
    idx = (idx + dir + list.length) % list.length;
    img.getAnimations().forEach((a) => a.cancel());
    place();
    if (!reduceMotion()) {
      img.animate([{ opacity: 0, transform: `translateX(${dir * 24}px)` }, { opacity: 1, transform: 'none' }],
        { duration: 320, easing: EASE_OUT });
    }
  }

  root.querySelector('.lb-prev').addEventListener('click', () => step(-1));
  root.querySelector('.lb-next').addEventListener('click', () => step(1));
  closeBtn.addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  addEventListener('keydown', (e) => {
    if (root.hidden) return;
    if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); }
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  }, true);

  // Wischen auf Touch-Geräten
  let startX = null;
  let startY = null;
  root.addEventListener('pointerdown', (e) => { startX = e.clientX; startY = e.clientY; });
  root.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    else if (dy > 90 && e.pointerType !== 'mouse') close();
  });

  addEventListener('resize', () => { if (!root.hidden) place(); });

  return { open, close, isOpen: () => !root.hidden };
}
