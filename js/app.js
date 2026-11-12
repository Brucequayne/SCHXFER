import config from './config.js';
import { initHeader } from './header.js';
import { createLightbox } from './lightbox.js';
import { initPhotos } from './photos.js';

const SECTIONS = ['foto', 'video', '3d', 'sound'];

document.title = config.siteTitle;
document.documentElement.dataset.siteTitle = config.siteTitle;
document.getElementById('brand').textContent = config.siteTitle;

initHeader(document.getElementById('header'));
const lightbox = createLightbox(document.getElementById('lightbox'));

// Fotoliste laden (wird beim Veröffentlichen automatisch aus dem Ordner /fotos erzeugt)
let data = { projects: [] };
try {
  const res = await fetch('data/fotos.json', { cache: 'no-cache' });
  if (res.ok) data = await res.json();
} catch (err) {
  console.warn('data/fotos.json konnte nicht geladen werden', err);
}

let cameFromOverview = false;
const photos = initPhotos({
  data,
  lightbox,
  onBack: () => {
    if (cameFromOverview) history.back();
    else location.hash = '#foto';
  },
});

let currentSection = null;

function showSection(name, animate) {
  if (name === currentSection) return false;
  const prev = currentSection;
  currentSection = name;
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.dataset.section !== name; });
  document.querySelectorAll('.nav a').forEach((a) => {
    if (a.dataset.section === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (animate && prev && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.getElementById('view-' + name)
      .animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });
  }
  return true;
}

function route(first = false) {
  const [rawSection, rawSub] = location.hash.replace(/^#/, '').split('/');
  const section = SECTIONS.includes(rawSection) ? rawSection : 'foto';
  const sub = rawSub ? decodeURIComponent(rawSub) : null;

  lightbox.close();
  const switched = showSection(section, !first);
  if (section !== 'foto') return;

  const animate = !first && !switched;
  if (sub) photos.open(sub, animate);
  else photos.close(animate);
}

addEventListener('hashchange', (e) => {
  const oldHash = new URL(e.oldURL).hash;
  cameFromOverview = /^#foto\/?$|^#?$/.test(oldHash) && /^#foto\/.+/.test(location.hash);
  route();
});

addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lightbox.isOpen() && photos.isOpen() && currentSection === 'foto') {
    if (cameFromOverview) history.back();
    else location.hash = '#foto';
  }
});

route(true);
