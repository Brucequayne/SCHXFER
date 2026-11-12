// Liest den Ordner /fotos und erzeugt data/fotos.json für die Website.
// Läuft automatisch bei jedem Hochladen (GitHub Action). Keine Zusatzpakete nötig.
//
// Aufbau:
//   fotos/
//     01_Island/            ← ein Projekt (Zahl vorne = Reihenfolge, wird nicht angezeigt)
//       00001.Title.jpg     ← Titelbild: „title“ irgendwo im Dateinamen
//       00002.jpg           ← weitere Fotos, sortiert nach Dateiname
//       info.txt            ← optional: 1. Zeile = Titel, Rest = Beschreibung

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'fotos';
const OUT = 'data/fotos.json';
const IMAGE = /\.(jpe?g|png|webp)$/i;
const WARN_KB = 900;

const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
const enc = (path) => path.split('/').map(encodeURIComponent).join('/');

function slug(name) {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'projekt';
}

function displayName(folder) {
  return folder.replace(/^\d+[\s._-]+/, '').replace(/[_]+/g, ' ').trim() || folder;
}

// ---------- Bildmaße auslesen (JPEG, PNG, WebP) ----------
function exifOrientation(b, t) {
  if (t + 8 > b.length) return 1;
  const le = b.toString('latin1', t, t + 2) === 'II';
  const r16 = (o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const r32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const ifd = t + r32(t + 4);
  if (ifd + 2 > b.length) return 1;
  const n = r16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > b.length) break;
    if (r16(e) === 0x0112) return r16(e + 8);
  }
  return 1;
}

function jpegSize(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  let orient = 1;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    if (m === 0xe1 && b.toString('latin1', i + 4, i + 10) === 'Exif\0\0') {
      orient = exifOrientation(b, i + 10);
    }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      const h = b.readUInt16BE(i + 5);
      const w = b.readUInt16BE(i + 7);
      return orient >= 5 && orient <= 8 ? { w: h, h: w } : { w, h };
    }
    i += 2 + len;
  }
  return null;
}

function imageSize(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return jpegSize(b);
  if (b.toString('latin1', 1, 4) === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const chunk = b.toString('latin1', 12, 16);
    if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      return {
        w: 1 + (((b[22] & 0x3f) << 8) | b[21]),
        h: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
      };
    }
    if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  }
  return null;
}

// ---------- Ordner durchgehen ----------
async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function readProject(folder) {
  const dir = join(ROOT, folder);
  const files = (await readdir(dir, { withFileTypes: true }))
    .filter((f) => f.isFile() && !f.name.startsWith('.') && IMAGE.test(f.name))
    .map((f) => f.name)
    .sort(collator.compare);

  if (!files.length) {
    console.warn(`⚠ ${dir}: keine Bilder gefunden – übersprungen`);
    return null;
  }

  const images = [];
  for (const name of files) {
    const path = join(dir, name);
    const buf = await readFile(path);
    const size = imageSize(buf);
    if (!size || !size.w || !size.h) {
      console.warn(`⚠ ${path}: Bildgröße nicht lesbar – übersprungen`);
      continue;
    }
    const kb = Math.round(buf.length / 1024);
    if (kb > WARN_KB) console.warn(`⚠ ${path}: ${kb} KB – größer als empfohlen (lädt langsam)`);
    images.push({ name, src: enc(`${ROOT}/${folder}/${name}`), w: size.w, h: size.h });
  }
  if (!images.length) return null;

  let coverIndex = images.findIndex((img) => /title/i.test(img.name));
  if (coverIndex < 0) {
    console.warn(`⚠ ${dir}: kein Bild mit „title“ im Namen – nehme das erste als Titelbild`);
    coverIndex = 0;
  }
  const [cover] = images.splice(coverIndex, 1);

  let title = displayName(folder);
  let description = '';
  const infoPath = join(dir, 'info.txt');
  if (await exists(infoPath)) {
    const lines = (await readFile(infoPath, 'utf8')).replace(/^﻿/, '').split(/\r?\n/);
    if (lines[0]?.trim()) title = lines[0].trim();
    description = lines.slice(1).join('\n').trim();
  }

  const strip = ({ name, ...rest }) => rest;
  return { id: slug(displayName(folder)), title, description, cover: strip(cover), photos: images.map(strip) };
}

async function main() {
  const projects = [];
  if (await exists(ROOT)) {
    const entries = (await readdir(ROOT, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort(collator.compare);

    const used = new Set();
    for (const folder of entries) {
      const p = await readProject(folder);
      if (!p) continue;
      let id = p.id;
      for (let n = 2; used.has(id); n++) id = `${p.id}-${n}`;
      used.add(id);
      p.id = id;
      projects.push(p);
      console.log(`✓ ${p.title}: ${p.photos.length + 1} Fotos`);
    }
  } else {
    console.warn('⚠ Ordner „fotos“ fehlt – Fotobereich bleibt leer');
  }

  await mkdir('data', { recursive: true });
  await writeFile(OUT, JSON.stringify({ generated: new Date().toISOString(), projects }, null, 1));
  console.log(`→ ${OUT} geschrieben (${projects.length} Projekte)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
