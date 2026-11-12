// Fotobereich: Projekt-Kacheln und geöffnete Projekte.
// Beim Öffnen fliegen die anderen Kacheln zu allen Seiten weg, das Titelbild
// gleitet nach oben und die Projektfotos schieben sich wie aus einem Stapel
// darunter hervor. Alles ohne Seitenwechsel.
import { justify } from './justify.js';

const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
const EASE_IN = 'cubic-bezier(.5,0,.75,0)';
const GAP = 4;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (sel, root = document) => root.querySelector(sel);
const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const rectStyle = (r) => ({
  left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
});
// gleichbleibende "Zufalls"-Drehung pro Foto, damit der Stapel natürlich wirkt
const tilt = (i) => (((Math.sin(i * 12.9898) * 43758.5453) % 1) * 2 - 1) * 7;

export function initPhotos({ data, lightbox, onBack }) {
  const overview = $('#foto-overview');
  const tilesEl = $('#tiles');
  const project = $('#foto-project');
  const coverWrap = $('.cover-wrap', project);
  const coverBtn = $('.cover-btn', project);
  const coverImg = $('.cover', project);
  const titleEl = $('.project-title', project);
  const descEl = $('.project-desc', project);
  const metaEl = $('.project-meta', project);
  const grid = $('.justified', project);
  const backBtn = $('.back', project);

  const projects = data.projects || [];
  const byId = new Map(projects.map((p) => [p.id, p]));
  let current = null;
  let overviewScroll = 0;
  let queue = Promise.resolve();
  let pending = 0;
  // Schritte laufen nacheinander; stauen sie sich (schnelles Vor/Zurück), wird ohne Animation gesprungen
  const enqueue = (fn) => {
    pending++;
    return (queue = queue.then(() => fn(pending > 1)).catch((err) => console.error(err)).finally(() => pending--));
  };

  // ---------- Übersicht ----------
  if (!projects.length) {
    tilesEl.innerHTML = `<p class="empty"><strong>Noch keine Fotos.</strong><br>
      Lege im Repo einen Ordner <code>fotos/Projektname/</code> an und lade deine Bilder hinein.
      Das Titelbild bekommt „title“ im Dateinamen. Nach dem Hochladen erscheint das Projekt hier automatisch.</p>`;
  }

  const preloaded = new Set();
  const preload = (p) => {
    if (preloaded.has(p.id)) return;
    preloaded.add(p.id);
    p.photos.slice(0, 6).forEach((ph) => { new Image().src = ph.src; });
  };

  for (const p of projects) {
    const a = document.createElement('a');
    a.className = 'tile';
    a.href = '#foto/' + encodeURIComponent(p.id);
    a.dataset.id = p.id;
    const img = new Image();
    img.src = p.cover.src;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    const label = document.createElement('span');
    label.className = 'tile-label';
    const t = document.createElement('span');
    t.className = 'tile-title';
    t.textContent = p.title;
    const c = document.createElement('span');
    c.className = 'tile-count';
    c.textContent = `${p.photos.length + 1} Fotos`;
    label.append(t, c);
    a.append(img, label);
    a.addEventListener('pointerenter', () => preload(p));
    a.addEventListener('focus', () => preload(p));
    tilesEl.append(a);
  }

  const tileFor = (id) => [...tilesEl.children].find((t) => t.dataset.id === id);

  // ---------- Projekt aufbauen ----------
  const allImages = (p) => [
    { ...p.cover, alt: p.title },
    ...p.photos.map((ph, i) => ({ ...ph, alt: `${p.title}, Foto ${i + 2}` })),
  ];

  function fill(p) {
    titleEl.textContent = p.title;
    descEl.textContent = p.description || '';
    metaEl.textContent = `${p.photos.length + 1} Fotos`;
    coverImg.src = p.cover.src;
    coverImg.alt = p.title;
    grid.replaceChildren(...p.photos.map((ph, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ph';
      b.setAttribute('aria-label', `Foto ${i + 2} groß ansehen`);
      const img = new Image();
      img.src = ph.src;
      img.alt = '';
      img.decoding = 'async';
      if (i > 14) img.loading = 'lazy';
      b.append(img);
      b.addEventListener('click', () => openLightbox(i + 1));
      return b;
    }));
  }

  function layout() {
    if (!current) return;
    const W = project.clientWidth;
    const ar = current.cover.w / current.cover.h;
    const ch = Math.min(W / ar, innerHeight * 0.86);
    coverImg.style.width = ch * ar + 'px';
    coverImg.style.height = ch + 'px';

    const target = W < 600 ? 170 : W < 1100 ? 260 : 340;
    const { boxes, height } = justify(current.photos, W, target, GAP);
    grid.style.height = height + 'px';
    boxes.forEach((b, i) => {
      Object.assign(grid.children[i].style, {
        left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px',
      });
    });
  }
  let resizeT;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(layout, 80); });

  function openLightbox(i) {
    const items = allImages(current);
    lightbox.open(items, i, (k) => (k === 0 ? coverImg : grid.children[k - 1]));
  }
  coverBtn.addEventListener('click', () => openLightbox(0));
  backBtn.addEventListener('click', () => onBack());

  const makeFlyer = (src, r) => {
    const f = new Image();
    f.className = 'flyer';
    f.src = src;
    f.alt = '';
    Object.assign(f.style, rectStyle(r));
    document.body.append(f);
    return f;
  };

  const visible = (r) => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

  // ---------- Öffnen ----------
  function open(id, animate) {
    return enqueue(async (backlog) => {
      if (backlog) animate = false;
      const p = byId.get(id);
      if (!p) { location.replace('#foto'); return; }
      if (current?.id === id) return;
      if (current) await doClose(false);

      current = p;
      overviewScroll = overview.scrollTop;
      fill(p);
      project.hidden = false;
      project.scrollTop = 0;
      layout();
      document.title = `${p.title} – ${document.documentElement.dataset.siteTitle || ''}`;

      const tile = tileFor(id);
      const tileRect = tile?.getBoundingClientRect();
      if (!animate || reduceMotion() || !tile || overview.hidden || !visible(tileRect)) {
        overview.hidden = true;
        if (animate) await project.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }).finished;
        return;
      }

      project.classList.add('is-entering');
      project.style.pointerEvents = 'none';
      overview.style.pointerEvents = 'none';
      const to = coverImg.getBoundingClientRect();
      coverImg.style.visibility = 'hidden';
      tile.style.visibility = 'hidden';
      const flyer = makeFlyer(p.cover.src, tileRect);
      const anims = [];

      // 1. Die anderen Kacheln fliegen vom angeklickten Projekt weg – zu allen Seiten
      const D = Math.hypot(innerWidth, innerHeight);
      const o = center(tileRect);
      for (const t of tilesEl.children) {
        if (t === tile) continue;
        const r = t.getBoundingClientRect();
        if (!visible(r)) continue;
        const c = center(r);
        let dx = c.x - o.x;
        let dy = c.y - o.y;
        const len = Math.hypot(dx, dy) || 1;
        dx = (dx / len) * D;
        dy = (dy / len) * D;
        anims.push(t.animate([
          { transform: 'none', opacity: 1 },
          { opacity: 1, offset: 0.55 },
          { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
        ], { duration: 720, delay: (len / D) * 140, easing: EASE_IN, fill: 'forwards' }));
      }

      // 2. Das Titelbild gleitet an seinen Platz
      anims.push(flyer.animate([rectStyle(tileRect), rectStyle(to)], {
        duration: 860, delay: 90, easing: EASE_OUT, fill: 'forwards',
      }));

      // 3. Die Projektfotos kommen unter dem Titelbild hervor, als lägen sie gestapelt darunter
      const stack = { x: to.left + to.width / 2, y: to.top + to.height * 0.6 };
      [...grid.children].forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.top > innerHeight * 1.3) {
          anims.push(el.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 500, delay: 900, fill: 'backwards',
          }));
          return;
        }
        const c = center(r);
        const s = Math.min(1, (Math.min(to.width, to.height) * 0.5) / Math.max(r.width, r.height));
        anims.push(el.animate([
          { transform: `translate(${stack.x - c.x}px, ${stack.y - c.y}px) scale(${s}) rotate(${tilt(i)}deg)`, opacity: 0 },
          { opacity: 1, offset: 0.12 },
          { transform: 'none', opacity: 1 },
        ], { duration: 950, delay: 420 + Math.min(i, 24) * 45, easing: EASE_OUT, fill: 'backwards' }));
      });

      setTimeout(() => project.classList.remove('is-entering'), 650);
      await Promise.all(anims.map((a) => a.finished));

      coverImg.style.visibility = '';
      flyer.remove();
      overview.hidden = true;
      for (const t of tilesEl.children) t.getAnimations().forEach((a) => a.cancel());
      tile.style.visibility = '';
      project.style.pointerEvents = '';
      overview.style.pointerEvents = '';
    });
  }

  // ---------- Schließen ----------
  function close(animate) {
    return enqueue((backlog) => doClose(animate && !backlog));
  }

  async function doClose(animate) {
    if (!current) return;
    const p = current;
    document.title = document.documentElement.dataset.siteTitle || document.title;
    overview.hidden = false;
    overview.scrollTop = overviewScroll;
    const tile = tileFor(p.id);
    const tileRect = tile?.getBoundingClientRect();

    if (!animate || reduceMotion() || !tile || !visible(tileRect)) {
      project.hidden = true;
      current = null;
      if (animate) await overview.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }).finished;
      return;
    }

    project.style.pointerEvents = 'none';
    overview.style.pointerEvents = 'none';
    const from = coverImg.getBoundingClientRect();
    tile.style.visibility = 'hidden';
    const anims = [];

    // 1. Fotos schieben sich zurück unter das Titelbild
    const stack = { x: from.left + from.width / 2, y: from.top + from.height * 0.6 };
    const kids = [...grid.children];
    kids.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (!visible(r)) { el.style.opacity = '0'; return; }
      const c = center(r);
      const s = Math.min(1, (Math.min(from.width, from.height) * 0.5) / Math.max(r.width, r.height));
      anims.push(el.animate([
        { transform: 'none', opacity: 1 },
        { opacity: 1, offset: 0.85 },
        { transform: `translate(${stack.x - c.x}px, ${stack.y - c.y}px) scale(${s}) rotate(${tilt(i)}deg)`, opacity: 0 },
      ], { duration: 520, delay: Math.min(kids.length - i, 24) * 18, easing: EASE_IN, fill: 'forwards' }));
    });
    anims.push($('.project-head', project).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }));

    // 2. Titelbild fliegt zurück in seine Kachel
    const flyer = makeFlyer(p.cover.src, from);
    coverImg.style.visibility = 'hidden';
    anims.push(flyer.animate([rectStyle(from), rectStyle(tileRect)], {
      duration: 780, delay: 300, easing: EASE_OUT, fill: 'forwards',
    }));

    // 3. Die anderen Kacheln kommen von allen Seiten zurück
    const D = Math.hypot(innerWidth, innerHeight);
    const o = center(tileRect);
    for (const t of tilesEl.children) {
      if (t === tile) continue;
      const r = t.getBoundingClientRect();
      if (!visible(r)) continue;
      const c = center(r);
      let dx = c.x - o.x;
      let dy = c.y - o.y;
      const len = Math.hypot(dx, dy) || 1;
      dx = (dx / len) * D;
      dy = (dy / len) * D;
      anims.push(t.animate([
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
        { opacity: 1, offset: 0.45 },
        { transform: 'none', opacity: 1 },
      ], { duration: 820, delay: 320 + (1 - len / D) * 120, easing: EASE_OUT, fill: 'backwards' }));
    }

    await Promise.all(anims.map((a) => a.finished));

    tile.style.visibility = '';
    flyer.remove();
    project.hidden = true;
    coverImg.style.visibility = '';
    project.querySelectorAll('*').forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    kids.forEach((el) => { el.style.opacity = ''; });
    project.style.pointerEvents = '';
    overview.style.pointerEvents = '';
    current = null;
  }

  return {
    open,
    close,
    isOpen: () => !!current,
    reset: () => { current = null; project.hidden = true; overview.hidden = false; },
  };
}
